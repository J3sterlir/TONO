import { createClient } from '@supabase/supabase-js'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { contestMessage } = body

    if (!contestMessage || !contestMessage.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Please provide an explanation for your appeal.'
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
        statusMessage: 'Supabase configuration missing.'
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Authenticate caller
    let callerId: string | null = null
    try {
      const user = await serverSupabaseUser(event)
      callerId = user?.id || (user as any)?.sub || null
    } catch {}

    if (!callerId) {
      const authHeader = getHeader(event, 'authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '').trim()
        const { data: tokenUser } = await supabaseAdmin.auth.getUser(token)
        callerId = tokenUser?.user?.id || null
      }
    }

    if (!callerId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized. Authentication required.'
      })
    }

    // Verify user account exists and is banned or suspended
    const { data: userAccount, error: accErr } = await supabaseAdmin
      .from('USER_ACCOUNT')
      .select('ACCOUNT_ID, Username, Email, Is_Banned, Ban_Reason, Is_Suspended, Suspension_Reason, Strike_Count, Ban_Contested')
      .eq('ACCOUNT_ID', callerId)
      .single()

    if (accErr || !userAccount) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User account not found.'
      })
    }

    if (!userAccount.Is_Banned && !userAccount.Is_Suspended) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Your account is not currently banned or suspended.'
      })
    }

    const nowIso = new Date().toISOString()

    // 1. Update USER_ACCOUNT with appeal information
    await supabaseAdmin
      .from('USER_ACCOUNT')
      .update({
        Ban_Contested: true,
        Contest_Message: contestMessage.trim(),
        Contested_At: nowIso
      })
      .eq('ACCOUNT_ID', callerId)

    // 2. Insert urgent appeal ticket into USER_REPORT
    const appealCategory = userAccount.Is_Banned ? 'Ban Appeal' : 'Suspension Appeal'
    await supabaseAdmin
      .from('USER_REPORT')
      .insert({
        Reporter_Account_ID: callerId,
        Target_Account_ID: callerId,
        Report_Type: 'Appeal',
        Category: appealCategory,
        Description: contestMessage.trim(),
        Evidence_Snapshot: {
          username: userAccount.Username,
          email: userAccount.Email,
          strikeCount: userAccount.Strike_Count || 0,
          banReason: userAccount.Ban_Reason || null,
          suspensionReason: userAccount.Suspension_Reason || null,
          appealSubmittedAt: nowIso
        },
        Is_Resolved: false,
        Created_At: nowIso
      })

    return {
      success: true,
      message: 'Your contest statement has been submitted to administration for review.'
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('[user/contest-ban] Unexpected error:', err)
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Error submitting contest appeal.'
    })
  }
})
