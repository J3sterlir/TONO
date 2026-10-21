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
  const { isFollowingMap, toggleFollow } = useSocialFollow()

  const feedPosts = ref<CommunityPostItem[]>([])
  const isLoading = ref(false)
  const isRefreshing = ref(false)
  const hasMore = ref(true)

  /**
   * Helper to format raw database post rows into CommunityPostItem
   */
  const formatPostRow = (row: any, currentUserId?: string | null): CommunityPostItem => {
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
      authorAccountId = artist?.ACCOUNT_ID || userAcc?.ACCOUNT_ID || ''
      authorRoute = authorUsername ? `/artist/${authorUsername}` : '/artist'
      authorType = 'artist'
    } else {
      const biz = row.BUSINESS_PROFILE
      const userAcc = biz?.USER_ACCOUNT
      authorName = biz?.Business_Name || userAcc?.Username || 'Business Venue'
      authorAvatar = userAcc?.Profile_Picture || null
      authorUsername = userAcc?.Username || ''
      authorAccountId = biz?.ACCOUNT_ID || userAcc?.ACCOUNT_ID || ''
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
      currentUserId &&
        Array.isArray(row.POST_LIKES) &&
        row.POST_LIKES.some((l: any) => l.ACCOUNT_ID === currentUserId)
    )

    const isFollowing = Boolean(authorAccountId && isFollowingMap.value[authorAccountId])
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
   * Fetches the unified Community feed with 4-Tier Continuous Priority:
   * Tier 1: Posts from followed accounts
   * Tier 2: Posts matching viewer location / tags
   * Tier 3: General discovery posts
   * Tier 4: NEVER-EMPTY FALLBACK: Fetches recent posts from all artists and businesses
   */
  const fetchFeed = async (limit = 25) => {
    isLoading.value = true
    const currentUserId = currentUser.value?.id

    try {
      const collectedPosts: CommunityPostItem[] = []
      const seenPostIds = new Set<string>()

      // 1. TIER 1: Followed Accounts
      if (currentUserId) {
        const { data: followRows } = await db
          .from('FOLLOW')
          .select('Following_Account_ID')
          .eq('Follower_Account_ID', currentUserId)

        const followedAccountIds = (followRows || []).map((r: any) => r.Following_Account_ID)

        if (followedAccountIds.length > 0) {
          // Sync following map in cache
          followedAccountIds.forEach((id: string) => {
            isFollowingMap.value[id] = true
          })

          const { data: tier1Posts } = await buildBaseQuery()
            .or(
              `ARTIST.ACCOUNT_ID.in.(${followedAccountIds.join(',')}),BUSINESS_PROFILE.ACCOUNT_ID.in.(${followedAccountIds.join(',')})`
            )
            .limit(15)

          if (tier1Posts && tier1Posts.length > 0) {
            for (const p of tier1Posts) {
              if (!seenPostIds.has(p.POST_ID)) {
                seenPostIds.add(p.POST_ID)
                collectedPosts.push(formatPostRow(p, currentUserId))
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

      if (viewerCity && collectedPosts.length < limit) {
        const { data: tier2Posts } = await buildBaseQuery()
          .ilike('Location', `%${viewerCity}%`)
          .limit(10)

        if (tier2Posts && tier2Posts.length > 0) {
          for (const p of tier2Posts) {
            if (!seenPostIds.has(p.POST_ID)) {
              seenPostIds.add(p.POST_ID)
              collectedPosts.push(formatPostRow(p, currentUserId))
            }
          }
        }
      }

      // 3. TIER 3 & 4: NEVER-EMPTY FALLBACK
      // If previous tiers returned fewer than target limit, fetch from ALL artists and businesses
      if (collectedPosts.length < limit) {
        const remainingLimit = limit - collectedPosts.length
        const { data: fallbackPosts } = await buildBaseQuery().limit(remainingLimit + 10)

        if (fallbackPosts && fallbackPosts.length > 0) {
          for (const p of fallbackPosts) {
            if (!seenPostIds.has(p.POST_ID)) {
              seenPostIds.add(p.POST_ID)
              collectedPosts.push(formatPostRow(p, currentUserId))
            }
          }
        }
      }

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
   * Toggle Like on a feed post
   */
  const toggleLike = async (postId: string) => {
    let currentUserId = currentUser.value?.id || (currentUser.value as any)?.sub
    if (!currentUserId) {
      try {
        const { data: userData } = await supabase.auth.getUser()
        currentUserId = userData?.user?.id
      } catch {}
    }
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
      if (prevLiked) {
        const { error } = await db
          .from('POST_LIKES')
          .delete()
          .eq('POST_ID', postId)
          .eq('ACCOUNT_ID', currentUserId)
        if (error) throw error
      } else {
        const { error } = await db.from('POST_LIKES').insert({
          POST_ID: postId,
          ACCOUNT_ID: currentUserId
        })
        if (error && error.code !== '23505') throw error
      }
    } catch (err) {
      console.error('[useCommunityFeed] toggleLike error:', err)
      // Rollback
      post.userHasLiked = prevLiked
      post.likeCount = prevCount
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
    toggleLike,
    toggleFollow,
    incrementCommentCount
  }
}
