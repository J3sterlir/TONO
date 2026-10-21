import { ref, computed } from 'vue'

export interface SongItem {
  Song_ID: string
  ARTIST_ID: string
  Title: string
  Description?: string | null
  Genre?: string | null
  File_URL: string
  Storage_Path?: string
  Duration: number
  Play_Count: number
  Like_Count: number
  Created_at: string
  Expires_at: string
  Is_Expired?: boolean
  artistName?: string
  artistAvatar?: string | null
  artistUsername?: string
  artistCity?: string
  userHasLiked?: boolean
}

// Global player state (single audio instance across app)
const currentSong = ref<SongItem | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const songDuration = ref(60)
const activeListenSeconds = ref(0)
const verifiedPlayCounted = ref(false)
const isMiniPlayerVisible = ref(false)
let globalAudioElement: HTMLAudioElement | null = null
let wallClockTimer: any = null

export const useTonoSongs = () => {
  const supabase = useSupabaseClient()
  const db = supabase as any
  const currentUser = useSupabaseUser()

  const topListenedSongs = ref<SongItem[]>([])
  const topLikedSongs = ref<SongItem[]>([])
  const myArtistSongs = ref<SongItem[]>([])
  const isLoading = ref(false)

  // Progress towards 30 seconds threshold (0 - 100%)
  const playProgressRing = computed(() => {
    return Math.min(100, Math.round((activeListenSeconds.value / 30) * 100))
  })

  // Initialize or get the HTMLAudioElement
  const getAudioElement = () => {
    if (import.meta.server) return null
    if (!globalAudioElement) {
      globalAudioElement = new Audio()
      globalAudioElement.preload = 'metadata'

      globalAudioElement.addEventListener('timeupdate', () => {
        if (globalAudioElement) {
          currentTime.value = globalAudioElement.currentTime
          if (globalAudioElement.duration && !isNaN(globalAudioElement.duration)) {
            songDuration.value = globalAudioElement.duration
          }
        }
      })

      globalAudioElement.addEventListener('play', () => {
        isPlaying.value = true
        startWallClockTracking()
      })

      globalAudioElement.addEventListener('pause', () => {
        isPlaying.value = false
        stopWallClockTracking()
      })

      globalAudioElement.addEventListener('ended', () => {
        isPlaying.value = false
        stopWallClockTracking()
      })

      globalAudioElement.addEventListener('error', (e) => {
        console.warn('[useTonoSongs] Audio playback error:', e)
        isPlaying.value = false
        stopWallClockTracking()
      })
    }
    return globalAudioElement
  }

  // Real wall-clock time tracking for fraud-protected play counts (Authenticated listeners only)
  const startWallClockTracking = () => {
    stopWallClockTracking()
    wallClockTimer = setInterval(async () => {
      if (isPlaying.value && currentSong.value && !verifiedPlayCounted.value) {
        // Omit guests from play count tracking
        if (!currentUser.value) {
          return
        }
        activeListenSeconds.value += 1
        if (activeListenSeconds.value >= 30) {
          verifiedPlayCounted.value = true
          stopWallClockTracking()
          await recordVerifiedPlay(currentSong.value.Song_ID)
        }
      }
    }, 1000)
  }

  const stopWallClockTracking = () => {
    if (wallClockTimer) {
      clearInterval(wallClockTimer)
      wallClockTimer = null
    }
  }

  // Sends verified play request to backend
  const recordVerifiedPlay = async (songId: string) => {
    if (!currentUser.value) return

    try {
      const res: any = await $fetch('/api/songs/play', {
        method: 'POST',
        body: {
          songId,
          durationListenedSeconds: activeListenSeconds.value
        }
      })
      if (res?.counted && currentSong.value && currentSong.value.Song_ID === songId) {
        currentSong.value.Play_Count = (currentSong.value.Play_Count || 0) + 1
      }
    } catch (err) {
      console.warn('[useTonoSongs] Error recording verified play:', err)
    }
  }

  /**
   * Play a song (resets tracking timer if switching song)
   */
  const playSong = (song: SongItem) => {
    const audio = getAudioElement()
    if (!audio) return

    // ALWAYS ensure the side player overlay is visible
    isMiniPlayerVisible.value = true

    if (currentSong.value?.Song_ID === song.Song_ID) {
      // If replaying finished song, rewind to start
      if (audio.ended || (audio.duration && audio.currentTime >= audio.duration - 0.5)) {
        audio.currentTime = 0
        currentTime.value = 0
        activeListenSeconds.value = 0
        verifiedPlayCounted.value = false
      }
      togglePlayPause()
      return
    }

    currentSong.value = song
    activeListenSeconds.value = 0
    verifiedPlayCounted.value = false
    currentTime.value = 0
    songDuration.value = song.Duration || 60

    // If userHasLiked is not set, resolve it in the background for this song
    if (song.userHasLiked === undefined) {
      resolveCurrentUserId().then(async (uid) => {
        if (uid && currentSong.value?.Song_ID === song.Song_ID) {
          const { data: likeRecord } = await db
            .from('SONG_LIKES')
            .select('Like_ID')
            .eq('Song_ID', song.Song_ID)
            .eq('ACCOUNT_ID', uid)
            .maybeSingle()
          if (currentSong.value?.Song_ID === song.Song_ID) {
            currentSong.value.userHasLiked = !!likeRecord
            song.userHasLiked = !!likeRecord
          }
        }
      }).catch(() => {})
    }

    audio.src = song.File_URL
    audio.load()
    audio.play().catch((err) => {
      console.warn('[useTonoSongs] Auto-play was prevented:', err)
    })
  }

  const togglePlayPause = () => {
    const audio = getAudioElement()
    if (!audio || !currentSong.value) return

    // ALWAYS ensure the side player overlay is visible
    isMiniPlayerVisible.value = true

    if (audio.paused) {
      if (audio.ended || (audio.duration && audio.currentTime >= audio.duration - 0.5)) {
        audio.currentTime = 0
        currentTime.value = 0
      }
      audio.play().catch((err) => console.warn(err))
    } else {
      audio.pause()
    }
  }

  const replaySong = () => {
    const audio = getAudioElement()
    if (!audio || !currentSong.value) return
    isMiniPlayerVisible.value = true
    audio.currentTime = 0
    currentTime.value = 0
    activeListenSeconds.value = 0
    verifiedPlayCounted.value = false
    audio.play().catch((err) => console.warn(err))
  }

  const seekTo = (seconds: number) => {
    const audio = getAudioElement()
    if (!audio) return
    audio.currentTime = seconds
    currentTime.value = seconds
    // Fast-forwarding does NOT increment wall-clock activeListenSeconds
  }

  const closePlayer = () => {
    const audio = getAudioElement()
    if (audio) {
      audio.pause()
    }
    stopWallClockTracking()
    isPlaying.value = false
    isMiniPlayerVisible.value = false
  }

  /**
   * Robust authenticated user resolution (avoids undefined accountId)
   */
  const resolveCurrentUserId = async (): Promise<string | null> => {
    if (currentUser.value?.id) return currentUser.value.id
    if ((currentUser.value as any)?.sub) return (currentUser.value as any).sub

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user?.id) return userData.user.id
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData?.session?.user?.id) return sessionData.session.user.id
    } catch {
      // Non-blocking
    }
    return null
  }

  /**
   * Toggle Like on a song (Robust for all account roles: user, artist, business)
   */
  const toggleSongLike = async (songId: string) => {
    const userId = await resolveCurrentUserId()
    if (!userId) {
      await navigateTo('/Login')
      return false
    }

    // Find song in any loaded lists
    const targetSong =
      (currentSong.value?.Song_ID === songId ? currentSong.value : null) ||
      topListenedSongs.value.find((s) => s.Song_ID === songId) ||
      topLikedSongs.value.find((s) => s.Song_ID === songId) ||
      myArtistSongs.value.find((s) => s.Song_ID === songId)

    // Check DB state if userHasLiked is not set
    let isCurrentlyLiked = targetSong?.userHasLiked
    if (isCurrentlyLiked === undefined) {
      const { data: existingLike } = await db
        .from('SONG_LIKES')
        .select('Like_ID')
        .eq('Song_ID', songId)
        .eq('ACCOUNT_ID', userId)
        .maybeSingle()
      isCurrentlyLiked = !!existingLike
      if (targetSong) {
        targetSong.userHasLiked = isCurrentlyLiked
      }
    }

    const prevLiked = isCurrentlyLiked
    const prevCount = targetSong?.Like_Count ?? 0

    // Optimistic UI update
    if (targetSong) {
      targetSong.userHasLiked = !prevLiked
      targetSong.Like_Count = Math.max(0, prevCount + (!prevLiked ? 1 : -1))
    }

    try {
      if (prevLiked) {
        const { error: delErr } = await db
          .from('SONG_LIKES')
          .delete()
          .eq('Song_ID', songId)
          .eq('ACCOUNT_ID', userId)
        if (delErr) throw delErr
      } else {
        const { error: insErr } = await db.from('SONG_LIKES').insert({
          Song_ID: songId,
          ACCOUNT_ID: userId
        })
        if (insErr && insErr.code !== '23505') throw insErr
      }
      return !prevLiked
    } catch (err) {
      console.error('[useTonoSongs] toggleSongLike error:', err)
      // Rollback
      if (targetSong) {
        targetSong.userHasLiked = prevLiked
        targetSong.Like_Count = prevCount
      }
      throw err
    }
  }

  /**
   * Fetch Music Leaderboards (Most Listened & Most Liked)
   */
  const fetchLeaderboards = async (scope: 'local' | 'all' = 'all', userCity?: string) => {
    isLoading.value = true
    try {
      let listenedQuery = db
        .from('SONG')
        .select(`
          Song_ID,
          ARTIST_ID,
          Title,
          Description,
          Genre,
          File_URL,
          Duration,
          Play_Count,
          Like_Count,
          Created_at,
          Expires_at,
          Is_Expired,
          ARTIST!inner (
            ACCOUNT_ID,
            Artist_Type,
            SOLO_ARTIST ( Artist_Name ),
            BAND ( Band_Name ),
            USER_ACCOUNT!inner (
              Username,
              City,
              Profile_Picture
            )
          )
        `)
        .eq('Is_Expired', false)
        .order('Play_Count', { ascending: false })
        .limit(10)

      let likedQuery = db
        .from('SONG')
        .select(`
          Song_ID,
          ARTIST_ID,
          Title,
          Description,
          Genre,
          File_URL,
          Duration,
          Play_Count,
          Like_Count,
          Created_at,
          Expires_at,
          Is_Expired,
          ARTIST!inner (
            ACCOUNT_ID,
            Artist_Type,
            SOLO_ARTIST ( Artist_Name ),
            BAND ( Band_Name ),
            USER_ACCOUNT!inner (
              Username,
              City,
              Profile_Picture
            )
          )
        `)
        .eq('Is_Expired', false)
        .order('Like_Count', { ascending: false })
        .limit(10)

      if (scope === 'local' && userCity) {
        listenedQuery = listenedQuery.eq('ARTIST.USER_ACCOUNT.City', userCity)
        likedQuery = likedQuery.eq('ARTIST.USER_ACCOUNT.City', userCity)
      }

      const [{ data: listenedData }, { data: likedData }] = await Promise.all([
        listenedQuery,
        likedQuery
      ])

      const mapSong = (row: any): SongItem => {
        const artist = row.ARTIST
        const userAcc = artist?.USER_ACCOUNT
        const artistName =
          artist?.BAND?.Band_Name ||
          artist?.SOLO_ARTIST?.Artist_Name ||
          userAcc?.Username ||
          'Artist'

        return {
          Song_ID: row.Song_ID,
          ARTIST_ID: row.ARTIST_ID,
          Title: row.Title,
          Description: row.Description,
          Genre: row.Genre,
          File_URL: row.File_URL,
          Duration: row.Duration || 60,
          Play_Count: row.Play_Count || 0,
          Like_Count: row.Like_Count || 0,
          Created_at: row.Created_at,
          Expires_at: row.Expires_at,
          Is_Expired: row.Is_Expired,
          artistName,
          artistAvatar: userAcc?.Profile_Picture || null,
          artistUsername: userAcc?.Username || '',
          artistCity: userAcc?.City || '',
          userHasLiked: false
        }
      }

      const mappedListened = (listenedData || []).map(mapSong)
      const mappedLiked = (likedData || []).map(mapSong)

      // Check current user liked status
      const authUid = await resolveCurrentUserId()
      if (authUid) {
        const allIds = Array.from(
          new Set([...mappedListened.map((s: SongItem) => s.Song_ID), ...mappedLiked.map((s: SongItem) => s.Song_ID)])
        )
        if (allIds.length > 0) {
          const { data: myLikes } = await db
            .from('SONG_LIKES')
            .select('Song_ID')
            .eq('ACCOUNT_ID', authUid)
            .in('Song_ID', allIds)

          const likedSet = new Set((myLikes || []).map((l: any) => l.Song_ID))
          mappedListened.forEach((s: SongItem) => (s.userHasLiked = likedSet.has(s.Song_ID)))
          mappedLiked.forEach((s: SongItem) => (s.userHasLiked = likedSet.has(s.Song_ID)))
        }
      }

      topListenedSongs.value = mappedListened
      topLikedSongs.value = mappedLiked
    } catch (err) {
      console.error('[useTonoSongs] fetchLeaderboards error:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch custom songs uploaded by an artist (for Portfolio tab)
   */
  const fetchArtistSongs = async (artistId: string) => {
    if (!artistId) return []
    try {
      const { data, error } = await db
        .from('SONG')
        .select('*')
        .eq('ARTIST_ID', artistId)
        .eq('Is_Expired', false)
        .order('Created_at', { ascending: false })

      if (error) throw error

      myArtistSongs.value = (data || []).map((row: any) => ({
        Song_ID: row.Song_ID,
        ARTIST_ID: row.ARTIST_ID,
        Title: row.Title,
        Description: row.Description,
        Genre: row.Genre,
        File_URL: row.File_URL,
        Storage_Path: row.Storage_Path,
        Duration: row.Duration || 60,
        Play_Count: row.Play_Count || 0,
        Like_Count: row.Like_Count || 0,
        Created_at: row.Created_at,
        Expires_at: row.Expires_at,
        Is_Expired: row.Is_Expired
      }))

      return myArtistSongs.value
    } catch (err) {
      console.error('[useTonoSongs] fetchArtistSongs error:', err)
      return []
    }
  }

  /**
   * Upload an artist song to 'songs' bucket and record in SONG table
   * Enforces 4-song limit per artist
   */
  const uploadArtistSong = async (payload: {
    artistId: string
    title: string
    description?: string
    genre?: string
    audioBlob: Blob
    durationSeconds: number
  }) => {
    // 1. Robust authenticated user resolution (avoids undefined accountId)
    const {
      data: { user: sessionUser },
      error: authErr
    } = await supabase.auth.getUser()

    const resolvedUser = sessionUser || currentUser.value
    const accountId = resolvedUser?.id || (resolvedUser as any)?.sub

    if (authErr || !accountId) {
      throw new Error('Authentication required: please log in to upload songs.')
    }

    // 2. Resolve artist ID if missing
    let targetArtistId = payload.artistId
    if (!targetArtistId) {
      const { data: artistProfile } = await db
        .from('ARTIST')
        .select('ARTIST_ID')
        .eq('ACCOUNT_ID', accountId)
        .maybeSingle()
      if (artistProfile?.ARTIST_ID) {
        targetArtistId = artistProfile.ARTIST_ID
      }
    }

    if (!targetArtistId) {
      throw new Error('Artist profile could not be found for this account.')
    }

    // 3. Check current song count (Max 4 tracks)
    const { count, error: countErr } = await db
      .from('SONG')
      .select('*', { count: 'exact', head: true })
      .eq('ARTIST_ID', targetArtistId)
      .eq('Is_Expired', false)

    if (countErr) throw countErr
    if ((count || 0) >= 4) {
      throw new Error('Maximum capacity reached: Artists can upload up to 4 custom tracks.')
    }

    const isMp3Blob = payload.audioBlob.type === 'audio/mpeg' || payload.audioBlob.type.includes('mp3')
    const fileExt = isMp3Blob ? 'mp3' : 'wav'
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`
    const storagePath = `${accountId}/${fileName}`

    // 4. Upload to storage bucket 'songs'
    const uploadContentType = payload.audioBlob.type || (isMp3Blob ? 'audio/mpeg' : 'audio/wav')
    const { error: uploadErr } = await supabase.storage
      .from('songs')
      .upload(storagePath, payload.audioBlob, {
        contentType: uploadContentType,
        upsert: false
      })

    if (uploadErr) {
      throw new Error(`Storage upload failed: ${uploadErr.message}`)
    }

    // 5. Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('songs')
      .getPublicUrl(storagePath)

    const fileUrl = publicUrlData?.publicUrl
    if (!fileUrl) throw new Error('Could not retrieve public URL for uploaded audio.')

    // 6. Insert into SONG table
    const { data: newSongRow, error: insertErr } = await db
      .from('SONG')
      .insert({
        ARTIST_ID: targetArtistId,
        Title: payload.title.trim(),
        Description: payload.description?.trim() || null,
        Genre: payload.genre?.trim() || null,
        File_URL: fileUrl,
        Storage_Path: storagePath,
        Duration: Math.min(60.0, Number(payload.durationSeconds.toFixed(1))),
        File_Size_Bytes: payload.audioBlob.size
      })
      .select()
      .single()

    if (insertErr) {
      // Cleanup uploaded file on DB insert failure
      await supabase.storage.from('songs').remove([storagePath]).catch(() => {})
      throw insertErr
    }

    await fetchArtistSongs(targetArtistId)
    return newSongRow
  }

  /**
   * Delete an uploaded artist song
   */
  const deleteArtistSong = async (songId: string, storagePath?: string) => {
    if (storagePath) {
      await supabase.storage.from('songs').remove([storagePath]).catch(() => {})
    }
    const { error } = await db.from('SONG').delete().eq('Song_ID', songId)
    if (error) throw error

    myArtistSongs.value = myArtistSongs.value.filter((s) => s.Song_ID !== songId)
    if (currentSong.value?.Song_ID === songId) {
      closePlayer()
    }
    return true
  }

  /**
   * Download a song file
   */
  const downloadSong = (fileUrl: string, title: string) => {
    if (!fileUrl) return
    const a = document.createElement('a')
    a.href = fileUrl
    const isMp3 = fileUrl.toLowerCase().includes('.mp3')
    a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${isMp3 ? 'mp3' : 'wav'}`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return {
    currentSong,
    isPlaying,
    currentTime,
    songDuration,
    activeListenSeconds,
    playProgressRing,
    isMiniPlayerVisible,
    topListenedSongs,
    topLikedSongs,
    myArtistSongs,
    isLoading,
    playSong,
    togglePlayPause,
    replaySong,
    seekTo,
    closePlayer,
    toggleSongLike,
    fetchLeaderboards,
    fetchArtistSongs,
    uploadArtistSong,
    deleteArtistSong,
    downloadSong
  }
}
