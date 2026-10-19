import { createClient } from '@supabase/supabase-js'

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email
  const parts = email.split('@')
  const name = parts[0] || ''
  const domain = parts[1] || ''
  if (!name || !domain) return email

  if (name.length <= 2) {
    return `${name.charAt(0)}*@${domain}`
  }
  const masked = name.charAt(0) + '*'.repeat(Math.min(name.length - 2, 4)) + name.slice(-1)
  return `${masked}@${domain}`
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const identifier = (body?.identifier || '').trim()

    if (!identifier) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Please provide an email or username.'
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
        statusMessage: 'Server configuration error: Supabase key missing.'
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Look up by Email or Username (case-insensitive)
    const { data, error } = await supabaseAdmin
      .from('USER_ACCOUNT')
      .select('ACCOUNT_ID, Username, Email, Is_Banned')
      .or(`Email.ilike.${identifier},Username.ilike.${identifier}`)
      .maybeSingle()

    if (error) {
      console.error('Error verifying account:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to verify account. Please try again.'
      })
    }

    if (!data) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No account found with that email or username.'
      })
    }

    if (data.Is_Banned) {
      throw createError({
        statusCode: 403,
        statusMessage: 'This account has been suspended.'
      })
    }

    return {
      exists: true,
      username: data.Username,
      maskedEmail: maskEmail(data.Email)
    }
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || 'An unexpected error occurred.'
    })
  }
})
