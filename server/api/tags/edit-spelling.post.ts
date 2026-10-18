import { createClient } from '@supabase/supabase-js'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { tagId, tagType, newName } = body

    if (!tagId || !newName || typeof newName !== 'string' || !newName.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tag ID and new name are required.'
      })
    }

    const trimmedName = newName.trim().toUpperCase()
    const normalized = trimmedName.toLowerCase().replace(/\s+/g, ' ')

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

    // Check if another tag in this table already has the same normalized name
    const { data: duplicates } = await supabaseAdmin
      .from(tableName)
      .select(idCol)
      .neq(idCol, tagId)
      .or(`Normalized_Name.eq."${normalized}",Name.ilike."${trimmedName}"`)

    if (duplicates && duplicates.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tag is already present'
      })
    }

    // Update tag in catalog while maintaining the same immutable UUID!
    const { error: updateTagErr } = await supabaseAdmin
      .from(tableName)
      .update({
        Name: trimmedName,
        Normalized_Name: normalized
      })
      .eq(idCol, tagId)

    if (updateTagErr) {
      if (updateTagErr.message?.includes('duplicate') || updateTagErr.code === '23505') {
        throw createError({
          statusCode: 400,
          statusMessage: 'Tag is already present'
        })
      }
      throw updateTagErr
    }

    // Also update all linked TAG_REQUEST records
    await supabaseAdmin
      .from('TAG_REQUEST')
      .update({
        Tag_Name: trimmedName,
        Normalized_Name: normalized
      })
      .eq(tagType === 'Genre' ? 'Genre_ID' : 'Instrument_ID', tagId)

    return {
      success: true,
      name: trimmedName,
      normalized
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('edit-spelling error:', err)
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to update tag spelling.'
    })
  }
})
