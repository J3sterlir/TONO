import { createClient } from '@supabase/supabase-js'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { songId, durationListenedSeconds, userCity } = body

    if (!songId || typeof songId !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Song ID is required.'
      })
    }

    const duration = Number(durationListenedSeconds)
    // 30-Second Fraud Protection Rule: Reject if active stream time < 30 seconds
    if (isNaN(duration) || duration < 30) {
      return {
        success: false,
        counted: false,
        message: 'Listening duration did not reach the 30-second verified threshold.'
      }
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

    // Resolve listener if authenticated
    let listenerAccountId: string | null = null
    try {
      const user = await serverSupabaseUser(event)
      listenerAccountId = user?.id || (user as any)?.sub || null
    } catch {}

    if (!listenerAccountId) {
      const authHeader = getHeader(event, 'authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim()
        const { data } = await supabaseAdmin.auth.getUser(token)
        listenerAccountId = data?.user?.id || null
      }
    }

    // 0. Rule: Guest / Unauthenticated listeners are strictly omitted from play counts. Prevent guest database entries.
    if (!listenerAccountId) {
      return {
        success: true,
        counted: false,
        reason: 'guest_stream_omitted',
        message: 'Guest plays are omitted from play count.'
      }
    }

    // 1. Fetch song creator's account ID to check for artist self-listens
    const { data: songData } = await supabaseAdmin
      .from('SONG')
      .select('Song_ID, ARTIST:ARTIST_ID(ACCOUNT_ID)')
      .eq('Song_ID', songId)
      .maybeSingle()

    const artistAccountId = (songData?.ARTIST as any)?.ACCOUNT_ID
    const isArtistSelfListen = Boolean(
      listenerAccountId &&
      artistAccountId &&
      listenerAccountId.toLowerCase() === artistAccountId.toLowerCase()
    )

    // 2. Rule: Artists are strictly capped at max 1 lifetime stream for their own uploaded track
    if (isArtistSelfListen) {
      const { count: artistPlayCount } = await supabaseAdmin
        .from('SONG_PLAYS')
        .select('Play_ID', { count: 'exact', head: true })
        .eq('Song_ID', songId)
        .eq('Listener_Account_ID', listenerAccountId)

      if ((artistPlayCount || 0) >= 1) {
        return {
          success: true,
          counted: false,
          reason: 'artist_limit_reached',
          message: 'Artist stream limit reached: creators can only record 1 test stream on their own track.'
        }
      }
    }

    // 3. Rule: Regular users are capped at 1 stream per song per 24 hours (Daily Unique Listener)
    if (listenerAccountId && !isArtistSelfListen) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: recentPlays } = await supabaseAdmin
        .from('SONG_PLAYS')
        .select('Play_ID')
        .eq('Song_ID', songId)
        .eq('Listener_Account_ID', listenerAccountId)
        .gte('Created_at', twentyFourHoursAgo)
        .limit(1)

      if (recentPlays && recentPlays.length > 0) {
        return {
          success: true,
          counted: false,
          reason: 'daily_limit_reached',
          message: 'Daily stream already recorded for this user (Resets in 24 hours).'
        }
      }
    }

    // Insert play record (trigger increments SONG.Play_Count automatically)
    const { error: insertErr } = await supabaseAdmin
      .from('SONG_PLAYS')
      .insert({
        Song_ID: songId,
        Listener_Account_ID: listenerAccountId,
        Duration_Listened_Seconds: Math.round(duration),
        User_City: typeof userCity === 'string' && userCity.trim() ? userCity.trim() : null
      })

    if (insertErr) {
      console.error('[API /api/songs/play] Insert error:', insertErr)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to record play.'
      })
    }

    return {
      success: true,
      counted: true,
      message: 'Verified 30-second play recorded.'
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('[API /api/songs/play] Error:', err)
    throw createError({
      statusCode: 500,
      statusMessage: err?.message || 'Internal server error'
    })
  }
})
