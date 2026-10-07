<script setup lang="ts">
definePageMeta({
  layout: false,
})

import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { formatPostTimestamp, formatCount } from '~/utils/postHelpers'
import { resolveSocialLink, getBusinessInitials } from '~/utils/linkResolver'
import type { PostItem } from '~/composables/useArtistPosts'

const route = useRoute()
const businessIdParam = computed(() => (route.params.id as string) || '')

const supabase = useSupabaseClient()
const db = supabase as any

// Post and messaging composables
const { posts, fetchBusinessPosts, toggleLike } = useArtistPosts()
const { getOrCreateThread } = useMessaging()

// User auth & role state
const currentUser = useSupabaseUser()
const { fetchCurrentUserProfile } = useTonoAuth()
const currentUserId = ref<string | null>(null)
const currentUserRole = ref<'artist' | 'user' | 'business' | 'guest'>('guest')

// Tab Navigation State
const activeTab = ref<'posts' | 'jobs' | 'contact'>('posts')

// Toasts
const isCopied = ref(false)
const chatToast = ref('')
const initiatingChat = ref(false)

// Modals
const selectedPost = ref<PostItem | null>(null)
const isPostModalOpen = ref(false)

const openPostDetail = (post: PostItem) => {
  selectedPost.value = post
  isPostModalOpen.value = true
}

const closePostModal = () => {
  isPostModalOpen.value = false
  selectedPost.value = null
}

// -----------------------------------------------------------------------------
// 1. Fetch Business Profile Data (Universal: Supports UUID or Username)
// -----------------------------------------------------------------------------
const isUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)

const { data: businessData, error: fetchError } = await useAsyncData(
  `business-public-${businessIdParam.value}`,
  async () => {
    if (!businessIdParam.value) {
      throw createError({ statusCode: 404, statusMessage: 'Business ID required' })
    }

    let bizRecord: any = null

    // A. If UUID, fetch directly by BUSINESS_ID
    if (isUUID(businessIdParam.value)) {
      const { data, error } = await db
        .from('BUSINESS_PROFILE')
        .select(`
          *,
          USER_ACCOUNT:ACCOUNT_ID (
            ACCOUNT_ID,
            Username,
            Profile_Picture
          )
        `)
        .eq('BUSINESS_ID', businessIdParam.value)
        .maybeSingle()

      if (!error && data) {
        bizRecord = data
      }
    }

    // B. If not found or not UUID, try resolving via USER_ACCOUNT Username
    if (!bizRecord) {
      const { data: userAcc } = await db
        .from('USER_ACCOUNT')
        .select('ACCOUNT_ID, Username, Profile_Picture')
        .ilike('Username', businessIdParam.value)
        .maybeSingle()

      if (userAcc?.ACCOUNT_ID) {
        const { data: byAccount } = await db
          .from('BUSINESS_PROFILE')
          .select('*')
          .eq('ACCOUNT_ID', userAcc.ACCOUNT_ID)
          .maybeSingle()

        if (byAccount) {
          bizRecord = {
            ...byAccount,
            USER_ACCOUNT: userAcc,
          }
        }
      }
    }

    if (!bizRecord) {
      throw createError({ statusCode: 404, statusMessage: 'Business Not Found', fatal: false })
    }

    // Fetch active job listings for this business
    const { data: jobs } = await db
      .from('JOB_LISTING')
      .select('*')
      .eq('Posted_By_BUSINESS_ID', bizRecord.BUSINESS_ID)
      .eq('Status', 'Open')
      .order('Created_at', { ascending: false })

    return {
      business: bizRecord,
      openJobs: jobs || [],
    }
  }
)

const business = computed(() => businessData.value?.business || null)
const openJobs = computed(() => businessData.value?.openJobs || [])

// Owner Check
const isOwner = computed(() => {
  if (!currentUserId.value || !business.value?.ACCOUNT_ID) return false
  return currentUserId.value.toLowerCase() === business.value.ACCOUNT_ID.toLowerCase()
})

// Formatted Social Links
const resolvedSocialLinks = computed(() => {
  const rawLinks = business.value?.Links
  if (!rawLinks || !Array.isArray(rawLinks)) return []
  return rawLinks
    .map((l: any) => {
      const url = typeof l === 'string' ? l : l.url
      const label = typeof l === 'string' ? '' : l.label
      return resolveSocialLink(url, label)
    })
    .filter((l) => Boolean(l.url))
})

