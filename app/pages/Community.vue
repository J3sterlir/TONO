<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useCommunityFeed, type CommunityPostItem } from '~/composables/useCommunityFeed'
import { useTonoSongs, type SongItem } from '~/composables/useTonoSongs'
import { useSocialFollow } from '~/composables/useSocialFollow'
import { formatPostTimestamp, formatCount, parseCaptionSegments } from '~/utils/postHelpers'
import type { PostItem } from '~/composables/useArtistPosts'

definePageMeta({
  title: 'Community | TONO'
})

const currentUser = useSupabaseUser()
const { fetchCurrentUserProfile } = useTonoAuth()
const currentUserRole = ref<'artist' | 'user' | 'business' | 'guest'>('guest')
const userCity = ref<string>('')

const initialRole = computed<'artist' | 'user' | 'business' | 'guest'>(() => {
  if (!currentUser.value) return 'guest'
  const role = (currentUser.value.user_metadata?.role || '').toLowerCase()
  if (role === 'artist') return 'artist'
  if (role === 'business') return 'business'
  return 'user'
})

const effectiveRole = computed(() => {
  if (currentUserRole.value !== 'guest') return currentUserRole.value
  return initialRole.value
})

const isGuest = computed(() => !currentUser.value || effectiveRole.value === 'guest')

// Social & Feed composables
const {
  feedPosts,
  isLoading: isFeedLoading,
  isRefreshing,
  fetchFeed,
  refreshFeed,
  syncUserLikes,
  toggleLike,
  toggleFollow,
  incrementCommentCount,
  isFollowingMap
} = useCommunityFeed()

const {
  topListenedSongs,
  topLikedSongs,
  fetchLeaderboards,
  playSong,
  currentSong,
  isPlaying,
  togglePlayPause
} = useTonoSongs()

// Navigation & Layout state
const activeMobileTab = ref<'feed' | 'charts'>('feed')
const leaderboardScope = ref<'local' | 'all'>('all')

// PostDetailModal state
const selectedPost = ref<PostItem | null>(null)
const selectedPostAuthorName = ref('Creator')
const selectedPostAuthorAvatar = ref<string | null>(null)
const selectedPostAuthorUsername = ref('')
const isPostModalOpen = ref(false)

const openPostDetail = (post: CommunityPostItem) => {
  if (isGuest.value) {
    navigateTo('/Login')
    return
  }

  // Convert CommunityPostItem to PostItem shape for PostDetailModal
  selectedPost.value = {
    POST_ID: post.POST_ID,
    ARTIST_ID: post.ARTIST_ID || '',
    Caption: post.Caption || null,
    Media: post.Media || null,
    File_URL: post.Media || null,
    Location: post.Location || null,
    Created_at: post.Created_at,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    userHasLiked: post.userHasLiked
  }
  selectedPostAuthorName.value = post.authorName
  selectedPostAuthorAvatar.value = post.authorAvatar || null
  selectedPostAuthorUsername.value = post.authorUsername
  isPostModalOpen.value = true
}

const closePostModal = () => {
  isPostModalOpen.value = false
  selectedPost.value = null
}

const handleLikeToggledFromModal = (postId: string) => {
  const p = feedPosts.value.find((item) => item.POST_ID === postId)
  if (p) {
    p.userHasLiked = !p.userHasLiked
    p.likeCount = Math.max(0, p.likeCount + (p.userHasLiked ? 1 : -1))
    if (selectedPost.value && selectedPost.value.POST_ID === postId) {
      selectedPost.value.userHasLiked = p.userHasLiked
      selectedPost.value.likeCount = p.likeCount
    }
  }
}

const handleCommentAddedFromModal = (postId: string) => {
  incrementCommentCount(postId)
  if (selectedPost.value && selectedPost.value.POST_ID === postId) {
    selectedPost.value.commentCount = (selectedPost.value.commentCount || 0) + 1
  }
}

// In-feed caption expansion state
const expandedPostIds = ref<Set<string>>(new Set())

const isCaptionExpanded = (postId: string): boolean => {
  return expandedPostIds.value.has(postId)
}

const toggleCaptionExpand = (postId: string) => {
  const next = new Set(expandedPostIds.value)
  if (next.has(postId)) {
    next.delete(postId)
  } else {
    next.add(postId)
  }
  expandedPostIds.value = next
}

// Caption truncation helpers
const isCaptionTruncated = (caption?: string | null): boolean => {
  if (!caption) return false
  return caption.length > 160 || caption.split('\n').length > 3
}

