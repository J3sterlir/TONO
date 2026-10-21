import { createClient } from '@supabase/supabase-js'
import { serverSupabaseUser } from '#supabase/server'
import { normalizeRole } from '~/utils/roleHelper'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { bandId, memberAccountId, role } = body || {}

    if (!bandId || typeof bandId !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Band ID is required.'
      })
    }

    if (!memberAccountId || typeof memberAccountId !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Member Account ID is required.'
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
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Resolve current authenticated caller
    let currentUserId: string | null = null
    try {
      const user = await serverSupabaseUser(event)
      currentUserId = user?.id || (user as any)?.sub || null
    } catch {}

    if (!currentUserId) {
      const authHeader = getHeader(event, 'authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim()
        const { data } = await supabaseAdmin.auth.getUser(token)
        currentUserId = data?.user?.id || null
      }
    }

    if (!currentUserId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required.'
      })
    }

    // 1. Verify caller cannot invite themselves
    if (currentUserId.toLowerCase() === memberAccountId.toLowerCase()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'You cannot invite yourself to a band.'
      })
    }

    // 2. Fetch caller artist profile & verify artist type is 'Band' (BLOCK Solo artists)
    const { data: callerArtist, error: artistErr } = await supabaseAdmin
      .from('ARTIST')
      .select('ARTIST_ID, ACCOUNT_ID, Artist_Type')
      .eq('ACCOUNT_ID', currentUserId)
      .maybeSingle()

    if (artistErr || !callerArtist) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only registered artists can access band management.'
      })
    }

    // CRITICAL BACKEND ENFORCEMENT: Solo artists CANNOT invite members
    if (callerArtist.Artist_Type !== 'Band') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Solo artists cannot invite members. Only registered Bands can invite members.'
      })
    }

    // 3. Verify caller is the owner of this specific band
    if (callerArtist.ARTIST_ID !== bandId) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Unauthorized: You are not the leader of this band.'
      })
    }

    const { data: bandRecord, error: bandErr } = await supabaseAdmin
      .from('BAND')
      .select('ARTIST_ID, Band_Name')
      .eq('ARTIST_ID', bandId)
      .maybeSingle()

    if (bandErr || !bandRecord) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Band profile not found.'
      })
    }

    // 4. Verify target user account exists
    const { data: targetAccount, error: targetErr } = await supabaseAdmin
      .from('USER_ACCOUNT')
      .select('ACCOUNT_ID, Username')
      .eq('ACCOUNT_ID', memberAccountId)
      .maybeSingle()

    if (targetErr || !targetAccount) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Target artist account not found.'
      })
    }

    // 5. Check if already active or pending
    const { data: existingMember } = await supabaseAdmin
      .from('BAND_MEMBERS')
      .select('Status')
      .eq('Band_ID', bandId)
      .eq('Member_ID', memberAccountId)
      .maybeSingle()

    if (existingMember?.Status === 'Accepted') {
      throw createError({
        statusCode: 400,
        statusMessage: `${targetAccount.Username || 'This artist'} is already an active member of your band.`
      })
    }

    if (existingMember?.Status === 'Pending') {
      throw createError({
        statusCode: 400,
        statusMessage: `An invitation is already pending for ${targetAccount.Username || 'this artist'}.`
      })
    }

    // 6. Normalize role and upsert into BAND_MEMBERS
    const normalizedRole = normalizeRole(role) || 'Member'

    const { error: insertErr } = await supabaseAdmin
      .from('BAND_MEMBERS')
      .upsert({
        Band_ID: bandId,
        Member_ID: memberAccountId,
        Instrument_Role: normalizedRole,
        Status: 'Pending',
        Invited_at: new Date().toISOString(),
        Joined_at: null
      }, { onConflict: 'Band_ID,Member_ID' })

    if (insertErr) {
      throw createError({
        statusCode: 500,
        statusMessage: insertErr.message || 'Failed to send band invitation.'
      })
    }

    return {
      success: true,
      role: normalizedRole,
      bandId,
      memberAccountId
    }
  } catch (err: any) {
    if (err?.statusCode) throw err
    console.error('[API /api/bands/invite] Error:', err)
    throw createError({
      statusCode: err?.statusCode || 500,
      statusMessage: err?.message || 'Failed to send band invitation.'
    })
  }
})
