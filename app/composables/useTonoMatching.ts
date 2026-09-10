import { ref, computed } from 'vue'

export interface MatchRecommendation {
  user_id: string
  artist_id: string
  display_name: string
  specialty: string
  artist_type: string
  profile_picture: string | null
  cover_picture: string | null
  city: string | null
  barangay: string | null
  matched_location_level: 'Barangay' | 'City' | 'Global'
  genres: string[]
  instruments: string[]
  shared_genres: string[]
  shared_instruments: string[]
  genre_score: number
  instrument_score: number
  total_score: number
  match_tier: 'High' | 'Medium' | 'Low' | 'Unmatched'
}

export const useTonoMatching = () => {
  const supabase = useSupabaseClient()
  const db = supabase as any

  const highMatches = ref<MatchRecommendation[]>([])
  const mediumMatches = ref<MatchRecommendation[]>([])
  const lowMatches = ref<MatchRecommendation[]>([])
  const unmatchedArtists = ref<MatchRecommendation[]>([])
  const allRecommendations = ref<MatchRecommendation[]>([])
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const isLocationFilterActive = ref<boolean>(true)

  const nuxtUser = useSupabaseUser()

  const fetchRecommendations = async (options?: {
    context?: 'discovery' | 'recruitment'
    applyLocationFilter?: boolean
    weightGenre?: number
    weightInstrument?: number
    limit?: number
    userId?: string
  }) => {
    isLoading.value = true
    error.value = null

    const context = options?.context ?? 'discovery'
    const applyLocationFilter = options?.applyLocationFilter !== undefined
      ? options.applyLocationFilter
      : isLocationFilterActive.value
    const limit = options?.limit ?? 50

    try {
      let currentUserId = options?.userId || nuxtUser.value?.id || null

      if (!currentUserId) {
        const { data: sessionData } = await supabase.auth.getSession()
        currentUserId = sessionData.session?.user?.id || null
      }

      if (!currentUserId) {
        const { data: authData } = await supabase.auth.getUser()
        currentUserId = authData.user?.id || null
      }

      console.log('[useTonoMatching] Resolved User ID:', currentUserId, 'Context:', context, 'LocationFilter:', applyLocationFilter)

      const rpcParams: Record<string, any> = {
        p_user_id: currentUserId,
        p_context: context,
        p_apply_location_filter: applyLocationFilter,
        p_limit: limit,
      }

      if (options?.weightGenre !== undefined) {
        rpcParams.p_weight_genre = options.weightGenre
      }
      if (options?.weightInstrument !== undefined) {
        rpcParams.p_weight_instrument = options.weightInstrument
      }

      const { data, error: rpcError } = await db.rpc('tono_match_recommendations', rpcParams)

      if (rpcError) {
        console.error('Error invoking tono_match_recommendations RPC:', rpcError)
        error.value = rpcError.message
        return
      }

      console.log('[useTonoMatching] Candidates returned:', data?.length, data)

      const results: MatchRecommendation[] = (data ?? []).map((row: any) => ({
        user_id: row.user_id,
        artist_id: row.artist_id,
        display_name: row.display_name || 'Artist',
        specialty: row.specialty || (row.artist_type === 'Band' ? 'Band' : 'Musician'),
        artist_type: row.artist_type || 'Solo',
        profile_picture: row.profile_picture || row.Profile_Picture || null,
        cover_picture: row.cover_picture || row.Cover_Picture || null,
        city: row.city || null,
        barangay: row.barangay || null,
        matched_location_level: row.matched_location_level || 'Global',
        genres: row.genres || [],
        instruments: row.instruments || [],
        shared_genres: row.shared_genres || [],
        shared_instruments: row.shared_instruments || [],
        genre_score: Number(row.genre_score) || 0,
        instrument_score: Number(row.instrument_score) || 0,
        total_score: Number(row.total_score) || 0,
        match_tier: row.match_tier || 'Unmatched',
      }))

      allRecommendations.value = results
      highMatches.value = results.filter((r) => r.match_tier === 'High')
      mediumMatches.value = results.filter((r) => r.match_tier === 'Medium')
      lowMatches.value = results.filter((r) => r.match_tier === 'Low')
      unmatchedArtists.value = results.filter((r) => r.match_tier === 'Unmatched')
    } catch (err: any) {
      console.error('Failed to fetch recommendations:', err)
      error.value = err?.message || 'An unexpected error occurred'
    } finally {
      isLoading.value = false
    }
  }

  const toggleLocationFilter = async (options?: {
    context?: 'discovery' | 'recruitment'
    userId?: string
  }) => {
    isLocationFilterActive.value = !isLocationFilterActive.value
    await fetchRecommendations({
      context: options?.context ?? 'discovery',
      applyLocationFilter: isLocationFilterActive.value,
      userId: options?.userId,
    })
  }

  const getTierBadgeClass = (tier: string) => {
    switch (tier) {
      case 'High':
        return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
      case 'Medium':
        return 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
      case 'Low':
        return 'bg-zinc-800 text-zinc-400 border border-zinc-700'
      default:
        return 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/50'
    }
  }

  const getTierAvatarRing = (tier: string) => {
    switch (tier) {
      case 'High':
        return 'ring-2 ring-emerald-500/80 shadow-md shadow-emerald-500/10'
      case 'Medium':
        return 'ring-2 ring-indigo-500/70 shadow-md shadow-indigo-500/10'
      case 'Low':
        return 'ring-1 ring-zinc-700'
      default:
        return 'ring-1 ring-zinc-800'
    }
  }

  const formatScorePercent = (score: number) => {
    return Math.round((Number(score) || 0) * 100)
  }

  const getLocationLabel = (artist: MatchRecommendation) => {
    if (artist.city && artist.barangay) {
      return `${artist.city}, ${artist.barangay}`
    }
    return artist.city || 'Philippines'
  }

  const getArtistAvatarUrl = (artist: MatchRecommendation) => {
    if (artist.profile_picture) return artist.profile_picture
    // SVG avatar fallback with artist initial
    const initial = (artist.display_name || 'A').charAt(0).toUpperCase()
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=1E1E24&color=D0D4F7&bold=true&size=150`
  }

  const getArtistCoverUrl = (artist: MatchRecommendation) => {
    const coverPic = artist.cover_picture || (artist as any).Cover_Picture
    if (coverPic) {
      if (coverPic.startsWith('http://') || coverPic.startsWith('https://') || coverPic.startsWith('/')) {
        return coverPic
      }
      try {
        const { data } = supabase.storage.from('covers').getPublicUrl(coverPic)
        if (data?.publicUrl) return data.publicUrl
      } catch {}
      return coverPic
    }
    const profilePic = artist.profile_picture || (artist as any).Profile_Picture
    if (profilePic) return profilePic
    const text = encodeURIComponent(artist.display_name || 'Artist')
    return `https://placehold.co/800x600/18181B/D0D4F7?text=${text}`
  }

  const totalMatchesCount = computed(() => {
    return highMatches.value.length + mediumMatches.value.length + lowMatches.value.length
  })

  return {
    highMatches,
    mediumMatches,
    lowMatches,
    unmatchedArtists,
    allRecommendations,
    totalMatchesCount,
    isLoading,
    error,
    isLocationFilterActive,
    fetchRecommendations,
    toggleLocationFilter,
    getTierBadgeClass,
    getTierAvatarRing,
    formatScorePercent,
    getLocationLabel,
    getArtistAvatarUrl,
    getArtistCoverUrl,
  }
}
