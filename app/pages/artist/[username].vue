<script setup lang="ts">
definePageMeta({
  layout: false
})

import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { getMilestoneInitials } from '~/utils/milestoneHelper'

const route = useRoute()
const username = computed(() => (route.params.username as string) || '')
const supabase = useSupabaseClient()
const db = supabase as any

import type { PostItem } from '~/composables/useArtistPosts'
import { formatPostTimestamp, formatCount } from '~/utils/postHelpers'

const { posts, fetchArtistPosts, toggleLike } = useArtistPosts()

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


// User auth & role state
const currentUser = useSupabaseUser()
const { fetchCurrentUserProfile } = useTonoAuth()
const currentUserRole = ref<'artist' | 'user' | 'business' | 'guest'>('guest')

// Share Toast notification state
const isCopied = ref(false)

// Direct Booking Modal & Toast State
const isBookingModalOpen = ref(false)
const bookingSuccessToast = ref('')

watch(isBookingModalOpen, (isOpen) => {
  // Check import.meta.client so it runs only in the browser (avoids Nuxt SSR errors)
  if (import.meta.client) {
    document.body.style.overflow = isOpen ? 'hidden' : ''
  }
})

const handleBookingSubmit = (payload: any) => {
  bookingSuccessToast.value = `Booking contract offer ${payload?.Contract_Code || ''} sent to ${displayName.value}!`
  setTimeout(() => {
    bookingSuccessToast.value = ''
  }, 5000)
}

// ---------------------------------------------------------------------------
// 1. SSR Public Data Fetching via useAsyncData
// ---------------------------------------------------------------------------
const { data: profileData, error: fetchError } = await useAsyncData(
  `artist-profile-${username.value}`,
  async () => {
    if (!username.value) {
      throw createError({ statusCode: 404, statusMessage: 'Artist username required' })
    }

    // A. Fetch User Account by Username (case-insensitive)
    const { data: userAcc, error: userErr } = await db
      .from('USER_ACCOUNT')
      .select('ACCOUNT_ID, Username, City, Barangay, Profile_Picture, Cover_Picture')
      .ilike('Username', username.value)
      .maybeSingle()

    if (userErr || !userAcc) {
      console.error('[ArtistProfile] User account not found:', userErr || username.value)
      throw createError({ statusCode: 404, statusMessage: 'Artist Not Found', fatal: false })
    }

    // B. Fetch Artist Record linked to this Account
    const { data: artist, error: artistErr } = await db
      .from('ARTIST')
      .select(`
        ARTIST_ID,
        ACCOUNT_ID,
        Artist_Type,
        Bio,
        Is_Verified,
        Status,
        SOLO_ARTIST (
          Artist_Name,
          Specialty
        ),
        BAND (
          Band_Name
        )
      `)
      .eq('ACCOUNT_ID', userAcc.ACCOUNT_ID)
      .maybeSingle()

    if (artistErr || !artist) {
      console.error('[ArtistProfile] Artist record not found:', artistErr)
      throw createError({ statusCode: 404, statusMessage: 'Artist Not Found', fatal: false })
    }

    // Attach user account data to artist object
    artist.USER_ACCOUNT = userAcc

    const artistId = artist.ARTIST_ID

    // B. Fetch Artist Genres & Instruments
    let genres: string[] = []
    let instruments: string[] = []

    if (artist.Artist_Type === 'Band') {
      const { data: bandGenreRows } = await db
        .from('BAND_GENRES')
        .select('Genre_ID')
        .eq('ARTIST_ID', artistId)

      const genreIds = (bandGenreRows ?? []).map((r: any) => r.Genre_ID)
      if (genreIds.length) {
        const { data: genreRows } = await db
          .from('TAG_GENRE')
          .select('Name')
          .in('Genre_ID', genreIds)
        genres = (genreRows ?? []).map((r: any) => r.Name).filter(Boolean)
      }
    } else {
      const { data: soloGenreRows } = await db
        .from('SOLO_GENRES')
        .select('Genre_ID')
        .eq('ARTIST_ID', artistId)

      const genreIds = (soloGenreRows ?? []).map((r: any) => r.Genre_ID)
      if (genreIds.length) {
        const { data: genreRows } = await db
          .from('TAG_GENRE')
          .select('Name')
          .in('Genre_ID', genreIds)
        genres = (genreRows ?? []).map((r: any) => r.Name).filter(Boolean)
      }

      const { data: soloInstRows } = await db
        .from('SOLO_INSTRUMENTS')
        .select('Instrument_ID')
        .eq('ARTIST_ID', artistId)

      const instIds = (soloInstRows ?? []).map((r: any) => r.Instrument_ID)
      if (instIds.length) {
        const { data: instRows } = await db
          .from('TAG_INSTRUMENT')
          .select('Name')
          .in('Instrument_ID', instIds)
        instruments = (instRows ?? []).map((r: any) => r.Name).filter(Boolean)
      }
    }

    // Fallback: If no artist-specific tags found, check account preferences
    if (!genres.length) {
      const { data: prefGenreRows } = await db
        .from('ACCOUNT_PREF_GENRE')
        .select('Genre_ID')
        .eq('ACCOUNT_ID', userAcc.ACCOUNT_ID)

      const genreIds = (prefGenreRows ?? []).map((r: any) => r.Genre_ID)
      if (genreIds.length) {
        const { data: genreRows } = await db
          .from('TAG_GENRE')
          .select('Name')
          .in('Genre_ID', genreIds)
        genres = (genreRows ?? []).map((r: any) => r.Name).filter(Boolean)
      }
    }

    if (!instruments.length && artist.Artist_Type !== 'Band') {
      const { data: prefInstRows } = await db
        .from('ACCOUNT_PREF_INSTRUMENTS')
        .select('Instrument_ID')
        .eq('ACCOUNT_ID', userAcc.ACCOUNT_ID)

      const instIds = (prefInstRows ?? []).map((r: any) => r.Instrument_ID)
      if (instIds.length) {
        const { data: instRows } = await db
          .from('TAG_INSTRUMENT')
          .select('Name')
          .in('Instrument_ID', instIds)
        instruments = (instRows ?? []).map((r: any) => r.Name).filter(Boolean)
      }
    }

    console.log('[ArtistProfile] Tags resolved for', username.value, {
      genres,
      instruments,
      combined: [...genres, ...instruments]
    })

    // C. Fetch Portfolio Links (Media & Audio Embeds)
    const { data: linksData } = await db
      .from('PORTFOLIO_LINK')
      .select('*')
      .eq('ARTIST_ID', artistId)
      .order('Display_Order', { ascending: true })

    const allLinks = linksData || []
    const mediaItems = allLinks
      .filter((l: any) => l.Category === 'media_embed')
      .map((l: any) => ({
        id: l.LINK_ID,
        artistId: l.ARTIST_ID,
        category: 'media_embed',
        platform: l.Platform || 'youtube',
        title: l.Title || l.Display_Text || '',
        displayText: l.Display_Text || '',
        url: l.URL,
        displayOrder: l.Display_Order ?? 0,
      }))

    const audioItems = allLinks
      .filter((l: any) => l.Category === 'audio_embed')
      .map((l: any) => ({
        id: l.LINK_ID,
        artistId: l.ARTIST_ID,
        category: 'audio_embed',
        platform: l.Platform || 'spotify',
        title: l.Title || l.Display_Text || '',
        displayText: l.Display_Text || '',
        url: l.URL,
        displayOrder: l.Display_Order ?? 0,
      }))

    // D. Fetch Portfolio Media (Milestones & Promotional Posters)
    const { data: mediaData } = await db
      .from('PORTFOLIO_MEDIA')
      .select('*')
      .eq('ARTIST_ID', artistId)
      .order('Display_Order', { ascending: true })

    const allMedia = mediaData || []
    const milestoneItems = allMedia
      .filter((m: any) => m.Category === 'milestone')
      .map((m: any) => ({
        id: m.MEDIA_ID,
        artistId: m.ARTIST_ID,
        category: 'milestone',
        title: m.Title || m.Description || 'Milestone',
        description: m.Description || '',
        eventDate: m.Event_Date || '',
        fileUrl: m.File_URL || '',
        displayOrder: m.Display_Order ?? 0,
      }))

    const posterItems = allMedia
      .filter((m: any) => m.Category === 'poster')
      .map((m: any) => ({
        id: m.MEDIA_ID,
        artistId: m.ARTIST_ID,
        category: 'poster',
        title: m.Title || '',
        fileUrl: m.File_URL || '',
        displayOrder: m.Display_Order ?? 0,
      }))

    // E. Fetch Upcoming Confirmed Bookings / Events
    const { data: upcomingEventsData } = await db
      .from('BOOKING_CONTRACT')
      .select(`
        Booking_ID,
        Contract_Code,
        Job_ID,
        Booking_Type,
        Start_Date,
        End_Date,
        Event_Date,
        Start_Time,
        End_Time,
        Venue_Location,
        Status,
        JOB_LISTING (
          Event_Title,
          Location
        ),
        BUSINESS_PROFILE:Provider_Business_ID (
          Business_Name,
          Business_Address
        )
      `)
      .eq('Provider_Artist_ID', artistId)
      .in('Status', ['Confirmed', 'Active'])
      .order('Start_Date', { ascending: true })

    const upcomingEvents = upcomingEventsData || []

    return {
      artist,
      genres,
      instruments,
      mediaItems,
      audioItems,
      milestoneItems,
      posterItems,
      upcomingEvents,
    }
  }
)

