import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const identifier = (body?.identifier || '').trim()
    const newPassword = body?.newPassword || ''

    if (!identifier) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Please provide an email or username.'
      })
    }

    if (!newPassword || typeof newPassword !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'New password is required.'
      })
    }

    if (newPassword.length < 6) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Password must be at least 6 characters long.'
      })
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey =
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.NUXT_SUPABASE_SECRET_KEY

    if (!supabaseUrl || !serviceKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Server configuration error: Supabase service key missing.'
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Look up the user record
    const { data: userRecord, error: lookupError } = await supabaseAdmin
      .from('USER_ACCOUNT')
      .select('ACCOUNT_ID, Username, Email, Is_Banned')
      .or(`Email.ilike.${identifier},Username.ilike.${identifier}`)
      .maybeSingle()

    if (lookupError) {
      console.error('Error finding user account for reset:', lookupError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Database lookup failed.'
      })
    }

    if (!userRecord) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Account not found. Please verify your email or username.'
      })
    }

    if (userRecord.Is_Banned) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Cannot reset password for a suspended account.'
      })
    }

    // Update password in Supabase Auth via Service Role
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      userRecord.ACCOUNT_ID,
      { password: newPassword }
    )

    if (authUpdateError) {
      console.error('Supabase admin password update error:', authUpdateError)
      throw createError({
        statusCode: 400,
        statusMessage: authUpdateError.message || 'Failed to update password in authentication system.'
      })
    }

    return {
      success: true,
      username: userRecord.Username,
      message: 'Password successfully updated! You can now log in with your new password.'
    }
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || 'An unexpected error occurred while resetting password.'
    })
  }
})
