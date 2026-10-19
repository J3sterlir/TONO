import { ref } from 'vue'

export interface MutualFollowersSummary {
  sampleNames: string[]
  totalCount: number
}

// Global reactive caches across pages
const isFollowingMap = ref<Record<string, boolean>>({})
const followerCounts = ref<Record<string, number>>({})
const followingCounts = ref<Record<string, number>>({})
const followsYouMap = ref<Record<string, boolean>>({})
const mutualFollowersMap = ref<Record<string, MutualFollowersSummary>>({})

export const useSocialFollow = () => {
  const supabase = useSupabaseClient()
  const db = supabase as any
  const currentUser = useSupabaseUser()

  /**
   * Toggles follow / unfollow on a target account
   */
  const toggleFollow = async (targetAccountId: string) => {
    if (!currentUser.value) {
      await navigateTo('/Login')
      return { success: false, isFollowing: false }
    }

    const currentId = currentUser.value?.id || (currentUser.value as any)?.sub
    if (!targetAccountId || !currentId || targetAccountId.toLowerCase() === currentId.toLowerCase()) {
      return { success: false, isFollowing: false }
    }

    // Optimistic UI toggle
    const previousState = isFollowingMap.value[targetAccountId] ?? false
    const previousCount = followerCounts.value[targetAccountId] ?? 0
    const nextState = !previousState
    isFollowingMap.value[targetAccountId] = nextState
    followerCounts.value[targetAccountId] = Math.max(0, previousCount + (nextState ? 1 : -1))

    try {
      const response = await $fetch<{
        success: boolean
        isFollowing: boolean
        followerCount: number
      }>('/api/follow/toggle', {
        method: 'POST',
        body: { targetAccountId }
      })

      if (response && response.success) {
        isFollowingMap.value[targetAccountId] = response.isFollowing
        followerCounts.value[targetAccountId] = response.followerCount
        return response
      }
      return { success: true, isFollowing: nextState }
    } catch (err) {
      console.error('[useSocialFollow] toggleFollow error:', err)
      // Rollback on failure
      isFollowingMap.value[targetAccountId] = previousState
      followerCounts.value[targetAccountId] = previousCount
      throw err
    }
  }

  /**
   * Fetches the follower count and following count for an account
   */
  const fetchFollowStats = async (accountId: string) => {
    if (!accountId) return { followers: 0, following: 0 }

    try {
      const [{ count: followers }, { count: following }] = await Promise.all([
        db.from('FOLLOW').select('*', { count: 'exact', head: true }).eq('Following_Account_ID', accountId),
        db.from('FOLLOW').select('*', { count: 'exact', head: true }).eq('Follower_Account_ID', accountId)
      ])

      followerCounts.value[accountId] = followers || 0
      followingCounts.value[accountId] = following || 0

      return {
        followers: followers || 0,
        following: following || 0
      }
    } catch (err) {
      console.error('[useSocialFollow] fetchFollowStats error:', err)
      return { followers: 0, following: 0 }
    }
  }

  /**
   * Checks if current user follows target, and if target follows current user back ("Follows you")
   */
  const fetchFollowStatus = async (targetAccountId: string) => {
    const currentUserId = currentUser.value?.id
    if (!currentUserId || !targetAccountId || currentUserId === targetAccountId) {
      return { isFollowing: false, followsYou: false }
    }

    try {
      const [{ data: isFollowingRow }, { data: followsYouRow }] = await Promise.all([
        db
          .from('FOLLOW')
          .select('Follow_ID')
          .eq('Follower_Account_ID', currentUserId)
          .eq('Following_Account_ID', targetAccountId)
          .maybeSingle(),
        db
          .from('FOLLOW')
          .select('Follow_ID')
          .eq('Follower_Account_ID', targetAccountId)
          .eq('Following_Account_ID', currentUserId)
          .maybeSingle()
      ])

      const isFollowing = Boolean(isFollowingRow)
      const followsYou = Boolean(followsYouRow)

      isFollowingMap.value[targetAccountId] = isFollowing
      followsYouMap.value[targetAccountId] = followsYou

      return { isFollowing, followsYou }
    } catch (err) {
      console.error('[useSocialFollow] fetchFollowStatus error:', err)
      return { isFollowing: false, followsYou: false }
    }
  }

  /**
   * Queries mutual followers for "Followed by @user1, @user2, and X others" social proof
   */
  const fetchMutualFollowers = async (targetAccountId: string) => {
    const currentUserId = currentUser.value?.id
    if (!targetAccountId) return { sampleNames: [], totalCount: 0 }

    try {
      if (!currentUserId) {
        // For guest / unauthenticated: fetch top 2 recent public followers
        const { data: recentFollowers, count } = await db
          .from('FOLLOW')
          .select(`
            Follower_Account_ID,
            USER_ACCOUNT!Follower_Account_ID (
              Username
            )
          `, { count: 'exact' })
          .eq('Following_Account_ID', targetAccountId)
          .order('Created_at', { ascending: false })
          .limit(2)

        const sampleNames = (recentFollowers || [])
          .map((r: any) => r.USER_ACCOUNT?.Username)
          .filter(Boolean)

        const summary = { sampleNames, totalCount: count || 0 }
        mutualFollowersMap.value[targetAccountId] = summary
        return summary
      }

      // If authenticated: find people the viewer follows who ALSO follow the target account
      // 1. Fetch people current user follows
      const { data: myFollowing } = await db
        .from('FOLLOW')
        .select('Following_Account_ID')
        .eq('Follower_Account_ID', currentUserId)

      const myFollowingIds = (myFollowing || []).map((r: any) => r.Following_Account_ID)

      if (myFollowingIds.length > 0) {
        // Find intersection who follow targetAccountId
        const { data: mutuals, count } = await db
          .from('FOLLOW')
          .select(`
            Follower_Account_ID,
            USER_ACCOUNT!Follower_Account_ID (
              Username
            )
          `, { count: 'exact' })
          .eq('Following_Account_ID', targetAccountId)
          .in('Follower_Account_ID', myFollowingIds)
          .limit(2)

        if (mutuals && mutuals.length > 0) {
          const sampleNames = mutuals.map((r: any) => r.USER_ACCOUNT?.Username).filter(Boolean)
          const summary = { sampleNames, totalCount: count || 0 }
          mutualFollowersMap.value[targetAccountId] = summary
          return summary
        }
      }

      // Fallback: general recent followers if no mutuals
      const { data: generalFollowers, count: generalCount } = await db
        .from('FOLLOW')
        .select(`
          Follower_Account_ID,
          USER_ACCOUNT!Follower_Account_ID (
            Username
          )
        `, { count: 'exact' })
        .eq('Following_Account_ID', targetAccountId)
        .neq('Follower_Account_ID', currentUserId)
        .order('Created_at', { ascending: false })
        .limit(2)

      const sampleNames = (generalFollowers || [])
        .map((r: any) => r.USER_ACCOUNT?.Username)
        .filter(Boolean)

      const summary = { sampleNames, totalCount: generalCount || 0 }
      mutualFollowersMap.value[targetAccountId] = summary
      return summary
    } catch (err) {
      console.error('[useSocialFollow] fetchMutualFollowers error:', err)
      return { sampleNames: [], totalCount: 0 }
    }
  }

  return {
    isFollowingMap,
    followerCounts,
    followingCounts,
    followsYouMap,
    mutualFollowersMap,
    toggleFollow,
    fetchFollowStats,
    fetchFollowStatus,
    fetchMutualFollowers
  }
}
