import { createClient } from '@supabase/supabase-js'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    // -------------------------------------------------------------------------
    // STEP 1: Validate the review submission
    // -------------------------------------------------------------------------
    const body = await readBody(event)

    const bookingId = body?.bookingId
    const targetType = body?.targetType
    const rating = body?.rating
    const feedback = body?.feedback ?? ''

    if (typeof bookingId !== 'string' || !bookingId.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Booking ID is required.'
      })
    }

    if (!['artist', 'business', 'account'].includes(targetType)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid review target type.'
      })
    }

    // Ratings must be between 1 and 5, with at most one decimal place.
    if (
      typeof rating !== 'number' ||
      !Number.isFinite(rating) ||
      rating < 1 ||
      rating > 5 ||
      !Number.isInteger(rating * 10)
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Rating must be between 1 and 5.'
      })
    }

    if (typeof feedback !== 'string' || feedback.length > 2000) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Feedback must be text of at most 2000 characters.'
      })
    }

    // -------------------------------------------------------------------------
    // STEP 2: Initialize the server-side Supabase client
    // -------------------------------------------------------------------------
    const supabaseUrl = process.env.SUPABASE_URL

    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.NUXT_SUPABASE_SECRET_KEY

    if (!supabaseUrl || !serviceKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Supabase server configuration is missing.'
      })
    }

    // The service-role client bypasses RLS.
    // Therefore, every authorization check must happen in this endpoint.
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // -------------------------------------------------------------------------
    // STEP 3: Authenticate the reviewer
    // -------------------------------------------------------------------------
    let currentUserId: string | null = null

    try {
      const user = await serverSupabaseUser(event)
      currentUserId = user?.id || (user as any)?.sub || null
    } catch {
      // Fall back to Bearer token authentication.
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

    if (!currentUserId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'You must be logged in to submit a review.'
      })
    }

    // Verify that the authenticated user has a TONO account.
    const { data: account, error: accountError } = await supabaseAdmin
      .from('USER_ACCOUNT')
      .select('ACCOUNT_ID')
      .eq('ACCOUNT_ID', currentUserId)
      .maybeSingle()

    if (accountError) throw accountError

    if (!account) {
      throw createError({
        statusCode: 403,
        statusMessage: 'A valid TONO account is required.'
      })
    }

    // -------------------------------------------------------------------------
    // STEP 4: Verify that the booking has been completed
    // -------------------------------------------------------------------------
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('BOOKING_CONTRACT')
      .select(`
        Booking_ID,
        Booking_Type,
        Requester_Account_ID,
        Provider_Artist_ID,
        Provider_Business_ID,
        Status
      `)
      .eq('Booking_ID', bookingId)
      .maybeSingle()

    if (bookingError) throw bookingError

    if (!booking) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Booking not found.'
      })
    }

    if (booking.Status !== 'Completed') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Only completed bookings can be reviewed.'
      })
    }

    // -------------------------------------------------------------------------
    // STEP 5: Identify the booking participants
    // -------------------------------------------------------------------------
    let artistAccountId: string | null = null
    let businessAccountId: string | null = null

    if (booking.Provider_Artist_ID) {
      const { data: artist, error } = await supabaseAdmin
        .from('ARTIST')
        .select('ACCOUNT_ID')
        .eq('ARTIST_ID', booking.Provider_Artist_ID)
        .maybeSingle()

      if (error) throw error
      artistAccountId = artist?.ACCOUNT_ID || null
    }

    if (booking.Provider_Business_ID) {
      const { data: business, error } = await supabaseAdmin
        .from('BUSINESS_PROFILE')
        .select('ACCOUNT_ID')
        .eq('BUSINESS_ID', booking.Provider_Business_ID)
        .maybeSingle()

      if (error) throw error
      businessAccountId = business?.ACCOUNT_ID || null
    }

    const isArtist = artistAccountId === currentUserId

    const isRequester =
      booking.Requester_Account_ID === currentUserId

    const isBusinessOwner =
      businessAccountId !== null &&
      businessAccountId === currentUserId

    if (!isArtist && !isRequester && !isBusinessOwner) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You are not a participant in this booking.'
      })
    }

    // -------------------------------------------------------------------------
    // STEP 6: Determine the only valid review recipient
    // -------------------------------------------------------------------------
    const reviewTarget = {
      Target_Artist_ID: null as string | null,
      Target_Business_ID: null as string | null,
      Target_Account_ID: null as string | null
    }

    if (targetType === 'artist') {
      // The booking requester or business owner reviews the artist.
      if (
        (!isRequester && !isBusinessOwner) ||
        !booking.Provider_Artist_ID ||
        !artistAccountId ||
        artistAccountId === currentUserId
      ) {
        throw createError({
          statusCode: 403,
          statusMessage: 'You cannot review this artist.'
        })
      }

      reviewTarget.Target_Artist_ID = booking.Provider_Artist_ID
    } else if (targetType === 'business') {
      // The assigned artist reviews the hiring business.
      if (
        !isArtist ||
        !booking.Provider_Business_ID ||
        !businessAccountId ||
        businessAccountId === currentUserId
      ) {
        throw createError({
          statusCode: 403,
          statusMessage: 'You cannot review this business.'
        })
      }

      reviewTarget.Target_Business_ID = booking.Provider_Business_ID
    } else {
      // The assigned artist reviews an individual booking requester.
      // Business-backed bookings use the business profile instead.
      if (
        !isArtist ||
        booking.Provider_Business_ID ||
        !booking.Requester_Account_ID ||
        booking.Requester_Account_ID === currentUserId
      ) {
        throw createError({
          statusCode: 403,
          statusMessage: 'You cannot review this account.'
        })
      }

      reviewTarget.Target_Account_ID = booking.Requester_Account_ID
    }

    // -------------------------------------------------------------------------
    // STEP 7: Prevent duplicate reviews
    // -------------------------------------------------------------------------
    const { data: existingReview, error: duplicateError } =
      await supabaseAdmin
        .from('FEEDBACK_REVIEW')
        .select('Review_ID')
        .eq('Booking_ID', bookingId)
        .eq('Reviewer_Account_ID', currentUserId)
        .maybeSingle()

    if (duplicateError) throw duplicateError

    if (existingReview) {
      throw createError({
        statusCode: 409,
        statusMessage: 'You have already reviewed this booking.'
      })
    }

    // -------------------------------------------------------------------------
    // STEP 8: Save the review
    // -------------------------------------------------------------------------
    const { data: review, error: insertError } = await supabaseAdmin
      .from('FEEDBACK_REVIEW')
      .insert({
        Booking_ID: bookingId,
        Reviewer_Account_ID: currentUserId,
        ...reviewTarget,
        Rating_Score: rating,
        Written_Feedback: feedback.trim() || null
      })
      .select('Review_ID, Booking_ID, Rating_Score, Created_At')
      .single()

    if (insertError) throw insertError

    return {
      success: true,
      message: 'Review submitted successfully.',
      review
    }
  } catch (error: any) {
    // Preserve intentional HTTP errors.
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage:
        error.statusMessage ||
        error.message ||
        'Failed to submit review.'
    })
  }
})