// Fetch posts for artist
watch(
  () => profileData.value?.artist?.ARTIST_ID,
  async (artistId) => {
    if (artistId) {
      await fetchArtistPosts(artistId)
    }
  },
  { immediate: true }
)

// ---------------------------------------------------------------------------
// 2. Computed Display & SEO Meta Data
// ---------------------------------------------------------------------------
const artistRecord = computed(() => profileData.value?.artist)

const displayName = computed(() => {
  if (!artistRecord.value) return 'Artist'
  return (
    artistRecord.value.BAND?.Band_Name ||
    artistRecord.value.SOLO_ARTIST?.Artist_Name ||
    artistRecord.value.USER_ACCOUNT?.Username ||
    'Artist'
  )
})

const artistTypeLabel = computed(() => {
  if (!artistRecord.value) return 'Artist'
  return artistRecord.value.Artist_Type === 'Band' ? 'Band' : 'Solo Artist'
})

const artistBio = computed(() => artistRecord.value?.Bio || '')
const profilePicture = computed(() => artistRecord.value?.USER_ACCOUNT?.Profile_Picture || null)
const coverPicture = computed(() => artistRecord.value?.USER_ACCOUNT?.Cover_Picture || null)
const artistCity = computed(() => artistRecord.value?.USER_ACCOUNT?.City || null)
const artistBarangay = computed(() => artistRecord.value?.USER_ACCOUNT?.Barangay || null)

const artistTags = computed(() => {
  const g = profileData.value?.genres || []
  const i = profileData.value?.instruments || []
  return [...g, ...i]
})

const tagsDisplay = computed(() => {
  if (artistTags.value.length === 0) return 'No tags listed'
  return artistTags.value.join(', ')
})

const isOwner = computed(() => {
  if (!currentUser.value || !artistRecord.value) return false
  return currentUser.value.id === artistRecord.value.ACCOUNT_ID
})

