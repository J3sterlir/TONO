
import { createClient } from '@supabase/supabase-js'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    // Read the booking ID sent by the frontend.
    const body = await readBody(event)
    const bookingId = body?.bookingId

    if (typeof bookingId !== 'string' || !bookingId.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Booking ID is required.'
      })
    }

    // Get the server-side Supabase credentials.
    // The service-role key bypasses RLS, so this endpoint must
    // perform its own authentication and authorization checks.
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.NUXT_SUPABASE_SECRET_KEY

    if (!supabaseUrl || !serviceKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Supabase server configuration is missing.'
      })
    }

    // Create a server-side Supabase client without persisting a session.
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // STEP 1: Identify the currently logged-in user.
    // First, try the Supabase session cookie.
    // If that does not identify the user, try the Bearer token.
    let currentUserId: string | null = null

    try {
      const user = await serverSupabaseUser(event)
      currentUserId = user?.id || (user as any)?.sub || null
    } catch {
      // Continue to Bearer token authentication if no session is found.
    }

    if (!currentUserId) {
      const authHeader = getHeader(event, 'authorization')

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim()
        const { data, error } = await supabaseAdmin.auth.getUser(token)

        if (!error) {
          currentUserId = data.user?.id || null
        }
      }
    }

    // Stop if the request does not belong to an authenticated user.
    if (!currentUserId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'You must be logged in to complete a booking.'
      })
    }

    // STEP 2: Retrieve the booking and its relevant fields.
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('BOOKING_CONTRACT')
      .select(`
        Booking_ID,
        Requester_Account_ID,
        Provider_Artist_ID,
        Provider_Business_ID,
        Start_Date,
        End_Date,
        Event_Date,
        Start_Time,
        End_Time,
        Status
      `)
      .eq('Booking_ID', bookingId)
      .maybeSingle()

    if (bookingError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to retrieve booking: ${bookingError.message}`
      })
    }

    if (!booking) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Booking not found.'
      })
    }

    // STEP 3: Only confirmed or active bookings can be completed.
    // Pending, cancelled, declined, and already-completed bookings are rejected.
    if (!['Confirmed', 'Active'].includes(booking.Status)) {
      throw createError({
        statusCode: 409,
        statusMessage:
          `This booking cannot be completed because its status is "${booking.Status}".`
      })
    }

    // STEP 4: Check whether the current user is involved in this booking.
    // The requester is the account that initiated the booking.
    let isParticipant =
      booking.Requester_Account_ID === currentUserId

    // Check whether the current user owns the artist profile on the booking.
    if (!isParticipant && booking.Provider_Artist_ID) {
      const { data: artist, error } = await supabaseAdmin
        .from('ARTIST')
        .select('ACCOUNT_ID')
        .eq('ARTIST_ID', booking.Provider_Artist_ID)
        .maybeSingle()

      if (error) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to verify the artist.'
        })
      }

      isParticipant = artist?.ACCOUNT_ID === currentUserId
    }

    // Check whether the current user owns the business profile on the booking.
    if (!isParticipant && booking.Provider_Business_ID) {
      const { data: business, error } = await supabaseAdmin
        .from('BUSINESS_PROFILE')
        .select('ACCOUNT_ID')
        .eq('BUSINESS_ID', booking.Provider_Business_ID)
        .maybeSingle()

      if (error) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to verify the business owner.'
        })
      }

      isParticipant = business?.ACCOUNT_ID === currentUserId
    }

    // Reject users who are not the requester, assigned artist, or business owner.
    if (!isParticipant) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You are not authorized to complete this booking.'
      })
    }

    // STEP 5: Determine the scheduled end date.
    // Prefer End_Date, then fall back to Start_Date or Event_Date
    // for bookings where the end date was not saved separately.
    const endDate =
      booking.End_Date ||
      booking.Start_Date ||
      booking.Event_Date

    const endTime = booking.End_Time

    // Both date and time are required to verify when the booking ends.
    if (!endDate || !endTime) {
      throw createError({
        statusCode: 400,
        statusMessage:
          'This booking has no complete scheduled end date and time.'
      })
    }

    // Validate the date and time formats before parsing them.
    // The booking forms use the 24-hour HH:mm format, such as "22:00".
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endDate)
    const timeMatch =
      /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(endTime)

    if (!dateMatch || !timeMatch) {
      throw createError({
        statusCode: 400,
        statusMessage:
          'The booking end date or time has an invalid format.'
      })
    }

    const [, year, month, day] = dateMatch
    const [, hours, minutes, seconds = '00'] = timeMatch

    // Interpret the scheduled time as Philippine Standard Time (UTC+08:00).
    const scheduledEnd = new Date(
      `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`
    )

    // Validate the calendar date independently of timezone conversion.
    const calendarDate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day))
    )

    if (
    calendarDate.getUTCFullYear() !== Number(year) ||
    calendarDate.getUTCMonth() !== Number(month) - 1 ||
    calendarDate.getUTCDate() !== Number(day)
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: 'The booking end date is invalid.'
      })
    }

    // Do not allow completion before the scheduled end time.
    if (Date.now() < scheduledEnd.getTime()) {
      throw createError({
        statusCode: 409,
        statusMessage:
          'This booking cannot be completed before its scheduled end time.'
      })
    }

    // STEP 6: Update the booking only if it is still Confirmed or Active.
    // The status condition prevents overwriting a status changed by another request.
    const { data: updatedBooking, error: updateError } =
      await supabaseAdmin
        .from('BOOKING_CONTRACT')
        .update({ Status: 'Completed' })
        .eq('Booking_ID', bookingId)
        .in('Status', ['Confirmed', 'Active'])
        .select('Booking_ID, Status')
        .maybeSingle()

    if (updateError) {
      throw createError({
        statusCode: 500,
        statusMessage:
          `Failed to complete booking: ${updateError.message}`
      })
    }

    // If no row was updated, the booking status may have changed in the meantime.
    if (!updatedBooking) {
      throw createError({
        statusCode: 409,
        statusMessage:
          'The booking status changed. Refresh the page and try again.'
      })
    }

    // Return a success response to the frontend.
    return {
      success: true,
      message: 'Booking completed successfully.',
      booking: updatedBooking
    }
  } catch (error: any) {
    // Preserve intentional HTTP status codes and provide a fallback for unexpected errors.
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage:
        error.statusMessage || error.message || 'Internal server error.'
    })
  }
})
