import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
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

    const now = new Date()
    const nowIso = now.toISOString()

    // 1. Fetch expired songs (Expires_at <= NOW and Is_Expired = FALSE)
    const { data: expiredSongs, error: expiredErr } = await supabaseAdmin
      .from('SONG')
      .select(`
        Song_ID,
        ARTIST_ID,
        Title,
        Genre,
        Storage_Path,
        Play_Count,
        Like_Count,
        Expires_at,
        ARTIST!inner (
          ACCOUNT_ID
        )
      `)
      .lte('Expires_at', nowIso)
      .eq('Is_Expired', false)

    if (expiredErr) {
      console.error('[cleanup-check] Error fetching expired songs:', expiredErr)
    }

    const currentMonthTag = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    if (expiredSongs && expiredSongs.length > 0) {
      for (const song of expiredSongs) {
        // Archive to SONG_MONTHLY_ARCHIVE (Hall of Fame)
        await supabaseAdmin
          .from('SONG_MONTHLY_ARCHIVE')
          .insert({
            Song_ID: song.Song_ID,
            ARTIST_ID: song.ARTIST_ID,
            Title: song.Title,
            Genre: song.Genre,
            Month_Tag: currentMonthTag,
            Final_Play_Count: song.Play_Count || 0,
            Final_Like_Count: song.Like_Count || 0,
            Archived_At: nowIso
          })

        // Delete audio file from storage bucket if storage path exists
        if (song.Storage_Path) {
          try {
            await supabaseAdmin.storage
              .from('songs')
              .remove([song.Storage_Path])
          } catch (e) {
            console.warn('[cleanup-check] Could not remove storage file:', e)
          }
        }

        // Mark song expired in DB
        await supabaseAdmin
          .from('SONG')
          .update({
            Is_Expired: true,
            File_URL: ''
          })
          .eq('Song_ID', song.Song_ID)

        // Notify artist that track completed its monthly lifecycle and is archived in Hall of Fame
        const artistAccId = (song.ARTIST as any)?.ACCOUNT_ID
        if (artistAccId) {
          await supabaseAdmin.from('NOTIFICATION').insert({
            Account_ID: artistAccId,
            Type: 'song_archived',
            Title: 'Track Archived in Hall of Fame',
            Content: `Your track "${song.Title}" reached its 30-day lifecycle with **${song.Play_Count || 0} plays** and is permanently preserved in the **Hall of Fame**!`,
            Action_Link: '/Artistprofile',
            Svg_Type: 'song_archived',
            Avatar_Text: 'TONO',
            Action_Primary: 'View Hall of Fame',
            Entity_ID: song.Song_ID,
            Entity_Type: 'song',
            Metadata: {
              songId: song.Song_ID,
              finalPlays: song.Play_Count,
              finalLikes: song.Like_Count
            },
            Is_Read: false,
            Created_At: nowIso
          })
        }
      }
    }

    // 2. Process expiration warnings for active songs
    // E.g. 5 days, 3 days, 2 days, 1 day warnings
    const { data: activeSongs } = await supabaseAdmin
      .from('SONG')
      .select(`
        Song_ID,
        ARTIST_ID,
        Title,
        Expires_at,
        Warning_5d_Sent,
        Warning_3d_Sent,
        Warning_2d_Sent,
        Warning_1d_Sent,
        ARTIST!inner (
          ACCOUNT_ID
        )
      `)
      .eq('Is_Expired', false)
      .gt('Expires_at', nowIso)

    if (activeSongs && activeSongs.length > 0) {
      for (const song of activeSongs) {
        const expiresAt = new Date(song.Expires_at)
        const diffMs = expiresAt.getTime() - now.getTime()
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        const artistAccId = (song.ARTIST as any)?.ACCOUNT_ID

        if (!artistAccId) continue

        let warningToSend: number | null = null
        const updatePayload: Record<string, boolean> = {}

        if (daysLeft <= 1 && !song.Warning_1d_Sent) {
          warningToSend = 1
          updatePayload.Warning_1d_Sent = true
        } else if (daysLeft <= 2 && !song.Warning_2d_Sent) {
          warningToSend = 2
          updatePayload.Warning_2d_Sent = true
        } else if (daysLeft <= 3 && !song.Warning_3d_Sent) {
          warningToSend = 3
          updatePayload.Warning_3d_Sent = true
        } else if (daysLeft <= 5 && !song.Warning_5d_Sent) {
          warningToSend = 5
          updatePayload.Warning_5d_Sent = true
        }

        if (warningToSend !== null) {
          await supabaseAdmin
            .from('SONG')
            .update(updatePayload)
            .eq('Song_ID', song.Song_ID)

          await supabaseAdmin.from('NOTIFICATION').insert({
            Account_ID: artistAccId,
            Type: 'song_expiring',
            Title: 'Song Expiring Soon',
            Content: `Your track "${song.Title}" expires in **${warningToSend} day${warningToSend > 1 ? 's' : ''}**. Download your track or check your stats before it enters the Hall of Fame!`,
            Action_Link: '/Artistprofile',
            Svg_Type: 'song_expiring',
            Avatar_Text: 'TONO',
            Action_Primary: 'Download Track',
            Entity_ID: song.Song_ID,
            Entity_Type: 'song',
            Metadata: {
              songId: song.Song_ID,
              daysRemaining: warningToSend
            },
            Is_Read: false,
            Created_At: nowIso
          })
        }
      }
    }

    return {
      success: true,
      processedExpired: expiredSongs?.length || 0,
      checkedActive: activeSongs?.length || 0
    }
  } catch (err: any) {
    console.error('[API /api/songs/cleanup-check] Error:', err)
    throw createError({
      statusCode: 500,
      statusMessage: err?.message || 'Cleanup job failed.'
    })
  }
})
