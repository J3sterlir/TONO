import { createClient } from '@supabase/supabase-js'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { tagId, tagType, requestId } = body

    if (!tagId && !requestId) {
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

    const tableName = tagType === 'Genre' ? 'TAG_GENRE' : 'TAG_INSTRUMENT'
    const idCol = tagType === 'Genre' ? 'Genre_ID' : 'Instrument_ID'

    let resolvedTagId = tagId
    let tagName = ''

    // If resolvedTagId is missing, resolve or activate it from TAG_REQUEST
    if (!resolvedTagId && (requestId || (body.requestIds && body.requestIds.length))) {
      const targetReqId = requestId || body.requestIds[0]
      const { data: reqData } = await supabaseAdmin
        .from('TAG_REQUEST')
        .select('Genre_ID, Instrument_ID, Tag_Name, Normalized_Name')
        .eq('Request_ID', targetReqId)
        .maybeSingle()

      if (reqData) {
        resolvedTagId = tagType === 'Genre' ? reqData.Genre_ID : reqData.Instrument_ID
        if (!resolvedTagId && reqData.Tag_Name) {
          const norm = reqData.Normalized_Name || reqData.Tag_Name.trim().toLowerCase().replace(/\s+/g, ' ')
          const { data: existingTag } = await supabaseAdmin
            .from(tableName)
            .select(idCol)
            .or(`Normalized_Name.eq."${norm}",Name.ilike."${reqData.Tag_Name.trim()}"`)
            .maybeSingle()

          if (existingTag) {
            resolvedTagId = (existingTag as any)[idCol]
          } else {
            const upperTagName = reqData.Tag_Name.trim().toUpperCase()
            const { data: newTag } = await supabaseAdmin
              .from(tableName)
              .insert({
                Name: upperTagName,
                Normalized_Name: norm,
                Is_active: true
              })
              .select(idCol)
              .single()
            if (newTag) {
              resolvedTagId = (newTag as any)[idCol]
            }
          }
        }
      }
    }

    // If tagId is provided or resolved, activate in TAG_GENRE / TAG_INSTRUMENT and ensure Name is ALL CAPS
    if (resolvedTagId) {
      const { data: curTag } = await supabaseAdmin
        .from(tableName)
        .select('Name')
        .eq(idCol, resolvedTagId)
        .maybeSingle()

      const upperName = curTag?.Name ? curTag.Name.trim().toUpperCase() : undefined

      const { data: updatedTag, error: activateErr } = await supabaseAdmin
        .from(tableName)
        .update({ 
          Is_active: true,
          ...(upperName ? { Name: upperName } : {})
        })
        .eq(idCol, resolvedTagId)
        .select()
        .single()

      if (activateErr) throw activateErr
      tagName = updatedTag?.Name || ''
    }

    // Update matching requests to 'Accepted'
    let query = supabaseAdmin.from('TAG_REQUEST').update({
      Status: 'Accepted',
      Reviewed_at: new Date().toISOString(),
      Reviewed_by: adminRecord.ADMIN_ID
    })

    if (resolvedTagId) {
      query = query.eq(tagType === 'Genre' ? 'Genre_ID' : 'Instrument_ID', resolvedTagId)
    } else if (body.requestIds && body.requestIds.length) {
      query = query.in('Request_ID', body.requestIds)
    } else if (requestId) {
      query = query.eq('Request_ID', requestId)
    }

    const { data: updatedRequests, error: reqErr } = await query.select('ACCOUNT_ID, Tag_Name')
    if (reqErr) throw reqErr

    // Send notifications to all requesters
    if (updatedRequests && updatedRequests.length > 0) {
      const finalTagName = tagName || updatedRequests[0]?.Tag_Name || 'Tag'
      for (const req of updatedRequests) {
        if (req.ACCOUNT_ID) {
          try {
            await supabaseAdmin.from('NOTIFICATION').insert({
              Account_ID: req.ACCOUNT_ID,
              Type: 'tag_approved',
              Title: 'Custom Tag Approved',
              Content: `Your requested tag "${finalTagName}" has been approved by admin and is now active in the catalog!`,
              Is_Read: false,
              Created_At: new Date().toISOString()
            })
          } catch (notifErr) {
            console.warn('Failed to insert notification for requester:', notifErr)
          }
        }
      }
    }

    return {
      success: true,
      message: `Tag "${tagName || 'Custom Tag'}" accepted and activated.`
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('accept tag error:', err)
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to accept tag.'
    })
  }
})