// Upcoming Events for Posts Tab Sidebar
const upcomingEvents = computed(() => {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (profileData.value?.upcomingEvents || [])
    .filter((e: any) => {
      const dateStr = (e.End_Date || e.Start_Date || e.Event_Date || e.JOB_LISTING?.Start_Date || '').split('T')[0]
      return !dateStr || dateStr >= todayStr
    })
    .sort((a: any, b: any) => {
      const da = (a.Start_Date || a.Event_Date || a.JOB_LISTING?.Start_Date || '').split('T')[0]
      const db = (b.Start_Date || b.Event_Date || b.JOB_LISTING?.Start_Date || '').split('T')[0]
      return da.localeCompare(db)
    })
    .slice(0, 4)
    .map((e: any) => {
      const rawDate = e.Start_Date || e.Event_Date || e.JOB_LISTING?.Start_Date || ''
      let day = '--'
      let month = 'TBD'

      if (rawDate) {
        const clean = String(rawDate).split('T')[0] || ''
        const parts = clean.split('-')
        const y = Number(parts[0])
        const m = Number(parts[1])
        const d = Number(parts[2])
        if (y && m && d) {
          const dateObj = new Date(y, m - 1, d)
          day = String(dateObj.getDate())
          month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase()
        }
      }

      const title = e.JOB_LISTING?.Event_Title || (e.Booking_Type === 'Direct' ? 'Direct Booking' : 'Live Performance')
      const location = e.Venue_Location || e.JOB_LISTING?.Location || e.BUSINESS_PROFILE?.Business_Address || e.BUSINESS_PROFILE?.Business_Name || (artistCity.value || 'Venue TBD')

      return {
        id: e.Booking_ID || e.Contract_Code || Math.random().toString(),
        day,
        month,
        title,
        location,
      }
    })
})

// Tab Navigation
const activeTab = ref<'posts' | 'calendar' | 'portfolio' | 'contact'>('posts')

// Fallback preview URL helper
const fallbackShareImage = 'https://tono.ph/images/tono-og-cover.jpg'

// ---------------------------------------------------------------------------
// 3. Open Graph & Twitter Cards Metadata (Server-Side Rendered for Bots)
// ---------------------------------------------------------------------------
useServerSeoMeta({
  title: () => `${displayName.value} (${artistTypeLabel.value}) | TONO`,
  ogTitle: () => `${displayName.value} • ${artistTypeLabel.value} | TONO`,
  description: () =>
    `${displayName.value} is a ${artistTypeLabel.value} on TONO. Explore their music, gigs, and profile.`,
  ogDescription: () =>
    `${displayName.value} is a ${artistTypeLabel.value} on TONO. Explore their music, gigs, and profile.`,
  // Cover picture provides the wide 16:9 landscape banner for social cards; falls back to profile avatar
  ogImage: () => coverPicture.value || profilePicture.value || fallbackShareImage,
  ogType: 'profile',
  twitterCard: 'summary_large_image',
  twitterTitle: () => `${displayName.value} • ${artistTypeLabel.value} | TONO`,
  twitterDescription: () =>
    `${displayName.value} is a ${artistTypeLabel.value} on TONO. Explore their music, gigs, and profile.`,
  twitterImage: () => coverPicture.value || profilePicture.value || fallbackShareImage,
})

// ---------------------------------------------------------------------------
// 4. Client Lifecycle & Interactive Utilities
// ---------------------------------------------------------------------------
const backToDiscoveryRoute = computed(() => {
  if (currentUserRole.value === 'artist') {
    return '/Artisthome'
  }
  return '/userhome'
})

onMounted(async () => {
  if (currentUser.value) {
    try {
      const profile = await fetchCurrentUserProfile()
      if (profile?.artistProfile) {
        currentUserRole.value = 'artist'
      } else if (profile?.businessProfile) {
        currentUserRole.value = 'business'
      } else {
        currentUserRole.value = 'user'
      }
    } catch {
      currentUserRole.value = 'user'
    }
  } else {
    currentUserRole.value = 'guest'
  }
})

const handleShareProfile = async () => {
  if (typeof window === 'undefined') return
  const shareUrl = window.location.href

  if (navigator.share) {
    try {
      await navigator.share({
        title: `${displayName.value} on TONO`,
        text: `Listen to and connect with ${displayName.value} on TONO!`,
        url: shareUrl,
      })
      return
    } catch {
      // Fall through to clipboard if user dismissed share dialog
    }
  }

  try {
    await navigator.clipboard.writeText(shareUrl)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 3000)
  } catch (err) {
    console.warn('Clipboard write error:', err)
  }
}

// ---------------------------------------------------------------------------
// Scroll & Parallax / Zoom-Out Behavior (Spotify Artist Profile Style)
// ---------------------------------------------------------------------------
const scrollY = ref(0)
let ticking = false

const handleScroll = () => {
  if (!ticking) {
    window.requestAnimationFrame(() => {
      if (import.meta.client) {
        scrollY.value = window.scrollY || document.documentElement.scrollTop || 0
      }
      ticking = false
    })
    ticking = true
  }
}

