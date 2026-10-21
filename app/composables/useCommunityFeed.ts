import { ref } from 'vue'
import { useSocialFollow } from './useSocialFollow'

export interface CommunityPostItem {
  POST_ID: string
  ARTIST_ID?: string | null
  BUSINESS_ID?: string | null
  Caption?: string | null
  Media?: string | null
  Location?: string | null
  Created_at: string
  likeCount: number
  commentCount: number
  userHasLiked: boolean
  authorName: string
  authorAvatar?: string | null
  authorUsername: string
  authorAccountId: string
  authorRoute: string
  authorType: 'artist' | 'business'
  isFollowing: boolean
  isOwnPost: boolean
}

export const useCommunityFeed = () => {
  const supabase = useSupabaseClient()
  const db = supabase as any
  const currentUser = useSupabaseUser()
  const { isFollowingMap, toggleFollow: socialToggleFollow } = useSocialFollow()

  const feedPosts = ref<CommunityPostItem[]>([])
  const isLoading = ref(false)
  const isRefreshing = ref(false)
  const hasMore = ref(true)

  /**
   * Helper to format raw database post rows into CommunityPostItem
   */
  const formatPostRow = (
    row: any,
    currentUserId?: string | null,
    userLikedPostIds?: Set<string>
  ): CommunityPostItem => {
    const isArtist = Boolean(row.ARTIST)
    let authorName = 'Creator'
    let authorAvatar: string | null = null
    let authorUsername = ''
    let authorAccountId = ''
    let authorRoute = '/'
    let authorType: 'artist' | 'business' = 'artist'

    if (isArtist) {
      const artist = row.ARTIST
      const userAcc = artist?.USER_ACCOUNT
      authorName =
        artist?.BAND?.Band_Name ||
        artist?.SOLO_ARTIST?.Artist_Name ||
        userAcc?.Username ||
        'Artist'
      authorAvatar = userAcc?.Profile_Picture || null
      authorUsername = userAcc?.Username || ''
      authorAccountId = artist?.ACCOUNT_ID || userAcc?.ACCOUNT_ID || row.ARTIST_ID || ''
      authorRoute = authorUsername ? `/artist/${authorUsername}` : '/artist'
      authorType = 'artist'
    } else {
      const biz = Array.isArray(row.BUSINESS_PROFILE) ? row.BUSINESS_PROFILE[0] : row.BUSINESS_PROFILE
      const userAcc = biz?.USER_ACCOUNT
      authorName = biz?.Business_Name || userAcc?.Username || 'Business Venue'
      authorAvatar = biz?.Profile_Picture || userAcc?.Profile_Picture || null
      authorUsername = userAcc?.Username || ''
      authorAccountId = biz?.ACCOUNT_ID || userAcc?.ACCOUNT_ID || row.BUSINESS_ID || ''
      authorRoute = biz?.BUSINESS_ID ? `/business/${biz.BUSINESS_ID}` : '/business'
      authorType = 'business'
    }

    const likeCount = Array.isArray(row.POST_LIKES)
      ? row.POST_LIKES.length
      : row.POST_LIKES?.count || 0
    const commentCount = Array.isArray(row.POST_COMMENTS)
      ? row.POST_COMMENTS.length
      : row.POST_COMMENTS?.count || 0

    const userHasLiked = Boolean(
      currentUserId && (
        (userLikedPostIds && userLikedPostIds.has(row.POST_ID)) ||
        (Array.isArray(row.POST_LIKES) &&
          row.POST_LIKES.some((l: any) =>
            String(l.ACCOUNT_ID || l.account_id || '').toLowerCase() === String(currentUserId).toLowerCase()
          )
        )
      )
    )

    const isFollowing = Boolean(
      authorAccountId &&
      (isFollowingMap.value[authorAccountId] || isFollowingMap.value[authorAccountId.toLowerCase()])
    )
    const isOwnPost = Boolean(currentUserId && authorAccountId && currentUserId.toLowerCase() === authorAccountId.toLowerCase())

    return {
      POST_ID: row.POST_ID,
      ARTIST_ID: row.ARTIST_ID,
      BUSINESS_ID: row.BUSINESS_ID,
      Caption: row.Caption,
      Media: row.Media,
      Location: row.Location,
      Created_at: row.Created_at,
      likeCount,
      commentCount,
      userHasLiked,
      authorName,
      authorAvatar,
      authorUsername,
      authorAccountId,
      authorRoute,
      authorType,
      isFollowing,
      isOwnPost
    }
  }

  /**
   * Universal Post Selector Query with relations
   */
  const buildBaseQuery = () => {
    return db
      .from('POST')
      .select(`
        POST_ID,
        ARTIST_ID,
        BUSINESS_ID,
        Caption,
        Media,
        Location,
        Created_at,
        ARTIST (
          ACCOUNT_ID,
          Artist_Type,
          SOLO_ARTIST ( Artist_Name ),
          BAND ( Band_Name ),
          USER_ACCOUNT (
            ACCOUNT_ID,
            Username,
            City,
            Profile_Picture
          )
        ),
        BUSINESS_PROFILE (
          BUSINESS_ID,
          ACCOUNT_ID,
          Business_Name,
          Profile_Picture,
          USER_ACCOUNT (
            ACCOUNT_ID,
            Username,
            City,
            Profile_Picture
          )
        ),
        POST_LIKES (
          ACCOUNT_ID
        ),
        POST_COMMENTS (
          Comment_ID
        )
      `)
      .order('Created_at', { ascending: false })
  }

  /**
   * Helper to resolve current user ID reliably even before reactive auth state hydrates
   */
  const getUserId = async (): Promise<string | null> => {
    if (currentUser.value?.id) return currentUser.value.id
    try {
      const { data } = await supabase.auth.getUser()
      if (data?.user?.id) {
        return data.user.id
      }
    } catch {}
    return null
  }

  /**
   * Fetches the unified Community feed with 4-Tier Continuous Priority:
   * Tier 1: Posts from followed accounts
   * Tier 2: Posts matching viewer location / tags
   * Tier 3: General discovery posts
   * Tier 4: NEVER-EMPTY FALLBACK: Fetches recent posts from all artists and businesses
   */
  const fetchFeed = async (limit = 25) => {
    isLoading.value = true
    const currentUserId = await getUserId()

    try {
      const rawPosts: any[] = []
      const seenPostIds = new Set<string>()

      // 1. TIER 1: Followed Accounts
      if (currentUserId) {
        const { data: followRows } = await db
          .from('FOLLOW')
          .select('Following_Account_ID')
          .eq('Follower_Account_ID', currentUserId)

        const followedAccountIds = (followRows || []).map((r: any) => r.Following_Account_ID)

        if (followedAccountIds.length > 0) {
          // Sync following map in cache (both raw and lowercase for safe lookup)
          followedAccountIds.forEach((id: string) => {
            isFollowingMap.value[id] = true
            isFollowingMap.value[id.toLowerCase()] = true
          })

          // Resolve followed account IDs to ARTIST_IDs and BUSINESS_IDs on POST table
          const [artistRes, bizRes] = await Promise.all([
            db.from('ARTIST').select('ARTIST_ID').in('ACCOUNT_ID', followedAccountIds),
            db.from('BUSINESS_PROFILE').select('BUSINESS_ID').in('ACCOUNT_ID', followedAccountIds)
          ])

          const followedArtistIds = (artistRes.data || []).map((r: any) => r.ARTIST_ID).filter(Boolean)
          const followedBusinessIds = (bizRes.data || []).map((r: any) => r.BUSINESS_ID).filter(Boolean)

          const orClauses: string[] = []
          if (followedArtistIds.length > 0) {
            orClauses.push(`ARTIST_ID.in.(${followedArtistIds.join(',')})`)
          }
          if (followedBusinessIds.length > 0) {
            orClauses.push(`BUSINESS_ID.in.(${followedBusinessIds.join(',')})`)
          }

          if (orClauses.length > 0) {
            const { data: tier1Posts, error: tier1Err } = await buildBaseQuery()
              .or(orClauses.join(','))
              .limit(15)

            if (!tier1Err && tier1Posts && tier1Posts.length > 0) {
              for (const p of tier1Posts) {
                if (!seenPostIds.has(p.POST_ID)) {
                  seenPostIds.add(p.POST_ID)
                  rawPosts.push(p)
                }
              }
            }
          }
        }
      }

      // 2. TIER 2: Viewer Location Matches (Proximity)
      let viewerCity: string | null = null
      if (currentUserId) {
        const { data: userRow } = await db
          .from('USER_ACCOUNT')
          .select('City')
          .eq('ACCOUNT_ID', currentUserId)
          .maybeSingle()
        viewerCity = userRow?.City || null
      }

      if (viewerCity && rawPosts.length < limit) {
        const { data: tier2Posts } = await buildBaseQuery()
          .ilike('Location', `%${viewerCity}%`)
          .limit(10)

        if (tier2Posts && tier2Posts.length > 0) {
          for (const p of tier2Posts) {
            if (!seenPostIds.has(p.POST_ID)) {
              seenPostIds.add(p.POST_ID)
              rawPosts.push(p)
            }
          }
        }
      }

      // 3. TIER 3 & 4: NEVER-EMPTY FALLBACK
      // If previous tiers returned fewer than target limit, fetch from ALL artists and businesses
      if (rawPosts.length < limit) {
        const remainingLimit = limit - rawPosts.length
        const { data: fallbackPosts } = await buildBaseQuery().limit(remainingLimit + 10)

        if (fallbackPosts && fallbackPosts.length > 0) {
          for (const p of fallbackPosts) {
            if (!seenPostIds.has(p.POST_ID)) {
              seenPostIds.add(p.POST_ID)
              rawPosts.push(p)
            }
          }
        }
      }

      // Authoritative check on POST_LIKES for current user across collected posts
      let userLikedPostIds = new Set<string>()
      if (currentUserId && rawPosts.length > 0) {
        const postIds = rawPosts.map((p) => p.POST_ID)
        const { data: userLikes } = await db
          .from('POST_LIKES')
          .select('POST_ID')
          .eq('ACCOUNT_ID', currentUserId)
          .in('POST_ID', postIds)

        if (userLikes && userLikes.length > 0) {
          userLikedPostIds = new Set(userLikes.map((l: any) => l.POST_ID))
        }
      }

      const collectedPosts: CommunityPostItem[] = rawPosts.map((p) =>
        formatPostRow(p, currentUserId, userLikedPostIds)
      )

      feedPosts.value = collectedPosts
      hasMore.value = collectedPosts.length >= limit
    } catch (err) {
      console.error('[useCommunityFeed] fetchFeed error:', err)
    } finally {
      isLoading.value = false
      isRefreshing.value = false
    }
  }

  /**
   * Refreshes the feed
   */
  const refreshFeed = async () => {
    isRefreshing.value = true
    await fetchFeed()
  }

  /**
   * Synchronizes like and follow states for already-loaded posts if auth session finishes hydrating
   */
  const syncUserLikes = async () => {
    const currentUserId = await getUserId()
    if (!currentUserId || feedPosts.value.length === 0) return

    try {
      const postIds = feedPosts.value.map((p) => p.POST_ID)
      const authorIds = Array.from(
        new Set(feedPosts.value.map((p) => p.authorAccountId).filter(Boolean))
      )

      const [likesRes, followsRes] = await Promise.all([
        db
          .from('POST_LIKES')
          .select('POST_ID')
          .eq('ACCOUNT_ID', currentUserId)
          .in('POST_ID', postIds),
        authorIds.length > 0
          ? db
              .from('FOLLOW')
              .select('Following_Account_ID')
              .eq('Follower_Account_ID', currentUserId)
              .in('Following_Account_ID', authorIds)
          : Promise.resolve({ data: [] })
      ])

      const likedSet = new Set((likesRes.data || []).map((l: any) => l.POST_ID))
      const followSet = new Set(
        (followsRes.data || []).map((f: any) => String(f.Following_Account_ID).toLowerCase())
      )

      feedPosts.value.forEach((p) => {
        p.userHasLiked = likedSet.has(p.POST_ID)
        if (p.authorAccountId) {
          const isF = followSet.has(p.authorAccountId.toLowerCase())
          p.isFollowing = isF
          isFollowingMap.value[p.authorAccountId] = isF
          isFollowingMap.value[p.authorAccountId.toLowerCase()] = isF
        }
      })
    } catch (err) {
      console.warn('[useCommunityFeed] syncUserLikes warning:', err)
    }
  }

  /**
   * Toggle Like on a feed post via atomic server endpoint
   */
  const toggleLike = async (postId: string) => {
    const currentUserId = await getUserId()
    if (!currentUserId) {
      await navigateTo('/Login')
      return
    }
    const post = feedPosts.value.find((p) => p.POST_ID === postId)
    if (!post) return

    const prevLiked = post.userHasLiked
    const prevCount = post.likeCount

    // Optimistic toggle
    post.userHasLiked = !prevLiked
    post.likeCount = Math.max(0, prevCount + (!prevLiked ? 1 : -1))

    try {
      const response = await $fetch<{
        success: boolean
        userHasLiked: boolean
        likeCount: number
      }>('/api/posts/like', {
        method: 'POST',
        body: { postId }
      })

      if (response && response.success) {
        post.userHasLiked = response.userHasLiked
        post.likeCount = response.likeCount
      }
    } catch (err) {
      console.error('[useCommunityFeed] toggleLike error:', err)
      // Rollback on genuine network/server error
      post.userHasLiked = prevLiked
      post.likeCount = prevCount
    }
  }

  /**
   * Toggles follow / unfollow for a creator, immediately updating all their posts in the feed on click
   */
  const toggleFollow = async (targetAccountId: string) => {
    if (!targetAccountId) return
    const currentUserId = await getUserId()
    if (!currentUserId) {
      await navigateTo('/Login')
      return
    }

    const cleanTargetId = targetAccountId.trim()

    // Find all matching posts by this author/creator in the feed
    const matchingPosts = feedPosts.value.filter(
      (p) =>
        (p.authorAccountId && p.authorAccountId.toLowerCase() === cleanTargetId.toLowerCase()) ||
        (p.ARTIST_ID && p.ARTIST_ID.toLowerCase() === cleanTargetId.toLowerCase()) ||
        (p.BUSINESS_ID && p.BUSINESS_ID.toLowerCase() === cleanTargetId.toLowerCase())
    )

    // Current state: prefer post's current state if present, otherwise check isFollowingMap
    const currentStatus =
      matchingPosts[0]?.isFollowing ??
      Boolean(
        isFollowingMap.value[cleanTargetId] ||
        isFollowingMap.value[cleanTargetId.toLowerCase()]
      )

    const nextStatus = !currentStatus

    // 1. Instant optimistic update on click (no refresh needed)
    matchingPosts.forEach((p) => {
      p.isFollowing = nextStatus
    })
    isFollowingMap.value[cleanTargetId] = nextStatus
    isFollowingMap.value[cleanTargetId.toLowerCase()] = nextStatus

    try {
      const res = await socialToggleFollow(cleanTargetId)
      const confirmedStatus =
        typeof res?.isFollowing === 'boolean' ? res.isFollowing : nextStatus

      // Sync confirmed state from server
      matchingPosts.forEach((p) => {
        p.isFollowing = confirmedStatus
      })
      isFollowingMap.value[cleanTargetId] = confirmedStatus
      isFollowingMap.value[cleanTargetId.toLowerCase()] = confirmedStatus
    } catch (err) {
      console.error('[useCommunityFeed] toggleFollow error, rolling back:', err)
      // Rollback on failure
      matchingPosts.forEach((p) => {
        p.isFollowing = currentStatus
      })
      isFollowingMap.value[cleanTargetId] = currentStatus
      isFollowingMap.value[cleanTargetId.toLowerCase()] = currentStatus
    }
  }

  /**
   * Updates comment count locally when comment added in modal
   */
  const incrementCommentCount = (postId: string) => {
    const post = feedPosts.value.find((p) => p.POST_ID === postId)
    if (post) {
      post.commentCount += 1
    }
  }

  return {
    feedPosts,
    isLoading,
    isRefreshing,
    hasMore,
    fetchFeed,
    refreshFeed,
    syncUserLikes,
    toggleLike,
    toggleFollow,
    incrementCommentCount,
    isFollowingMap
  }
}