// -----------------------------------------------------------------------------
// 2. Lifecycle & Client Auth
// -----------------------------------------------------------------------------
onMounted(async () => {
  try {
    const profile = await fetchCurrentUserProfile()
    if (profile?.account) {
      currentUserId.value = profile.account.ACCOUNT_ID
      if (profile.artistProfile) currentUserRole.value = 'artist'
      else if (profile.businessProfile) currentUserRole.value = 'business'
      else currentUserRole.value = 'user'
    } else {
      currentUserRole.value = 'guest'
    }
  } catch (err) {
    currentUserRole.value = 'guest'
  }

  // Fetch business posts
  if (business.value?.BUSINESS_ID) {
    await fetchBusinessPosts(business.value.BUSINESS_ID)
  }

  // Scroll depth tracking
  if (import.meta.client) {
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('scroll', handleScroll)
  }
})

// -----------------------------------------------------------------------------
// 3. Scroll Dynamics & Spotify Depth Fade Effect
// -----------------------------------------------------------------------------
const scrollY = ref(0)
const isScrolledPastHero = ref(false)

const handleScroll = () => {
  if (!import.meta.client) return
  scrollY.value = window.scrollY
  isScrolledPastHero.value = scrollY.value > 260
}

const bannerTransformStyle = computed(() => {
  const currentY = scrollY.value
  const maxParallax = 160
  const translateY = Math.min(currentY * 0.35, maxParallax)
  const scale = Math.max(1.0, 1.05 - currentY * 0.00025)
  return {
    transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
  }
})

const scrollDarkOverlayOpacity = computed(() => {
  return Math.min(0.85, Math.max(0, scrollY.value / 320))
})

// -----------------------------------------------------------------------------
// 4. Messaging & Actions
// -----------------------------------------------------------------------------
const handleInitiateChat = async () => {
  const resolvedUser = currentUser.value || (await supabase.auth.getUser()).data.user
  if (!resolvedUser) {
    await navigateTo(`/Login?redirect=/business/${businessIdParam.value}`)
    return
  }

  const targetAccId = business.value?.ACCOUNT_ID
  if (!targetAccId) return

  if (resolvedUser.id.toLowerCase() === targetAccId.toLowerCase()) {
    chatToast.value = 'You cannot start a chat with your own business.'
    setTimeout(() => {
      chatToast.value = ''
    }, 4000)
    return
  }

  initiatingChat.value = true
  try {
    const threadId = await getOrCreateThread(targetAccId, resolvedUser.id)
    if (threadId) {
      await navigateTo(`/Messages?threadId=${threadId}`)
    }
  } catch (err: any) {
    console.error('Failed to initiate chat with business:', err)
    chatToast.value = err?.message || 'Could not start conversation.'
    setTimeout(() => {
      chatToast.value = ''
    }, 4000)
  } finally {
    initiatingChat.value = false
  }
}

const handleShareProfile = async () => {
  if (!import.meta.client) return
  try {
    await navigator.clipboard.writeText(window.location.href)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 3000)
  } catch {
    // fallback
  }
}

const handleSharePost = async (post: PostItem) => {
  if (!import.meta.client) return
  const url = `${window.location.origin}/business/${businessIdParam.value}?postId=${post.POST_ID}`
  try {
    await navigator.clipboard.writeText(url)
    chatToast.value = 'Post link copied to clipboard!'
    setTimeout(() => {
      chatToast.value = ''
    }, 3000)
  } catch {
    // ignore
  }
}

const backToDiscoveryRoute = computed(() => {
  if (currentUserRole.value === 'artist') return '/Artisthome'
  if (currentUserRole.value === 'business') return '/BusinessDash'
  return '/userhome'
})