const getTruncatedCaption = (caption?: string | null): string => {
  if (!caption) return ''
  const lines = caption.split('\n')
  if (lines.length > 3) {
    const first3 = lines.slice(0, 3).join('\n')
    if (first3.length > 160) {
      return first3.slice(0, 160).trim()
    }
    return first3.trim()
  }
  if (caption.length > 160) {
    return caption.slice(0, 160).trim()
  }
  return caption
}

// Share toast state
const shareToast = ref('')

const handleSharePost = async (post: CommunityPostItem) => {
  if (typeof window === 'undefined') return
  const url = `${window.location.origin}${post.authorRoute}`

  if (navigator.share) {
    try {
      await navigator.share({
        title: `Post by ${post.authorName} on TONO`,
        text: post.Caption || `Check out ${post.authorName}'s post on TONO!`,
        url
      })
      return
    } catch {}
  }

  try {
    await navigator.clipboard.writeText(url)
    shareToast.value = 'Post link copied to clipboard!'
    setTimeout(() => {
      shareToast.value = ''
    }, 3000)
  } catch {
    shareToast.value = 'Could not copy link.'
    setTimeout(() => {
      shareToast.value = ''
    }, 3000)
  }
}

const { openReportModal } = useModerationReport()

// Report post action
const handleReportPost = (post: CommunityPostItem) => {
  if (isGuest.value) {
    navigateTo('/Login')
    return
  }

  openReportModal({
    targetType: 'Post',
    targetId: post.POST_ID,
    targetAccountId: post.authorAccountId || post.ARTIST_ID || undefined,
    targetName: post.authorName,
    previewSnippet: post.Caption || (post.Media ? '[Media Post]' : undefined)
  })
}

const initCommunityData = async () => {
  try {
    const profile = await fetchCurrentUserProfile()
    if (profile?.account) {
      if (profile.artistProfile) {
        currentUserRole.value = 'artist'
      } else if (profile.businessProfile) {
        currentUserRole.value = 'business'
      } else {
        currentUserRole.value = 'user'
      }
      userCity.value = profile.account.City || ''
    } else {
      currentUserRole.value = 'guest'
    }
  } catch {
    currentUserRole.value = initialRole.value
  }

  // Load feed & charts
  await Promise.all([
    fetchFeed(25),
    fetchLeaderboards(leaderboardScope.value, userCity.value)
  ])
}

onMounted(async () => {
  await initCommunityData()
})

// Reactively re-sync feed and user role when auth state changes / hydrates
watch(currentUser, async (newUser, oldUser) => {
  if (newUser?.id !== oldUser?.id) {
    if (newUser?.id) {
      await initCommunityData()
    } else {
      currentUserRole.value = 'guest'
      await fetchFeed(25)
    }
  }
})

const handleScopeChange = async (scope: 'local' | 'all') => {
  leaderboardScope.value = scope
  await fetchLeaderboards(scope, userCity.value)
}
</script>

