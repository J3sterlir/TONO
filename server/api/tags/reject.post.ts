import { createClient } from '@supabase/supabase-js'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { tagId, tagType, requestId, requestIds } = body

    if (!tagId && !requestId && (!requestIds || !requestIds.length)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tag ID or Request ID is required.'
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
        statusMessage: 'Supabase server configuration is missing.'
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Verify Admin
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
        statusMessage: 'Unauthorized. Admin access required.'
      })
    }

    let adminRecord: { ADMIN_ID: string } | null = null

    const { data: byAdminId } = await supabaseAdmin
      .from('ADMIN')
      .select('ADMIN_ID')
      .eq('ADMIN_ID', callerId)
      .maybeSingle()

    if (byAdminId) {
      adminRecord = byAdminId
    } else {
      try {
        const { data: byAccountId } = await supabaseAdmin
          .from('ADMIN')
          .select('ADMIN_ID')
          .eq('ACCOUNT_ID', callerId)
          .maybeSingle()
        if (byAccountId) {
          adminRecord = byAccountId
        }
      } catch {}
    }

    if (!adminRecord) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden. Admin privileges required.'
      })
    }

    let query = supabaseAdmin.from('TAG_REQUEST').update({
      Status: 'Rejected',
      Reviewed_at: new Date().toISOString(),
      Reviewed_by: adminRecord.ADMIN_ID
    })

    if (tagId) {
      query = query.eq(tagType === 'Genre' ? 'Genre_ID' : 'Instrument_ID', tagId)
    } else if (requestIds && requestIds.length) {
      query = query.in('Request_ID', requestIds)
    } else if (requestId) {
      query = query.eq('Request_ID', requestId)
    }

    const { data: updatedRequests, error: reqErr } = await query.select('ACCOUNT_ID, Tag_Name')
    if (reqErr) throw reqErr

    if (updatedRequests && updatedRequests.length > 0) {
      for (const req of updatedRequests) {
        if (req.ACCOUNT_ID) {
          try {
            await supabaseAdmin.from('NOTIFICATION').insert({
              Account_ID: req.ACCOUNT_ID,
              Type: 'tag_rejected',
              Title: 'Custom Tag Not Approved',
              Content: `Your requested tag "${req.Tag_Name || 'Custom Tag'}" was not approved by moderation.`,
              Is_Read: false,
              Created_At: new Date().toISOString()
            })
          } catch (notifErr) {
            console.warn('Failed to insert rejection notification:', notifErr)
          }
        }
      }
    }

    return {
      success: true,
      message: 'Tag request rejected.'
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('reject tag error:', err)
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to reject tag.'
    })
  }
})