onMounted(() => {
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

const scrollToTop = () => {
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// When at top (scrollY = 0), banner starts with a slight zoom (scale 1.15)
// As user scrolls down, scale zooms out smoothly down to 1.0 (Spotify effect)
const coverScale = computed(() => {
  const scale = 1.15 - (scrollY.value / 2500)
  return Math.max(1.0, Number(scale.toFixed(3)))
})

// Parallax translation: image moves down at ~35% scroll speed
const coverTranslateY = computed(() => {
  return Math.min(120, Math.round(scrollY.value * 0.35))
})

const bannerTransformStyle = computed(() => ({
  transform: `scale(${coverScale.value}) translateY(${coverTranslateY.value}px)`,
  willChange: 'transform'
}))

// Progressive dark overlay as user scrolls down (Spotify depth fade)
const scrollDarkOverlayOpacity = computed(() => {
  const opacity = (scrollY.value / 320) * 0.75
  return Math.min(0.85, Number(opacity.toFixed(2)))
})

// Spotify sticky title threshold: appears once the main header scrolls past 200px
const isScrolled = computed(() => scrollY.value > 200)
</script>

<template>
  <div class="min-h-screen bg-[#0E0E10] text-white flex flex-col pb-16">
    <!-- Dynamic Top Navigation based on Viewer Session -->
    <ArtistNav
      v-if="currentUserRole === 'artist'"
      :scrolled-title="displayName"
      :scrolled-avatar="profilePicture"
      :is-scrolled="isScrolled"
      :is-verified="!!artistRecord?.Is_Verified"
      @scroll-to-top="scrollToTop"
    />
    <UserNav
      v-else-if="currentUserRole === 'user' || currentUserRole === 'business'"
      :scrolled-title="displayName"
      :scrolled-avatar="profilePicture"
      :is-scrolled="isScrolled"
      :is-verified="!!artistRecord?.Is_Verified"
      @scroll-to-top="scrollToTop"
    />
    <header v-else
      class="w-full bg-[#131315]/90 backdrop-blur-md border-b border-[#46464D]/75 px-4 sm:px-8 md:px-10 py-3 sm:py-4 flex items-center justify-between z-40 sticky top-0">
      <!-- Brand / Logo & Scrolled Artist Title -->
      <div class="flex items-center gap-2.5 sm:gap-3.5 shrink-0 min-w-0">
        <NuxtLink :to="backToDiscoveryRoute" class="flex items-center gap-2.5 shrink-0">
          <span class="text-2xl font-black tracking-wider text-white font-Sora">TONO</span>
          <span v-if="!isScrolled" class="text-[11px] px-2 py-0.5 rounded-full bg-[#D0D4F7]/10 text-[#D0D4F7] font-mono tracking-wide">
            LOCAL ARTIST
          </span>
        </NuxtLink>

        <!-- Scrolled Artist Display when scrolled down -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 -translate-x-2 scale-95"
          enter-to-class="opacity-100 translate-x-0 scale-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-x-0 scale-100"
          leave-to-class="opacity-0 -translate-x-2 scale-95">
          <div
            v-if="isScrolled"
            @click="scrollToTop"
            class="flex items-center gap-2 sm:gap-2.5 pl-2.5 sm:pl-3.5 border-l border-[#46464D]/70 cursor-pointer group/scrolled min-w-0"
            title="Scroll to top">
            <img
              v-if="profilePicture"
              :src="profilePicture"
              :alt="displayName"
              class="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover shrink-0 ring-1 ring-[#D0D4F7]/40 shadow-sm" />
            <div
              v-else
              class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#353437] flex items-center justify-center shrink-0">
              <Icon name="ic:outline-account-circle" class="w-4 h-4 sm:w-5 sm:h-5 text-[#D0D4F7]" />
            </div>

            <div class="flex items-center gap-1.5 min-w-0">
              <span
                class="font-Sora font-bold text-xs sm:text-sm text-white group-hover/scrolled:text-[#D0D4F7] transition-colors truncate max-w-30 sm:max-w-55">
                {{ displayName }}
              </span>
              <Icon
                v-if="artistRecord?.Is_Verified"
                name="ic:round-verified"
                class="text-emerald-400 text-xs sm:text-sm shrink-0" />
            </div>
          </div>
        </Transition>
      </div>

      <div class="flex items-center gap-3 sm:gap-4 shrink-0">
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

    <!-- Floating Copy Toast -->
    <div v-if="isCopied"
      class="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#1E1E24] border border-[#D0D4F7]/60 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
      <Icon name="ic:round-check-circle" class="text-emerald-400 text-lg" />
      <span class="text-xs sm:text-sm font-medium">Link copied to clipboard! Ready to share.</span>
    </div>

    <!-- 404 / Error State if Artist Not Found -->
    <div v-if="fetchError || !artistRecord"
      class="max-w-xl mx-auto my-24 p-8 bg-[#131315] border border-[#3A3A3C] rounded-2xl text-center flex flex-col items-center gap-4 shadow-xl">
      <div
        class="w-16 h-16 rounded-full bg-red-950/40 border border-red-800/40 flex items-center justify-center text-red-400 text-3xl">
        <Icon name="ic:outline-sentiment-very-dissatisfied" />
      </div>
      <h1 class="text-2xl font-Sora font-bold text-white">Artist Not Found</h1>
      <p class="text-sm text-gray-400">
        We couldn't find an artist with the username <span class="text-[#D0D4F7] font-mono">@{{ username }}</span>. They
        may have changed their username or the link might be incorrect.
      </p>
      <NuxtLink :to="backToDiscoveryRoute"
        class="mt-2 px-5 py-2 rounded-xl bg-[#D0D4F7] hover:bg-white text-[#0E0E10] font-semibold text-xs sm:text-sm transition-all shadow-md">
        Back to Discovery
      </NuxtLink>
    </div>

    <!-- Main Profile Content -->
    <div v-else>
      <!-- Header Banner & Profile Info (Exact Layout as Artistprofile.vue) -->
      <div class="relative w-full overflow-hidden bg-[#131315] border-b border-[#46464D]/20">
        <!-- Background Banner Image with Zoom-Out & Parallax (Spotify Behavior) -->
        <div class="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img v-if="coverPicture" :src="coverPicture" alt="Profile Banner"
            class="w-full h-full object-cover object-center opacity-70 mask-x-from-70% mask-x-to-90% transition-transform duration-75 ease-out origin-center"
            :style="bannerTransformStyle" />
          <div v-else class="w-full h-full bg-linear-to-r from-[#1E1E24] to-[#121215] opacity-80 transition-transform duration-75 ease-out origin-center"
            :style="bannerTransformStyle"></div>

          <!-- Base soft gradient overlay for contrast on mobile and desktop -->
          <div
            class="absolute inset-0 bg-linear-to-t from-[#0E0E10] via-[#0E0E10]/40 to-transparent md:bg-linear-to-r md:from-[#0E0E10]/90 md:via-[#0E0E10]/60 md:to-transparent">
          </div>

          <!-- Dynamic progressive dark overlay on scroll (Spotify depth fade) -->
          <div
            class="absolute inset-0 bg-[#0E0E10] transition-opacity duration-75 ease-out"
            :style="{ opacity: scrollDarkOverlayOpacity }">
          </div>
        </div>

        <!-- Action Toolbar (Share Profile & Owner Edit Profile) -->
        <div class="absolute top-4 right-4 sm:top-6 sm:right-8 md:right-16 z-20 flex items-center gap-2.5">
          <!-- Owner Direct Link to Editor -->
          <NuxtLink v-if="isOwner" to="/Artistprofile"
            class="flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-[#D0D4F7] hover:bg-white text-[#0E0E10] text-xs sm:text-sm font-semibold transition-all shadow-lg group"
            title="Edit your artist profile">
            <Icon name="ic:outline-edit" class="text-base" />
            <span>Edit Profile</span>
          </NuxtLink>

          <!-- Share Profile Action Button -->
          <button @click="handleShareProfile"
            class="flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/10 text-xs sm:text-sm text-gray-200 hover:text-white transition-all cursor-pointer shadow-lg group"
            title="Share this profile">
            <Icon name="ic:round-share" class="text-base text-[#C7C5CE] group-hover:text-[#D0D4F7] transition-colors" />
            <span>Share</span>
          </button>
        </div>

        <!-- Loaded Header Info (Public View - Clean Full Banner Layout) -->
        <div
          class="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-8 sm:py-12 min-h-75 md:min-h-90 flex flex-col items-start text-left justify-end gap-2">
          <!-- Artist Details -->
          <div class="flex flex-col items-start text-left gap-2 min-w-0 max-w-3xl">
            <div class="flex items-center gap-2">
              <span class="font-Geist font-medium text-xs sm:text-[14px] text-[#D0D4F7]/90 tracking-wider uppercase">
                {{ artistTypeLabel }}
              </span>
              <span v-if="artistRecord.Is_Verified"
                class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                <Icon name="ic:round-verified" class="text-xs" />
                Verified
              </span>
            </div>

            <h1
              class="font-Sora font-bold text-3xl sm:text-5xl lg:text-[64px] tracking-tight text-white leading-tight wrap-break-word max-w-full drop-shadow-md">
              {{ displayName }}
            </h1>

            <span class="font-mono text-xs sm:text-sm text-gray-300">
              @{{ artistRecord.USER_ACCOUNT?.Username }}
            </span>

            <div class="max-w-xl my-1">
              <p v-if="artistBio"
                class="text-xs sm:text-sm md:text-[15px] text-gray-200/90 leading-relaxed line-clamp-3 md:line-clamp-4 drop-shadow-sm">
                {{ artistBio }}
              </p>
              <p v-else class="text-xs sm:text-sm text-gray-400/70 italic">
                Local artist on TONO.
              </p>
            </div>

            <div
              class="flex flex-wrap items-center justify-start gap-2 bg-black/30 backdrop-blur-xs p-3 py-1.5 rounded-lg max-w-full border border-white/10">
              <span class="font-HankenGrotesk text-xs sm:text-[15px] text-gray-300 font-bold shrink-0">
                Artist Tags:
              </span>
              <span class="text-xs sm:text-[15px] text-[#D0D4F7] font-medium wrap-break-word">
                {{ tagsDisplay }}
              </span>
            </div>

            <div v-if="artistCity" class="flex items-center gap-1.5 text-xs text-gray-300 mt-0.5">
              <Icon name="ic:baseline-location-on" class="text-sm text-[#D0D4F7]" />
              <span>{{ artistCity }}{{ artistBarangay ? ' • ' + artistBarangay : '' }}</span>
            </div>

            <div @click="isBookingModalOpen = true"
              class="flex items-center px-6 py-2.5 bg-[#B4B8DA] hover:bg-white text-[#151A34] gap-2 rounded-full mt-3 font-Geist cursor-pointer transition-colors shadow-lg group">
              <Icon name="ic:baseline-calendar-today" class="text-sm group-hover:scale-110 transition-transform" />
              <button class="font-medium cursor-pointer">BOOK</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs (Exact Layout as Artistprofile.vue) -->
      <div class="w-full border-b border-[#46464D]/20 bg-[#0E0E10]">
        <div class="max-w-7xl mx-auto px-4 sm:px-8 md:px-16 overflow-x-auto scrollbar-hide">
          <div class="flex justify-center sm:justify-start gap-8 sm:gap-12 text-[15px] sm:text-[17px] min-w-max">
            <button @click="activeTab = 'posts'" class="font-Sora cursor-pointer transition-colors"
              :class="activeTab === 'posts' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
              <span class="inline-block py-4 sm:py-5"
                :class="activeTab === 'posts' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
                Posts
              </span>
            </button>

            <button @click="activeTab = 'calendar'" class="font-Sora cursor-pointer transition-colors"
              :class="activeTab === 'calendar' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
              <span class="inline-block py-4 sm:py-5"
                :class="activeTab === 'calendar' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
                Calendar
              </span>
            </button>

            <button @click="activeTab = 'portfolio'" class="font-Sora cursor-pointer transition-colors"
              :class="activeTab === 'portfolio' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
              <span class="inline-block py-4 sm:py-5"
                :class="activeTab === 'portfolio' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
                Portfolio
              </span>
            </button>

            <button @click="activeTab = 'contact'" class="font-Sora cursor-pointer transition-colors"
              :class="activeTab === 'contact' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
              <span class="inline-block py-4 sm:py-5"
                :class="activeTab === 'contact' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
                Contact
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <main class="max-w-7xl mx-auto w-full px-4 sm:px-8 md:px-16 mt-6 sm:mt-8">
        <!-- 1. Posts Tab Content -->
        <div v-if="activeTab === 'posts'" class="flex flex-col lg:flex-row gap-6 items-start w-full">
          <!-- Left: Feed Column -->
          <div class="flex-1 w-full min-w-0 flex flex-col gap-6">
            <!-- Empty State (When artist has 0 posts) -->
            <article
              v-if="posts.length === 0"
              class="flex justify-center items-center border-[#46464D]/40 border-dashed border rounded-xl overflow-hidden shadow-lg w-full h-[623.38px] font-Sora"
            >
              <div class="flex flex-col items-center gap-3">
                <Icon name="lucide:megaphone-off" class="text-xl sm:text-[3rem] text-[#D0D4F7]" />
                <h1 class="text-lg">No Posts Yet</h1>
              </div>
            </article>

            <!-- With Post State (When artist has posts) -->
            <template v-else>
              <article
                v-for="post in posts"
                :key="post.POST_ID"
                class="bg-[#1B1B1D] border border-[#46464D]/40 rounded-xl overflow-hidden w-full shadow-lg"
              >
                <!-- 1. Uploaded Image: IF NO IMAGE HIDE THE DIV COMPLETELY (NO PLACEHOLDER IMAGE) -->
                <div
                  v-if="post.Media"
                  class="w-full aspect-video max-h-137.5 overflow-hidden bg-black/40 flex items-center justify-center"
                >
                  <img
                    :src="post.Media"
                    alt="Post Media"
                    class="object-cover w-full h-full hover:scale-[1.02] transition-transform duration-500"
                  />
                </div>

                <div class="flex flex-col gap-4 p-4 sm:p-6">
                  <div>
                    <div class="flex items-center justify-between">
                      <h3 class="font-Sora text-base sm:text-[18px] font-semibold text-white">
                        {{ displayName }}
                      </h3>
                      <span
                        v-if="post.Location"
                        class="text-xs text-gray-400 font-Geist flex items-center gap-1"
                      >
                        <Icon name="ic:outline-location-on" class="text-sm text-[#D0D4F7]" />
                        {{ post.Location }}
                      </span>
                    </div>
                    <span class="font-HankenGrotesk text-xs text-[#C7C5CE]">
                      {{ formatPostTimestamp(post.Created_at) }}
                    </span>
                  </div>

                  <div v-if="post.Caption">
                    <p class="text-sm sm:text-base text-gray-300 leading-relaxed font-Geist whitespace-pre-line">
                      {{ post.Caption }}
                    </p>
                  </div>

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

                      <!-- Comments Button -->
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

                    <button
                      type="button"
                      @click="handleShareProfile"
                      class="text-[#C7C5CE] hover:text-[#D0D4F7] transition-colors cursor-pointer"
                      title="Share Post"
                    >
                      <Icon name="ic:round-share" class="text-xl sm:text-2xl" />
                    </button>
                  </div>
                </div>
              </article>
            </template>

          </div>



          <!-- Right: Upcoming Events Sidebar -->
          <aside
            class="w-full lg:w-80 xl:w-92 shrink-0 bg-[#1B1B1D] border border-[#46464D]/30 rounded-xl p-5 sm:p-6 flex flex-col justify-between gap-6 shadow-lg">
            <div class="flex flex-col gap-4">
              <h2 class="font-Sora text-lg sm:text-[20px] text-[#D0D4F7] font-semibold">
                Upcoming Events
              </h2>

              <div class="flex flex-col gap-3 sm:gap-4">
                <template v-if="upcomingEvents.length > 0">
                  <div
                    v-for="event in upcomingEvents"
                    :key="event.id"
                    @click="activeTab = 'calendar'"
                    class="flex items-center gap-3 sm:gap-4 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div
                      class="flex p-2.5 sm:p-3 border border-[#B4B8DA]/20 rounded-lg bg-[#B4B8DA]/10 items-center justify-center w-12 h-12 sm:w-14 sm:h-14 shrink-0 text-center"
                    >
                      <div class="flex flex-col font-HankenGrotesk leading-tight">
                        <span class="text-sm sm:text-base font-bold text-white">{{ event.day }}</span>
                        <span class="text-[10px] text-[#D0D4F7] uppercase tracking-wider font-semibold">{{ event.month }}</span>
                      </div>
                    </div>

                    <div class="flex flex-col min-w-0">
                      <h4 class="font-medium text-sm sm:text-base text-white truncate">{{ event.title }}</h4>
                      <p class="text-xs text-gray-400 truncate">{{ event.location }}</p>
                    </div>
                  </div>
                </template>

                <div
                  v-else
                  class="py-8 flex flex-col items-center justify-center text-center gap-2 border border-dashed border-[#46464D]/40 rounded-xl bg-white/2"
                >
                  <Icon name="lucide:calendar-off" class="text-2xl text-[#C7C5CE]/50" />
                  <p class="text-xs text-[#C7C5CE]/80 font-Geist">no upcoming events</p>
                </div>
              </div>
            </div>

            <button @click="activeTab = 'calendar'"
              class="w-full flex items-center justify-center p-3 border rounded-lg border-[#D0D4F7]/60 hover:border-[#D0D4F7] hover:bg-[#D0D4F7]/10 font-Geist font-medium text-xs sm:text-sm text-[#D0D4F7] transition-all cursor-pointer">
              <span>VIEW ALL EVENTS</span>
            </button>
          </aside>
        </div>

        <!-- 2. Calendar Tab Content Container -->
        <div v-else-if="activeTab === 'calendar'" class="w-full">
          <ArtistGigCalendar v-if="artistRecord?.ARTIST_ID" :artist-id="artistRecord.ARTIST_ID" :is-owner="isOwner" />
          <div v-else
            class="w-full min-h-100 border border-[#46464D]/40 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-[#131315]/50">
            <div
              class="w-14 h-14 rounded-full bg-[#1E1E24] border border-[#46464D]/50 flex items-center justify-center mb-4">
              <Icon name="ic:outline-calendar-month" class="text-2xl text-[#D0D4F7]" />
            </div>
            <h3 class="font-Sora text-lg font-semibold text-white mb-2">Gig & Performance Schedule</h3>
            <p class="text-sm text-gray-400 max-w-md">
              Gig schedule is currently unavailable.
            </p>
          </div>
        </div>

        <!-- 3. Portfolio Tab Content Container (Read-Only Exact Layout) -->
        <div v-else-if="activeTab === 'portfolio'" class="w-full flex flex-col gap-6 sm:gap-8">
          <!-- Top Row: Media Showcase (8 cols on lg) & Released Songs (4 cols on lg) -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <!-- Left Column: Media Articles (YouTube / Videos) -->
            <div class="lg:col-span-8 flex flex-col gap-4 h-full">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <h2 class="text-xl font-Sora font-medium text-white">Media</h2>
                  <span v-if="profileData?.mediaItems?.length"
                    class="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#1E1E24] border border-[#46464D]/50 text-[#D0D4F7]">
                    {{ profileData.mediaItems.length }}
                  </span>
                </div>
              </div>

              <!-- Live Media Items List -->
              <div class="flex flex-col gap-6 flex-1">
                <template v-if="profileData?.mediaItems?.length">
                  <article v-for="item in profileData.mediaItems" :key="item.id"
                    class="bg-[#1C1C1F]/60 border border-[#46464D]/40 rounded-xl overflow-hidden w-full shadow-lg">
                    <div class="p-3 sm:p-4">
                      <MediaEmbed :url="item.url" :title="item.title" />
                    </div>

                    <div class="flex flex-col gap-2 p-4 sm:py-4 sm:pt-0">
                      <h3 v-if="item.title" class="font-Sora text-base sm:text-[18px] font-semibold text-white">
                        {{ item.title }}
                      </h3>
                      <p v-if="item.displayText" class="text-sm sm:text-base text-gray-300 leading-relaxed">
                        {{ item.displayText }}
                      </p>
                    </div>
                  </article>
                </template>

                <!-- Empty State for Media -->
                <div v-else
                  class="flex-1 min-h-64 p-8 rounded-xl bg-[#1C1C1F]/40 border border-[#46464D]/30 text-center flex flex-col items-center justify-center gap-2">
                  <Icon name="ic:outline-smart-display" class="text-3xl text-gray-500 mb-1" />
                  <p class="text-sm font-medium text-gray-300">No Featured Videos Yet</p>
                  <p class="text-xs text-gray-500">The artist has not added any video media links.</p>
                </div>
              </div>
            </div>

            <!-- Right Column: Released Songs Audio (Spotify & SoundCloud) -->
            <div class="lg:col-span-4 flex flex-col gap-4 h-full">
              <div class="flex items-center justify-between">
                <h2 class="text-xl font-Sora font-medium text-white">Released Songs</h2>
                <span v-if="profileData?.audioItems?.length"
                  class="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#1E1E24] border border-[#46464D]/50 text-[#D0D4F7]">
                  {{ profileData.audioItems.length }}
                </span>
              </div>

              <!-- Live Audio Items List -->
              <div
                class="bg-[#1C1C1F]/60 border rounded-xl border-[#46464D]/40 p-4 sm:p-6 flex flex-col gap-4 shadow-lg flex-1">
                <template v-if="profileData?.audioItems?.length">
                  <div v-for="audio in profileData.audioItems" :key="audio.id"
                    class="space-y-1.5 border border-[#303035] rounded-xl overflow-hidden p-2.5 bg-[#141416]">
                    <div class="flex flex-col gap-1 pl-1 pt-1">
                      <div class="flex items-center gap-1.5">
                        <span class="text-xs text-gray-400 font-medium">Track:</span>
                        <p class="text-xs text-white font-semibold truncate">
                          {{ audio.title || 'Featured Track' }}
                        </p>
                      </div>
                      <div v-if="audio.displayText" class="flex items-center gap-1.5">
                        <span class="text-[11px] text-gray-500 font-medium">Notes:</span>
                        <p class="text-[11px] text-gray-300 truncate">
                          {{ audio.displayText }}
                        </p>
                      </div>
                    </div>
                    <div class="pt-1">
                      <MediaEmbed :url="audio.url" :title="audio.title" />
                    </div>
                  </div>
                </template>

                <!-- Empty State for Audio -->
                <div v-else
                  class="w-full flex-1 min-h-37 rounded-xl border-2 border-dashed border-[#46464D]/50 bg-[#16161A]/50 flex flex-col items-center justify-center p-4 text-center">
                  <div
                    class="w-10 h-10 rounded-full bg-[#1E1E24] border border-[#46464D]/60 flex items-center justify-center text-[#D0D4F7] mb-2 shadow-inner">
                    <Icon name="ic:outline-music-note" class="text-xl" />
                  </div>
                  <p class="font-Sora text-xs sm:text-sm font-semibold text-gray-200">No Released Tracks</p>
                  <p class="text-[11px] text-gray-400 mt-0.5">Spotify and SoundCloud tracks will appear here.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Middle Row: Milestones & Achievements -->
          <div class="bg-[#1C1C1F]/60 border rounded-xl border-[#46464D]/40 p-5 sm:p-6 flex flex-col gap-5 shadow-lg">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-Sora font-medium text-white">MILESTONES & ACHIEVEMENTS</h2>
              <span v-if="profileData?.milestoneItems?.length"
                class="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#1E1E24] border border-[#46464D]/50 text-[#D0D4F7]">
                {{ profileData.milestoneItems.length }}
              </span>
            </div>

            <!-- Live Milestones List -->
            <div class="flex items-start gap-6 sm:gap-8 md:gap-10 overflow-x-auto pb-2 scrollbar-thin">
              <template v-if="profileData?.milestoneItems?.length">
                <div v-for="m in profileData.milestoneItems" :key="m.id"
                  class="flex flex-col gap-2.5 items-center justify-center shrink-0">
                  <div
                    class="w-24 h-24 sm:w-28 sm:h-28 md:w-30 md:h-30 rounded-full overflow-hidden border-2 border-[#D0D4F7]/60 shadow-lg bg-[#1E1E24] flex items-center justify-center bg-linear-to-br from-[#26262E] to-[#151518]">
                    <img v-if="m.fileUrl" :src="m.fileUrl" :alt="m.title" class="w-full h-full object-cover" />
                    <div v-else class="flex items-center justify-center w-full h-full select-none">
                      <span class="font-Sora font-bold text-lg sm:text-xl md:text-2xl text-[#D0D4F7] tracking-wider">
                        {{ getMilestoneInitials(m.title) }}
                      </span>
                    </div>
                  </div>
                  <div class="text-center max-w-28 sm:max-w-32">
                    <h3 class="text-xs sm:text-sm font-semibold text-white font-Sora">{{ m.title }}</h3>
                    <span v-if="m.eventDate" class="text-[11px] text-gray-400">{{ m.eventDate }}</span>
                  </div>
                </div>
              </template>

              <!-- Empty State for Milestones -->
              <div v-else
                class="w-full py-8 text-center flex flex-col items-center justify-center gap-1.5 text-gray-400">
                <Icon name="ic:outline-emoji-events" class="text-3xl text-gray-500 mb-1" />
                <p class="text-sm font-medium text-gray-300">No Milestones Recorded</p>
                <p class="text-xs text-gray-500">Awards, wins, and notable milestones will appear here.</p>
              </div>
            </div>
          </div>

          <!-- Bottom Row: Promotional Materials (Posters) -->
          <div class="bg-[#1C1C1F]/60 border rounded-xl border-[#46464D]/40 p-5 sm:p-6 flex flex-col gap-5 shadow-lg">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h2 class="text-xl font-Sora font-medium text-white">PROMOTIONAL MATERIALS</h2>
                <span v-if="profileData?.posterItems?.length"
                  class="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#1E1E24] border border-[#46464D]/50 text-[#D0D4F7]">
                  {{ profileData.posterItems.length }}
                </span>
              </div>
            </div>

            <!-- Live Posters Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              <template v-if="profileData?.posterItems?.length">
                <div v-for="poster in profileData.posterItems" :key="poster.id"
                  class="relative aspect-3/4 w-full rounded-xl overflow-hidden border border-[#46464D]/40 shadow-lg bg-[#1A1A1E] group">
                  <img :src="poster.fileUrl" :alt="poster.title || 'Poster'"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div v-if="poster.title"
                    class="absolute bottom-0 inset-x-0 bg-black/75 p-2 text-center text-xs font-medium text-white truncate">
                    {{ poster.title }}
                  </div>
                </div>
              </template>

              <!-- Empty State for Posters -->
              <div v-else
                class="col-span-2 md:col-span-4 py-8 text-center flex flex-col items-center justify-center gap-1.5 text-gray-400">
                <Icon name="ic:outline-photo-size-select-actual" class="text-3xl text-gray-500 mb-1" />
                <p class="text-sm font-medium text-gray-300">No Promotional Posters</p>
                <p class="text-xs text-gray-500">Official gig flyers and press releases will be shown here.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Contact Tab Content Container -->
        <div v-else-if="activeTab === 'contact'" class="w-full">
          <div
            class="w-full min-h-100 border border-[#46464D]/40 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-[#131315]/50">
            <div
              class="w-14 h-14 rounded-full bg-[#1E1E24] border border-[#46464D]/50 flex items-center justify-center mb-4">
              <Icon name="ic:outline-alternate-email" class="text-2xl text-[#D0D4F7]" />
            </div>
            <h3 class="font-Sora text-lg font-semibold text-white mb-2">Bookings & Management</h3>
            <p class="text-sm text-gray-400 max-w-md mb-4">
              Interested in booking {{ displayName }} for gigs, recordings, or collaborations? Contact via TONO.
            </p>
            <div class="flex flex-wrap items-center justify-center gap-3">
              <button @click="handleShareProfile"
                class="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E1E24] hover:bg-[#282830] border border-[#46464D]/60 text-xs sm:text-sm font-medium text-white transition-all cursor-pointer">
                <Icon name="ic:round-share" class="text-base text-[#D0D4F7]" />
                <span>Share Profile</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      <!-- Direct Booking Modal Component -->
      <DirectBookingModal :is-open="isBookingModalOpen" :artist-id="artistRecord?.ARTIST_ID" :artist-name="displayName"
        :artist-avatar="profilePicture" :artist-type="artistTypeLabel" @close="isBookingModalOpen = false"
        @submit="handleBookingSubmit" />

      <!-- Post Detail Modal Component -->
      <PostDetailModal
        :is-open="isPostModalOpen"
        :post="selectedPost"
        :artist-name="displayName"
        :artist-avatar="profilePicture"
        :artist-username="username"
        @close="closePostModal"
      />

      <!-- Booking Success Toast Notification -->
      <Teleport to="body">
        <Transition enter-active-class="transition duration-300 ease-out"
          enter-from-class="transform translate-y-4 opacity-0" enter-to-class="transform translate-y-0 opacity-100"
          leave-active-class="transition duration-200 ease-in" leave-from-class="transform translate-y-0 opacity-100"
          leave-to-class="transform translate-y-4 opacity-0">
          <div v-if="bookingSuccessToast"
            class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-[#161619] border border-emerald-500/50 rounded-2xl shadow-2xl text-emerald-300 font-Sora text-sm">
            <div class="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Icon name="ic:round-check" class="text-lg text-emerald-400" />
            </div>
            <p class="font-medium">{{ bookingSuccessToast }}</p>
          </div>
        </Transition>
      </Teleport>
    </div>
  </div>
</template>