<template>
  <div class="min-h-screen bg-[#0E0E10] text-white flex flex-col pb-24">
    <!-- Top Navigation Header -->
    <ArtistNav v-if="effectiveRole === 'artist'" />
    <UserNav v-else-if="effectiveRole === 'user' || effectiveRole === 'business'" />
    <header
      v-else
      class="w-full bg-[#131315]/90 backdrop-blur-md border-b border-[#46464D]/60 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40"
    >
      <NuxtLink to="/" class="flex items-center gap-2">
        <span class="text-2xl font-black tracking-wider text-white font-Sora">TONO</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-[#D0D4F7]/10 text-[#D0D4F7] font-mono tracking-wide">
          COMMUNITY
        </span>
      </NuxtLink>
      <div class="flex items-center gap-3">
        <NuxtLink to="/Login"
          class="text-xs sm:text-sm font-medium text-gray-300 hover:text-white px-3 py-1.5 transition-colors">
          Log In
        </NuxtLink>
        <NuxtLink to="/Signin"
          class="text-xs sm:text-sm font-semibold bg-[#D0D4F7] hover:bg-white text-[#0E0E10] px-4 py-1.5 rounded-xl transition-all shadow-md">
          Join TONO
        </NuxtLink>
      </div>
    </header>

    <!-- Main Container -->
    <main class="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6">
      <!-- Mobile Segmented Tab Switcher (< 1024px) -->
      <div class="lg:hidden flex mb-6 p-1 bg-[#18181B] rounded-xl border border-[#2A2A2E]">
        <button
          @click="activeMobileTab = 'feed'"
          class="flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
          :class="activeMobileTab === 'feed' ? 'bg-[#D0D4F7] text-[#0E0E10] shadow-sm' : 'text-gray-400 hover:text-white'"
        >
          <Icon name="mdi:music" class="text-sm" />
          <span>Feed</span>
        </button>
        <button
          @click="activeMobileTab = 'charts'"
          class="flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
          :class="activeMobileTab === 'charts' ? 'bg-[#D0D4F7] text-[#0E0E10] shadow-sm' : 'text-gray-400 hover:text-white'"
        >
          <Icon name="mdi:music-circle" class="text-sm" />
          <span>Charts & Trending</span>
        </button>
      </div>

      <!-- 2-Column Responsive Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <!-- =============================================================== -->
        <!-- LEFT COLUMN: Single-Thread Community Feed (lg:col-span-8)       -->
        <!-- =============================================================== -->
        <section
          v-show="activeMobileTab === 'feed'"
          class="lg:col-span-8 flex flex-col gap-6"
        >
          <!-- Mobile Top Tracks Story Quick Bar (< 1024px) -->
          <div
            v-if="topListenedSongs.length > 0"
            class="lg:hidden bg-[#1B1B1D] border border-[#46464D]/40 rounded-xl p-3 overflow-hidden shadow-md"
          >
            <div class="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-300">
              <Icon name="mdi:music" class="text-[#D0D4F7]" />
              <span>Top Community Tracks</span>
            </div>
            <div class="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-none">
              <div
                v-for="(song, idx) in topListenedSongs.slice(0, 6)"
                :key="song.Song_ID"
                @click="playSong(song)"
                class="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
              >
                <div class="relative w-13 h-13 rounded-full p-0.5 bg-linear-to-tr from-[#D0D4F7] to-purple-500">
                  <img
                    :src="song.artistAvatar || '/images/default-avatar.png'"
                    @error="($event.target as HTMLImageElement).src = '/images/default-avatar.png'"
                    class="w-full h-full rounded-full object-cover border-2 border-[#1B1B1D]"
                  />
                  <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0E0E10] text-[#D0D4F7] flex items-center justify-center text-[10px] font-bold border border-[#46464D]">
                    #{{ idx + 1 }}
                  </div>
                </div>
                <span class="text-[11px] text-gray-300 truncate max-w-16 text-center font-medium">
                  {{ song.Title }}
                </span>
              </div>
            </div>
          </div>

          <!-- Feed Header & Refresh Button -->
          <div class="flex items-center justify-between pb-1">
            <h1 class="font-Sora text-xl font-bold text-white flex items-center gap-2">
              <Icon name="mdi:music" class="text-[#D0D4F7]" />
              Community Feed
            </h1>
            <button
              @click="refreshFeed"
              :disabled="isRefreshing"
              class="px-3 py-1.5 rounded-xl bg-[#18181B] border border-[#2A2A2E] text-xs text-gray-300 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <Icon name="ic:baseline-refresh" class="text-sm" :class="{ 'animate-spin': isRefreshing }" />
              <span>Refresh</span>
            </button>
          </div>

          <!-- Loading Skeleton -->
          <div v-if="isFeedLoading" class="flex flex-col gap-6">
            <div
              v-for="i in 3"
              :key="i"
              class="bg-[#1B1B1D] border border-[#46464D]/40 rounded-xl p-6 flex flex-col gap-4 animate-pulse"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-[#2A2A2E]" />
                <div class="space-y-1.5 flex-1">
                  <div class="h-4 w-32 bg-[#2A2A2E] rounded" />
                  <div class="h-3 w-20 bg-[#2A2A2E] rounded" />
                </div>
              </div>
              <div class="w-full aspect-video bg-[#2A2A2E] rounded-lg" />
              <div class="h-4 w-3/4 bg-[#2A2A2E] rounded" />
            </div>
          </div>

          <!-- Feed Posts List: Exact formatting from artist/[username].vue:L1053-L1142 -->
          <template v-else-if="feedPosts.length > 0">
            <article
              v-for="post in feedPosts"
              :key="post.POST_ID"
              class="bg-[#1B1B1D] border border-[#46464D]/40 rounded-xl overflow-hidden w-full shadow-lg"
            >
              <!-- 1. Uploaded Image: IF NO IMAGE HIDE THE DIV COMPLETELY (NO PLACEHOLDER IMAGE) -->
              <div
                v-if="post.Media"
                class="w-full aspect-video max-h-137.5 overflow-hidden bg-black/40 flex items-center justify-center cursor-pointer"
                @click="openPostDetail(post)"
                @dblclick.stop="toggleLike(post.POST_ID)"
              >
                <img
                  :src="post.Media"
                  alt="Post Media"
                  class="object-cover w-full h-full hover:scale-[1.02] transition-transform duration-500"
                />
              </div>

              <div class="flex flex-col gap-4 p-4 sm:p-6">
                <!-- Header with Author Info and Follow Button -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <NuxtLink :to="post.authorRoute" class="shrink-0">
                      <img
                        :src="post.authorAvatar || '/images/default-avatar.png'"
                        @error="($event.target as HTMLImageElement).src = '/images/default-avatar.png'"
                        alt="Author Avatar"
                        class="w-10 h-10 rounded-full object-cover border border-[#46464D]/50 hover:scale-105 transition-transform"
                      />
                    </NuxtLink>
                    <div>
                      <div class="flex items-center gap-2">
                        <NuxtLink
                          :to="post.authorRoute"
                          class="font-Sora text-base sm:text-[18px] font-semibold text-white hover:text-[#D0D4F7] transition-colors"
                        >
                          {{ post.authorName }}
                        </NuxtLink>
                        <span
                          v-if="post.Location"
                          class="text-xs text-gray-400 font-Geist flex items-center gap-1"
                        >
                          <Icon name="ic:outline-location-on" class="text-sm text-[#D0D4F7]" />
                          {{ post.Location }}
                        </span>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="font-HankenGrotesk text-xs text-[#C7C5CE]">
                          {{ formatPostTimestamp(post.Created_at) }}
                        </span>
                        <span class="text-[10px] px-1.5 py-0.2 rounded bg-[#131315] text-[#D0D4F7] font-mono uppercase">
                          {{ post.authorType }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Quick Follow / Following Toggle Button -->
                  <button
                    v-if="!post.isOwnPost && (!currentUser || currentUser.id?.toLowerCase() !== post.authorAccountId?.toLowerCase())"
                    type="button"
                    @click.stop="toggleFollow(post.authorAccountId || post.ARTIST_ID || post.BUSINESS_ID || '')"
                    class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer"
                    :class="(post.isFollowing || (post.authorAccountId && isFollowingMap[post.authorAccountId])) ? 'bg-[#18181B] text-gray-300 border border-[#2A2A2E]' : 'bg-[#D0D4F7] text-[#0E0E10] hover:bg-[#b8bdf2]'"
                  >
                    {{ (post.isFollowing || (post.authorAccountId && isFollowingMap[post.authorAccountId])) ? 'Following' : '+ Follow' }}
                  </button>
                </div>

                <!-- Post Caption -->
                <div v-if="post.Caption">
                  <p class="text-sm sm:text-base text-gray-300 leading-relaxed font-Geist whitespace-pre-line">
                    <template v-if="isCaptionTruncated(post.Caption) && !isCaptionExpanded(post.POST_ID)">
                      <template v-for="(seg, idx) in parseCaptionSegments(getTruncatedCaption(post.Caption))" :key="idx">
                        <a
                          v-if="seg.isLink"
                          :href="seg.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-[#9d87cb] hover:underline break-all"
                          @click.stop
                        >{{ seg.text }}</a>
                        <span v-else>{{ seg.text }}</span>
                      </template>
                      <button
                        type="button"
                        @click.stop="toggleCaptionExpand(post.POST_ID)"
                        class="font-bold text-[#babdf3] hover:underline cursor-pointer ml-1 inline-flex items-center"
                      >
                        … See more
                      </button>
                    </template>
                    <template v-else>
                      <template v-for="(seg, idx) in parseCaptionSegments(post.Caption)" :key="idx">
                        <a
                          v-if="seg.isLink"
                          :href="seg.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-[#9d87cb] hover:underline break-all"
                          @click.stop
                        >{{ seg.text }}</a>
                        <span v-else>{{ seg.text }}</span>
                      </template>
                    </template>
                  </p>
                  <div
                    v-if="isCaptionTruncated(post.Caption) && isCaptionExpanded(post.POST_ID)"
                    class="mt-1"
                  >
                    <button
                      type="button"
                      @click.stop="toggleCaptionExpand(post.POST_ID)"
                      class="font-bold text-[#babdf3] hover:underline cursor-pointer inline-flex items-center text-sm"
                    >
                      See less
                    </button>
                  </div>
                </div>

                <!-- Bottom Action Bar -->
                <div class="flex justify-between items-center pt-2 border-t border-[#46464D]/20 text-sm">
                  <div class="flex gap-4 sm:gap-6 items-center">
                    <!-- Likes Button with ic:baseline-favorite-border / ic:baseline-favorite in text-[#D0D4F7] -->
                    <button
                      type="button"
                      @click="toggleLike(post.POST_ID)"
                      class="flex gap-1.5 items-center cursor-pointer transition-colors"
                      :class="post.userHasLiked ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'"
                    >
                      <Icon
                        :name="post.userHasLiked ? 'ic:baseline-favorite' : 'ic:baseline-favorite-border'"
                        class="text-xl sm:text-2xl text-[#D0D4F7] transition-transform active:scale-125"
                      />
                      <span
                        class="text-xs sm:text-sm font-medium"
                        :class="post.userHasLiked ? 'text-[#D0D4F7]' : 'text-[#C7C5CE]'"
                      >
                        {{ formatCount(post.likeCount) }}
                      </span>
                    </button>

                    <!-- Comments Button: Triggers PostDetailModal -->
                    <button
                      type="button"
                      @click="openPostDetail(post)"
                      class="flex gap-1.5 items-center text-[#C7C5CE] hover:text-[#D0D4F7] transition-colors cursor-pointer"
                    >
                      <Icon name="ic:sharp-chat-bubble-outline" class="text-xl sm:text-2xl text-[#D0D4F7]" />
                      <span class="text-xs sm:text-sm font-medium">
                        {{ formatCount(post.commentCount) }}
                      </span>
                    </button>
                  </div>

                  <div class="flex items-center gap-3">
                    <!-- Share Button -->
                    <button
                      type="button"
                      @click="handleSharePost(post)"
                      class="text-[#C7C5CE] hover:text-[#D0D4F7] transition-colors cursor-pointer"
                      title="Share Post"
                    >
                      <Icon name="ic:round-share" class="text-xl sm:text-2xl" />
                    </button>

                    <!-- Report Post Action -->
                    <button
                      type="button"
                      @click="handleReportPost(post)"
                      class="text-[#C7C5CE] hover:text-rose-400 transition-colors cursor-pointer"
                      title="Report Post"
                    >
                      <Icon name="ic:round-flag" class="text-xl sm:text-2xl" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          </template>

          <!-- Fallback if empty (Even with fallback query, handles 0 post platform state) -->
          <div
            v-else
            class="bg-[#1B1B1D] border border-[#46464D]/40 rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3 shadow-lg"
          >
            <div class="w-12 h-12 rounded-full bg-[#D0D4F7]/10 text-[#D0D4F7] flex items-center justify-center text-2xl">
              <Icon name="mdi:music" />
            </div>
            <h3 class="font-Sora text-base font-semibold text-white">No Community Posts Yet</h3>
            <p class="text-xs text-gray-400 max-w-sm">
              Be the first to share an update, gig announcement, or behind-the-scenes moment with the TONO community!
            </p>
          </div>
        </section>

        <!-- =============================================================== -->
        <!-- RIGHT COLUMN: Sticky Charts & Leaderboards (lg:col-span-4)      -->
        <!-- =============================================================== -->
        <aside
          v-show="activeMobileTab === 'charts' || true"
          class="lg:col-span-4 flex flex-col gap-6 sticky top-24"
          :class="{ 'hidden lg:flex': activeMobileTab === 'feed' }"
        >
          <!-- 1. Most Listened Songs Card -->
          <div class="bg-[#1B1B1D] border border-[#46464D]/40 rounded-xl p-5 shadow-lg flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <h2 class="font-Sora text-base font-semibold text-white flex items-center gap-2">
                <Icon name="mdi:music-circle" class="text-[#D0D4F7] text-lg" />
                <span>Top Listened Songs</span>
              </h2>

              <!-- Local vs All TONO Scope Toggle -->
              <div class="flex bg-[#131315] p-1 rounded-lg border border-[#2A2A2E] text-[11px]">
                <button
                  type="button"
                  @click="handleScopeChange('local')"
                  class="px-2 py-0.5 rounded font-medium transition-colors"
                  :class="leaderboardScope === 'local' ? 'bg-[#D0D4F7] text-[#0E0E10] font-semibold' : 'text-gray-400 hover:text-white'"
                >
                  Local
                </button>
                <button
                  type="button"
                  @click="handleScopeChange('all')"
                  class="px-2 py-0.5 rounded font-medium transition-colors"
                  :class="leaderboardScope === 'all' ? 'bg-[#D0D4F7] text-[#0E0E10] font-semibold' : 'text-gray-400 hover:text-white'"
                >
                  All TONO
                </button>
              </div>
            </div>

            <!-- Listened Songs List -->
            <div v-if="topListenedSongs.length > 0" class="space-y-2">
              <div
                v-for="(song, idx) in topListenedSongs"
                :key="song.Song_ID"
                @click="playSong(song)"
                class="flex items-center justify-between p-2.5 rounded-xl bg-[#131315] border border-[#2A2A2E] hover:border-[#D0D4F7]/50 transition-all cursor-pointer group"
                :class="{ 'border-[#D0D4F7] bg-[#18181B]': currentSong?.Song_ID === song.Song_ID }"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <span
                    class="font-mono text-xs font-bold w-5 text-center shrink-0"
                    :class="idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-gray-500'"
                  >
                    #{{ idx + 1 }}
                  </span>
                  <div class="truncate">
                    <p class="text-xs font-semibold text-white truncate group-hover:text-[#D0D4F7] transition-colors">
                      {{ song.Title }}
                    </p>
                    <p class="text-[11px] text-gray-400 truncate">
                      {{ song.artistName }}
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-[11px] text-gray-400 font-mono flex items-center gap-1">
                    <Icon name="ic:round-play-arrow" class="text-xs text-[#D0D4F7]" />
                    {{ formatCount(song.Play_Count) }}
                  </span>
                </div>
              </div>
            </div>

            <div v-else class="text-center py-6 text-gray-500 text-xs">
              No ranked tracks in this category yet.
            </div>
          </div>

          <!-- 2. Most Liked Songs Card -->
          <div class="bg-[#1B1B1D] border border-[#46464D]/40 rounded-xl p-5 shadow-lg flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <h2 class="font-Sora text-base font-semibold text-white flex items-center gap-2">
                <Icon name="ic:baseline-favorite" class="text-[#D0D4F7] text-lg" />
                <span>Most Liked Tracks</span>
              </h2>
            </div>

            <div v-if="topLikedSongs.length > 0" class="space-y-2">
              <div
                v-for="(song, idx) in topLikedSongs"
                :key="song.Song_ID"
                @click="playSong(song)"
                class="flex items-center justify-between p-2.5 rounded-xl bg-[#131315] border border-[#2A2A2E] hover:border-[#D0D4F7]/50 transition-all cursor-pointer group"
                :class="{ 'border-[#D0D4F7] bg-[#18181B]': currentSong?.Song_ID === song.Song_ID }"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <span
                    class="font-mono text-xs font-bold w-5 text-center shrink-0"
                    :class="idx === 0 ? 'text-rose-400' : 'text-gray-400'"
                  >
                    #{{ idx + 1 }}
                  </span>
                  <div class="truncate">
                    <p class="text-xs font-semibold text-white truncate group-hover:text-[#D0D4F7] transition-colors">
                      {{ song.Title }}
                    </p>
                    <p class="text-[11px] text-gray-400 truncate">
                      {{ song.artistName }}
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-[11px] text-gray-400 font-mono flex items-center gap-1">
                    <Icon name="ic:baseline-favorite" class="text-xs text-rose-400" />
                    {{ formatCount(song.Like_Count) }}
                  </span>
                </div>
              </div>
            </div>

            <div v-else class="text-center py-6 text-gray-500 text-xs">
              No liked tracks recorded yet.
            </div>
          </div>
        </aside>
      </div>
    </main>

    <!-- Post Detail Modal Component (For Comments & Real-Time Discussion) -->
    <PostDetailModal
      :is-open="isPostModalOpen"
      :post="selectedPost"
      :artist-name="selectedPostAuthorName"
      :artist-avatar="selectedPostAuthorAvatar"
      :artist-username="selectedPostAuthorUsername"
      @close="closePostModal"
      @like-toggled="handleLikeToggledFromModal"
      @comment-added="handleCommentAddedFromModal"
    />

    <!-- Toast Notification -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform translate-y-4 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform translate-y-4 opacity-0"
      >
        <div
          v-if="shareToast"
          class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-[#161619] border border-[#D0D4F7]/50 rounded-2xl shadow-2xl text-[#D0D4F7] font-Sora text-sm"
        >
          <Icon name="ic:round-check" class="text-lg" />
          <span>{{ shareToast }}</span>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