const scrollToTop = () => {
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
</script>

<template>

  <head>
    <title>{{ business?.Business_Name || 'Business Profile' }} | TONO</title>
  </head>

  <!-- Global Toast for Link Copying -->
  <div v-if="isCopied"
    class="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#1E1E24] border border-[#D0D4F7]/60 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
    <Icon name="ic:round-check-circle" class="text-emerald-400 text-lg" />
    <span class="text-xs sm:text-sm font-medium">Profile link copied to clipboard! Ready to share.</span>
  </div>

  <!-- Notification Toast -->
  <div v-if="chatToast"
    class="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#1E1E24] border border-[#D0D4F7]/60 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
    <Icon name="mdi:information-outline" class="text-[#D0D4F7] text-lg" />
    <span class="text-xs sm:text-sm font-medium">{{ chatToast }}</span>
  </div>

  <div class="h-full bg-[#0E0E10] text-white flex flex-col min-h-screen pb-16 overflow-x-hidden font-Sora">
    <!-- Dynamic Top Navigation based on Viewer Session -->
    <ArtistNav
      v-if="currentUserRole === 'artist'"
      :scrolled-title="business?.Business_Name || ''"
      :scrolled-avatar="business?.Profile_Picture || null"
      :is-scrolled="isScrolledPastHero"
      :is-verified="true"
      @scroll-to-top="scrollToTop"
    />
    <UserNav
      v-else-if="currentUserRole === 'user' || currentUserRole === 'business'"
      :scrolled-title="business?.Business_Name || ''"
      :scrolled-avatar="business?.Profile_Picture || null"
      :is-scrolled="isScrolledPastHero"
      :is-verified="true"
      @scroll-to-top="scrollToTop"
    />
    <header
      v-else
      class="w-full bg-[#131315]/90 backdrop-blur-md border-b border-[#46464D]/75 px-4 sm:px-8 md:px-10 py-3 sm:py-4 flex items-center justify-between z-40 sticky top-0 font-HankenGrotesk"
    >
      <!-- Brand / Logo & Scrolled Business Title -->
      <div class="flex items-center gap-2.5 sm:gap-3.5 shrink-0 min-w-0">
        <NuxtLink :to="backToDiscoveryRoute" class="flex items-center gap-2.5 shrink-0">
          <span class="text-2xl font-black tracking-wider text-white font-Sora">TONO</span>
          <span v-if="!isScrolledPastHero" class="text-[11px] px-2 py-0.5 rounded-full bg-[#D0D4F7]/10 text-[#D0D4F7] font-mono tracking-wide">
            BUSINESS
          </span>
        </NuxtLink>

        <!-- Scrolled Business Title -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 -translate-x-2 scale-95"
          enter-to-class="opacity-100 translate-x-0 scale-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-x-0 scale-100"
          leave-to-class="opacity-0 -translate-x-2 scale-95"
        >
          <div
            v-if="isScrolledPastHero && business"
            @click="scrollToTop"
            class="flex items-center gap-2 sm:gap-2.5 pl-2.5 sm:pl-3.5 border-l border-[#46464D]/70 cursor-pointer group/scrolled min-w-0"
            title="Scroll to top"
          >
            <img
              v-if="business.Profile_Picture"
              :src="business.Profile_Picture"
              :alt="business.Business_Name"
              class="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover shrink-0 ring-1 ring-[#D0D4F7]/40 shadow-sm"
            />
            <div
              v-else
              class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#1E1E24] text-[#D0D4F7] text-[10px] font-bold flex items-center justify-center shrink-0 uppercase border border-[#3A3A3C]"
            >
              {{ getBusinessInitials(business.Business_Name) }}
            </div>
            <span class="font-Sora font-bold text-xs sm:text-sm text-white group-hover/scrolled:text-[#D0D4F7] transition-colors truncate max-w-30 sm:max-w-55">
              {{ business.Business_Name }}
            </span>
          </div>
        </Transition>
      </div>

      <div class="flex items-center gap-3 sm:gap-4 shrink-0">
        <NuxtLink
          to="/Login"
          class="text-xs sm:text-sm font-medium text-gray-300 hover:text-white px-3 py-1.5 transition-colors"
        >
          Log In
        </NuxtLink>
        <NuxtLink
          to="/Signin"
          class="text-xs sm:text-sm font-semibold bg-[#D0D4F7] hover:bg-white text-[#0E0E10] px-4 py-1.5 rounded-xl transition-all shadow-md"
        >
          Join TONO
        </NuxtLink>
      </div>
    </header>

    <!-- 404 / Error State if Business Not Found -->
    <div v-if="fetchError || !business"
      class="max-w-xl mx-auto my-24 p-8 bg-[#131315] border border-[#3A3A3C] rounded-2xl text-center flex flex-col items-center gap-4 shadow-xl">
      <div
        class="w-16 h-16 rounded-full bg-red-950/40 border border-red-800/40 flex items-center justify-center text-red-400 text-3xl">
        <Icon name="ic:outline-sentiment-very-dissatisfied" />
      </div>
      <h1 class="text-2xl font-Sora font-bold text-white">Business Not Found</h1>
      <p class="text-sm text-gray-400">
        We couldn't find a music business profile for this link. The business may have been removed or the URL might be
        incorrect.
      </p>
      <NuxtLink :to="backToDiscoveryRoute"
        class="mt-2 px-5 py-2 rounded-xl bg-[#D0D4F7] hover:bg-white text-[#0E0E10] font-semibold text-xs sm:text-sm transition-all shadow-md">
        Back to Discovery
      </NuxtLink>
    </div>

    <!-- Main Profile Content -->
    <div v-else>
      <!-- Hero Banner & Profile Info -->
      <div class="relative w-full overflow-hidden bg-[#131315] border-b border-[#46464D]/20">
        <!-- Parallax Background Banner Image -->
        <div class="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img v-if="business.Cover_Picture" :src="business.Cover_Picture" alt="Business Cover Banner"
            class="w-full h-full object-cover object-center opacity-70 mask-x-from-70% mask-x-to-90% transition-transform duration-75 ease-out origin-center"
            :style="bannerTransformStyle" />
          <div v-else
            class="w-full h-full bg-linear-to-r from-[#1E1E24] to-[#121215] opacity-80 transition-transform duration-75 ease-out origin-center"
            :style="bannerTransformStyle"></div>

          <!-- Base soft gradient overlay -->
          <div
            class="absolute inset-0 bg-linear-to-t from-[#0E0E10] via-[#0E0E10]/40 to-transparent md:bg-linear-to-r md:from-[#0E0E10]/90 md:via-[#0E0E10]/60 md:to-transparent">
          </div>

          <!-- Dynamic progressive dark overlay on scroll -->
          <div class="absolute inset-0 bg-[#0E0E10] transition-opacity duration-75 ease-out"
            :style="{ opacity: scrollDarkOverlayOpacity }"></div>
        </div>

        <!-- Action Toolbar (Share Profile & Owner Manage Dashboard) -->
        <div class="absolute top-4 right-4 sm:top-6 sm:right-8 md:right-16 z-20 flex items-center gap-2.5">
          <!-- Owner Direct Link to Dashboard -->
          <NuxtLink v-if="isOwner" to="/BusinessDash"
            class="flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-[#D0D4F7] hover:bg-white text-[#0E0E10] text-xs sm:text-sm font-semibold transition-all shadow-lg group"
            title="Manage your business dashboard">
            <Icon name="ic:outline-dashboard" class="text-base" />
            <span>Manage Dashboard</span>
          </NuxtLink>

          <!-- Share Profile Action Button -->
          <button type="button" @click="handleShareProfile"
            class="flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/10 text-xs sm:text-sm text-gray-200 hover:text-white transition-all cursor-pointer shadow-lg group"
            title="Share this profile">
            <Icon name="ic:round-share" class="text-base text-[#C7C5CE] group-hover:text-[#D0D4F7] transition-colors" />
            <span>Share</span>
          </button>
        </div>

        <!-- Loaded Header Info (Public View - Clean Full Banner Layout) -->
        <div
          class="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-8 sm:py-12 min-h-75 md:min-h-90 flex flex-col items-stretch text-left justify-end gap-2">
          <!-- Business Details Container -->
          <div class="flex items-center justify-between text-left gap-2.5">
            <!-- Service Category Eyebrow (L834-L836) -->

            <div>
              <div class="flex items-center gap-2">
                <span class="font-Geist font-medium text-xs sm:text-[14px] text-[#D0D4F7]/90 tracking-wider uppercase">
                  {{ business.Business_Service || 'Music Industry Business' }}
                </span>
              </div>
              <!-- Business Name Title (L844-L847) -->
              <h1
                class="font-Sora font-bold text-3xl sm:text-5xl lg:text-[56px] tracking-tight text-white leading-tight wrap-break-word max-w-full drop-shadow-md">
                {{ business.Business_Name }}
              </h1>

              <!-- Handle / Account Username if present -->
              <span v-if="business.USER_ACCOUNT?.Username" class="font-mono text-xs sm:text-sm text-gray-300">
                @{{ business.USER_ACCOUNT.Username }}
              </span>

              <!-- Contact Information Box (L863-L871) -->
              <div v-if="business.Contact_Information"
                class="flex flex-wrap items-center justify-start gap-2 bg-black/40 backdrop-blur-md p-3 py-1.5 rounded-xl max-w-fit border border-white/10 mt-1">
                <span
                  class="font-HankenGrotesk text-xs sm:text-[15px] text-gray-300 font-bold shrink-0 flex items-center gap-1.5">
                  <Icon name="ic:outline-phone" class="text-sm text-[#D0D4F7]" />
                  <span>Contact:</span>
                </span>
                <span class="text-xs sm:text-[15px] text-[#D0D4F7] font-medium wrap-break-word">
                  {{ business.Contact_Information }}
                </span>
              </div>

              <!-- Business Address Location (L873-L876) -->
              <div v-if="business.Business_Address"
                class="flex items-center gap-1.5 text-xs sm:text-sm text-gray-300 mt-0.5">
                <Icon name="ic:baseline-location-on" class="text-base text-[#D0D4F7]" />
                <span>{{ business.Business_Address }}</span>
              </div>

              <!-- Actions Row: Message Button & Share Button -->
              <div class="flex items-center gap-3 mt-3 flex-wrap">
                <!-- Message Action Button -->
                <div v-if="!isOwner" @click="handleInitiateChat"
                  class="flex items-center px-6 py-2.5 bg-[#D0D4F7] hover:bg-white text-[#151A34] gap-2 rounded-full font-Geist cursor-pointer transition-colors shadow-lg group"
                  :class="initiatingChat ? 'opacity-80 pointer-events-none' : ''">
                  <Icon v-if="initiatingChat" name="svg-spinners:ring-resize" class="text-base" />
                  <Icon v-else name="mdi:message-text-outline"
                    class="text-base group-hover:scale-110 transition-transform" />
                  <button class="font-bold cursor-pointer text-xs sm:text-sm">Message</button>
                </div>
              </div>
            </div>

            <div>
              <!-- Avatar Logo Display with Native Initials Fallback -->
              <div class="relative mb-1">
                <img v-if="business.Profile_Picture" :src="business.Profile_Picture" :alt="business.Business_Name"
                  class="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-white/80 shadow-2xl border border-white/20" />
                <div v-else
                  class="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#1E1E24] text-[#D0D4F7] font-Sora font-bold text-3xl flex items-center justify-center uppercase ring-4 ring-white/80 shadow-2xl border border-[#3A3A3C]">
                  {{ getBusinessInitials(business.Business_Name) }}
                </div>
              </div>
            </div>






          </div>
        </div>
      </div>

      <!-- Navigation Tabs (Posts, Open Job Listings, Contact & Booking) -->
      <div class="w-full border-b border-[#46464D]/20 bg-[#0E0E10]">
        <div class="max-w-7xl mx-auto px-4 sm:px-8 md:px-16 overflow-x-auto scrollbar-hide">
          <div class="flex justify-center sm:justify-start gap-8 sm:gap-12 text-[15px] sm:text-[17px] min-w-max">
            <button type="button" @click="activeTab = 'posts'" class="font-Sora cursor-pointer transition-colors"
              :class="activeTab === 'posts' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
              <span class="py-4 sm:py-5 flex items-center gap-2"
                :class="activeTab === 'posts' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
                <span>Posts</span>
                <span v-if="posts.length > 0"
                  class="text-xs px-2 py-0.5 rounded-full bg-[#D0D4F7]/10 text-[#D0D4F7] font-mono">
                  {{ posts.length }}
                </span>
              </span>
            </button>

            <button type="button" @click="activeTab = 'jobs'" class="font-Sora cursor-pointer transition-colors"
              :class="activeTab === 'jobs' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
              <span class="py-4 sm:py-5 flex items-center gap-2"
                :class="activeTab === 'jobs' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
                <span>Open Job Listings</span>
                <span v-if="openJobs.length > 0"
                  class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">
                  {{ openJobs.length }}
                </span>
              </span>
            </button>

            <button type="button" @click="activeTab = 'contact'" class="font-Sora cursor-pointer transition-colors"
              :class="activeTab === 'contact' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
              <span class="inline-block py-4 sm:py-5"
                :class="activeTab === 'contact' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
                Contact & Booking
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <main class="max-w-7xl mx-auto w-full px-4 sm:px-8 md:px-16 mt-6 sm:mt-8">
        <!-- ===================================================================== -->
        <!-- TAB 1: POSTS -->
        <!-- ===================================================================== -->
        <div v-if="activeTab === 'posts'" class="flex flex-col lg:flex-row gap-6 items-start w-full">
          <div class="flex-1 w-full min-w-0 flex flex-col gap-6">
            <!-- Empty State -->
            <article v-if="posts.length === 0"
              class="flex justify-center items-center border-[#46464D]/40 border-dashed border rounded-xl overflow-hidden shadow-lg w-full h-100 font-Sora bg-[#131315]/40">
              <div class="flex flex-col items-center gap-3 text-center p-6">
                <Icon name="lucide:megaphone-off" class="text-3xl sm:text-5xl text-[#D0D4F7]" />
                <h3 class="text-base sm:text-lg font-semibold text-white">No Posts Yet</h3>
                <p class="text-xs text-gray-400 max-w-sm font-Geist">
                  {{ business.Business_Name }} hasn't shared any updates or promos yet. Check back soon!
                </p>
              </div>
            </article>

            <!-- Posts List -->
            <template v-else>
              <article v-for="post in posts" :key="post.POST_ID"
                class="bg-[#1B1B1D] border border-[#46464D]/40 rounded-xl overflow-hidden w-full shadow-lg">
                <!-- Uploaded Media -->
                <div v-if="post.Media"
                  class="w-full aspect-video max-h-137.5 overflow-hidden bg-black/40 flex items-center justify-center">
                  <img :src="post.Media" alt="Post Media"
                    class="object-cover w-full h-full hover:scale-[1.02] transition-transform duration-500" />
                </div>

                <div class="flex flex-col gap-4 p-4 sm:p-6">
                  <div>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <div
                          class="w-10 h-10 rounded-full overflow-hidden bg-[#24242A] shrink-0 border border-white/20">
                          <img v-if="business.Profile_Picture" :src="business.Profile_Picture"
                            :alt="business.Business_Name" class="w-full h-full object-cover" />
                          <div v-else
                            class="w-full h-full bg-[#1E1E24] text-[#D0D4F7] font-bold text-xs flex items-center justify-center font-Sora uppercase">
                            {{ getBusinessInitials(business.Business_Name) }}
                          </div>
                        </div>
                        <h3 class="font-Sora text-base sm:text-[18px] font-semibold text-white">
                          {{ business.Business_Name }}
                        </h3>
                      </div>

                      <span v-if="post.Location" class="text-xs text-gray-400 font-Geist flex items-center gap-1">
                        <Icon name="ic:outline-location-on" class="text-sm text-[#D0D4F7]" />
                        {{ post.Location }}
                      </span>
                    </div>

                    <span class="font-HankenGrotesk text-xs text-[#C7C5CE] ml-13 block mt-0.5">
                      {{ formatPostTimestamp(post.Created_at) }}
                    </span>
                  </div>

                  <!-- Caption -->
                  <div v-if="post.Caption">
                    <p class="text-sm sm:text-base text-gray-300 leading-relaxed font-Geist whitespace-pre-line">
                      {{ post.Caption }}
                    </p>
                  </div>

                  <!-- Footer Actions (Like, Comment, Share) -->
                  <div class="flex justify-between items-center pt-2 border-t border-[#46464D]/20 text-sm">
                    <div class="flex gap-4 sm:gap-6 items-center">
                      <!-- Like Button -->
                      <button type="button" @click="toggleLike(post.POST_ID)"
                        class="flex gap-1.5 items-center cursor-pointer transition-colors"
                        :class="post.userHasLiked ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
                        <Icon :name="post.userHasLiked ? 'ic:baseline-favorite' : 'ic:baseline-favorite-border'"
                          class="text-xl sm:text-2xl text-[#D0D4F7] transition-transform active:scale-125" />
                        <span class="text-xs sm:text-sm font-medium"
                          :class="post.userHasLiked ? 'text-[#D0D4F7]' : 'text-[#C7C5CE]'">
                          {{ formatCount(post.likeCount) }}
                        </span>
                      </button>

                      <!-- Comments Button -->
                      <button type="button" @click="openPostDetail(post)"
                        class="flex gap-1.5 items-center text-[#C7C5CE] hover:text-[#D0D4F7] transition-colors cursor-pointer">
                        <Icon name="ic:sharp-chat-bubble-outline" class="text-xl sm:text-2xl text-[#D0D4F7]" />
                        <span class="text-xs sm:text-sm font-medium">
                          {{ formatCount(post.commentCount) }}
                        </span>
                      </button>
                    </div>

                    <button type="button" @click="handleSharePost(post)"
                      class="text-[#C7C5CE] hover:text-[#D0D4F7] transition-colors cursor-pointer" title="Share Post">
                      <Icon name="ic:round-share" class="text-xl sm:text-2xl" />
                    </button>
                  </div>
                </div>
              </article>
            </template>
          </div>
        </div>

        <!-- ===================================================================== -->
        <!-- TAB 2: OPEN JOB LISTINGS -->
        <!-- ===================================================================== -->
        <div v-else-if="activeTab === 'jobs'" class="space-y-6">
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#46464D]/25">
            <div>
              <h2 class="text-xl sm:text-2xl font-bold font-Sora text-white">Active Gigs & Opportunities</h2>
              <p class="text-xs sm:text-sm text-gray-400 font-Geist">Live listings posted by {{ business.Business_Name
              }}
              </p>
            </div>
            <span
              class="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-semibold w-fit">
              {{ openJobs.length }} Open
            </span>
          </div>

          <!-- Empty State -->
          <div v-if="openJobs.length === 0"
            class="w-full py-16 border border-[#46464D]/40 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-[#131315]/50">
            <div
              class="w-16 h-16 rounded-full bg-[#1E1E24] border border-white/10 flex items-center justify-center text-[#D0D4F7] mb-4">
              <Icon name="mdi:briefcase-outline" class="text-3xl" />
            </div>
            <h3 class="font-Sora text-lg font-semibold text-white mb-1">No Active Listings Right Now</h3>
            <p class="text-xs sm:text-sm text-gray-400 font-Geist max-w-md">
              {{ business.Business_Name }} has no open gigs or jobs posted currently. You can reach out directly via
              chat!
            </p>
            <button v-if="!isOwner" type="button" @click="handleInitiateChat"
              class="mt-4 px-5 py-2.5 rounded-xl bg-[#D0D4F7] hover:bg-white text-[#0E0E10] text-xs font-bold transition-all shadow-md cursor-pointer">
              Direct Message Business
            </button>
          </div>

          <!-- Jobs Grid -->
          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div v-for="job in openJobs" :key="job.Job_ID"
              class="bg-[#18181B] hover:bg-[#1E1E24] border border-[#3A3A3E] hover:border-[#D0D4F7]/60 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 shadow-md group">
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span
                    class="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-md bg-[#D0D4F7]/10 text-[#D0D4F7] border border-[#D0D4F7]/20">
                    {{ job.Job_Code || 'GIG' }}
                  </span>
                </div>

                <h3
                  class="font-Sora font-bold text-base sm:text-lg text-white group-hover:text-[#D0D4F7] transition-colors">
                  {{ job.Event_Title || 'Live Performance Gig' }}
                </h3>

                <p v-if="job.Description" class="text-xs text-gray-300 font-Geist line-clamp-3">
                  {{ job.Description }}
                </p>

                <div class="space-y-1 text-xs text-gray-400 font-Geist pt-1">
                  <p v-if="job.Location" class="flex items-center gap-1.5 truncate">
                    <Icon name="ic:baseline-location-on" class="text-sm text-[#D0D4F7] shrink-0" />
                    <span>{{ job.Location }}</span>
                  </p>
                  <p v-if="job.Event_Date" class="flex items-center gap-1.5">
                    <Icon name="ic:baseline-calendar-today" class="text-sm text-[#D0D4F7] shrink-0" />
                    <span>{{ job.Event_Date }}</span>
                  </p>
                </div>
              </div>

              <!-- Message / Inquire Action -->
              <div class="mt-5 pt-3 border-t border-[#2A2A2E] flex items-center justify-between">
                <span class="text-[11px] text-gray-500 font-mono">Status: Open</span>
                <button v-if="!isOwner" type="button" @click="handleInitiateChat"
                  class="flex items-center gap-1.5 text-xs text-[#D0D4F7] hover:text-white font-semibold transition-colors cursor-pointer">
                  <span>Inquire / Apply</span>
                  <Icon name="lucide:arrow-right" class="text-xs" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ===================================================================== -->
        <!-- TAB 3: CONTACT & BOOKING -->
        <!-- ===================================================================== -->
        <div v-else-if="activeTab === 'contact'" class="w-full space-y-6">
          <div class="flex gap-5">
            <div
              class="w-full border border-[#46464D]/40 border-dashed rounded-3xl p-8 sm:p-12 flex flex-col items-center justify-center text-center bg-[#131315]/50 shadow-xl">
              <div
                class="w-16 h-16 rounded-full bg-[#1E1E24] border border-[#46464D]/50 flex items-center justify-center mb-4 text-[#D0D4F7] text-3xl shadow-inner">
                <Icon name="ic:outline-alternate-email" />
              </div>

              <h3 class="font-Sora text-xl font-bold text-white mb-2">Connect & Direct Booking</h3>
              <p class="text-sm text-gray-400 max-w-md mb-6 font-Geist">
                Interested in collaborating, booking sound services, studio recording, or renting equipment from
                <span class="text-white font-semibold">{{ business.Business_Name }}</span>? Chat directly inside TONO.
              </p>

              <!-- Direct Chat Button in TONO -->
              <div class="flex flex-wrap items-center justify-center gap-3">
                <button v-if="!isOwner" type="button" @click="handleInitiateChat" :disabled="initiatingChat"
                  class="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#D0D4F7] hover:bg-white text-[#0E0E10] text-sm font-bold transition-all shadow-lg cursor-pointer disabled:opacity-50">
                  <Icon v-if="initiatingChat" name="svg-spinners:ring-resize" class="text-base" />
                  <Icon v-else name="mdi:message-text-outline" class="text-base" />
                  <span>Chat Now in TONO</span>
                </button>
              </div>
            </div>

            <!-- Official Social Media & Web Links Section -->
            <div class="rounded-3xl bg-[#131315] border border-[#2A2A2E] p-6 sm:p-8 space-y-4 shadow-lg">
              <div class="flex items-end justify-between">
                <div>
                  <h4 class="text-base sm:text-lg font-bold text-white font-Sora">Official Links & Socials</h4>
                  <p class="text-xs text-gray-400 font-Geist">Verified external channels</p>
                </div>
                <span class="text-xs text-gray-500 font-mono">{{ resolvedSocialLinks.length }} links</span>
              </div>

              <!-- Clickable Resolved Links Badges -->
              <div v-if="resolvedSocialLinks.length > 0"
                class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                <a v-for="(link, idx) in resolvedSocialLinks" :key="idx" :href="link.url" target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-3 p-3.5 rounded-2xl bg-[#18181B] hover:bg-[#1E1E24] border border-[#2E2E34] hover:border-[#D0D4F7]/60 text-white transition-all group shadow-sm cursor-pointer">
                  <div
                    class="w-9 h-9 rounded-xl bg-[#24242A] flex items-center justify-center text-lg text-[#D0D4F7] shrink-0">
                    <Icon :name="link.icon" />
                  </div>
                  <div class="flex flex-col min-w-0 flex-1">
                    <span class="text-[10px] text-gray-400 font-Geist uppercase tracking-wider">{{ link.platform
                      }}</span>
                    <span
                      class="text-xs sm:text-sm font-semibold text-gray-200 group-hover:text-[#D0D4F7] transition-colors truncate">
                      {{ link.label }}
                    </span>
                  </div>
                  <Icon name="lucide:external-link"
                    class="text-xs text-gray-500 group-hover:text-[#D0D4F7] shrink-0 transition-colors" />
                </a>
              </div>

              <!-- Empty Social Links Notice -->
              <p v-else class="text-xs text-gray-500 italic pt-1">
                No external social media links listed. Connect directly using TONO Message.
              </p>
            </div>
          </div>
        </div>
      </main>

      <!-- Post Detail Modal Component (For comments & like counter) -->
      <PostDetailModal :is-open="isPostModalOpen" :post="selectedPost"
        :artist-name="business?.Business_Name || 'Business'" :artist-avatar="business?.Profile_Picture"
        @close="closePostModal" />
    </div>
  </div>
</template>
