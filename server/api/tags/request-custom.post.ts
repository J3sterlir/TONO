import { createClient } from '@supabase/supabase-js'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { tagName, tagType } = body

    if (!tagName || typeof tagName !== 'string' || !tagName.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tag name is required.'
      })
    }

    if (tagType !== 'Genre' && tagType !== 'Instrument') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid tag type. Must be "Genre" or "Instrument".'
      })
    }

    const trimmedName = tagName.trim().toUpperCase()
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

    // Authenticate caller (session or Bearer token)
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
        statusMessage: 'Unauthorized. Please log in to request custom tags.'
      })
    }

    const tableName = tagType === 'Genre' ? 'TAG_GENRE' : 'TAG_INSTRUMENT'
    const idCol = tagType === 'Genre' ? 'Genre_ID' : 'Instrument_ID'

    // Check if tag already exists in catalog (either by Normalized_Name or case-insensitive Name)
    const { data: existingTags, error: searchErr } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .or(`Normalized_Name.eq."${normalized}",Name.ilike."${trimmedName}"`)

    if (searchErr) {
      console.warn('Search existing tag error:', searchErr.message)
    }

    const existingTag = existingTags?.[0]

    if (existingTag) {
      // 1. If it's already active in the catalog, it's already present!
      if (existingTag.Is_active) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Tag is already present'
        })
      }

      // 2. If it exists but is inactive (pending), check if THIS user already requested it
      const { data: userExistingRequest } = await supabaseAdmin
        .from('TAG_REQUEST')
        .select('Request_ID, Status')
        .eq('ACCOUNT_ID', callerId)
        .eq(tagType === 'Genre' ? 'Genre_ID' : 'Instrument_ID', existingTag[idCol])
        .maybeSingle()

      if (userExistingRequest) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Tag is already present'
        })
      }

      // Caller hasn't requested it yet, so increment universal Request_Count and link request!
      const currentCount = Number(existingTag.Request_Count || 1)
      await supabaseAdmin
        .from(tableName)
        .update({ Request_Count: currentCount + 1 })
        .eq(idCol, existingTag[idCol])

      // Insert new request record for this user
      await supabaseAdmin
        .from('TAG_REQUEST')
        .insert({
          ACCOUNT_ID: callerId,
          Type: tagType,
          Tag_Name: existingTag.Name || trimmedName,
          Normalized_Name: normalized,
          Status: 'Pending',
          [tagType === 'Genre' ? 'Genre_ID' : 'Instrument_ID']: existingTag[idCol]
        })

      return {
        success: true,
        isNew: false,
        message: 'Tag request registered and counter updated.',
        tag: {
          id: existingTag[idCol],
          name: existingTag.Name,
          type: tagType,
          active: false,
          isPending: true,
          requestCount: currentCount + 1
        }
      }
    }

    // Tag does not exist at all yet!
    // Create new inactive tag with Request_Count = 1
    const { data: newTag, error: insertTagErr } = await supabaseAdmin
      .from(tableName)
      .insert({
        Name: trimmedName,
        Normalized_Name: normalized,
        Is_active: false,
        Request_Count: 1
      })
      .select()
      .single()

    if (insertTagErr) {
      // If unique constraint caught it, return "Tag is already present"
      if (insertTagErr.message?.includes('duplicate') || insertTagErr.code === '23505') {
        throw createError({
          statusCode: 400,
          statusMessage: 'Tag is already present'
        })
      }
      throw createError({
        statusCode: 500,
        statusMessage: insertTagErr.message || 'Failed to create tag.'
      })
    }

    // Create the TAG_REQUEST entry
    await supabaseAdmin
      .from('TAG_REQUEST')
      .insert({
        ACCOUNT_ID: callerId,
        Type: tagType,
        Tag_Name: trimmedName,
        Normalized_Name: normalized,
        Status: 'Pending',
        [tagType === 'Genre' ? 'Genre_ID' : 'Instrument_ID']: newTag[idCol]
      })

    return {
      success: true,
      isNew: true,
      message: 'New custom tag requested successfully.',
      tag: {
        id: newTag[idCol],
        name: newTag.Name,
        type: tagType,
        active: false,
        isPending: true,
        requestCount: 1
      }
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('request-custom error:', err)
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'An error occurred while processing custom tag request.'
    })
  }
})
