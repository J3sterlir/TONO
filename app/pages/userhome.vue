<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

import { ref, onMounted, onUnmounted } from 'vue'

const supabase = useSupabaseClient()
const { fetchCurrentUserProfile } = useTonoAuth()
const {
  highMatches,
  mediumMatches,
  lowMatches,
  unmatchedArtists,
  isLoading: isMatchingLoading,
  isLocationFilterActive,
  fetchRecommendations,
  toggleLocationFilter,
  getTierBadgeClass,
  getTierAvatarRing,
  formatScorePercent,
  getLocationLabel,
  getArtistAvatarUrl,
  getArtistCoverUrl,
} = useTonoMatching()

const userCity = ref<string | null>(null)
const userBarangay = ref<string | null>(null)

// Scroll refs
const highScrollRef = ref<HTMLElement | null>(null)
const mediumScrollRef = ref<HTMLElement | null>(null)
const lowScrollRef = ref<HTMLElement | null>(null)
const discoverScrollRef = ref<HTMLElement | null>(null)
const servicesScrollRef = ref<HTMLElement | null>(null)

const scrollStates = ref({
  high: { canScrollLeft: false, canScrollRight: false },
  medium: { canScrollLeft: false, canScrollRight: false },
  low: { canScrollLeft: false, canScrollRight: false },
  discover: { canScrollLeft: false, canScrollRight: false },
  services: { canScrollLeft: false, canScrollRight: false }
})

const checkScroll = (element: HTMLElement | null, key: 'high' | 'medium' | 'low' | 'discover' | 'services') => {
  if (element) {
    const { scrollLeft, scrollWidth, clientWidth } = element
    scrollStates.value[key].canScrollLeft = scrollLeft > 0
    scrollStates.value[key].canScrollRight = Math.ceil(scrollLeft + clientWidth) < scrollWidth
  }
}

const scroll = (element: HTMLElement | null, direction: 'left' | 'right') => {
  if (element) {
    const scrollAmount = element.clientWidth * 0.75
    element.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' })
  }
}

const updateAllScrolls = () => {
  checkScroll(highScrollRef.value, 'high')
  checkScroll(mediumScrollRef.value, 'medium')
  checkScroll(lowScrollRef.value, 'low')
  checkScroll(discoverScrollRef.value, 'discover')
  checkScroll(servicesScrollRef.value, 'services')
}

const handleResize = () => {
  updateAllScrolls()
}

const loggedInUserId = ref<string | null>(null)

onMounted(async () => {
  try {
    const profile = await fetchCurrentUserProfile()
    if (profile?.account) {
      loggedInUserId.value = profile.account.ACCOUNT_ID
      userCity.value = profile.account.City
      userBarangay.value = profile.account.Barangay
    }
  } catch (err) {
    console.error('Error loading current user profile:', err)
  }

  await fetchRecommendations({ context: 'discovery', userId: loggedInUserId.value || undefined })

  setTimeout(() => {
    updateAllScrolls()
  }, 200)

  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

const handleLocationToggle = async () => {
  await toggleLocationFilter({ context: 'discovery', userId: loggedInUserId.value || undefined })
  setTimeout(() => {
    updateAllScrolls()
  }, 200)
}

const services = [
  { name: 'Tunes Studio', category: 'Music Studio', image: 'https://placehold.co/150x150/222/FFF?text=TS' },
  { name: 'Apollo Music Shop', category: 'Music Shop', image: 'https://placehold.co/150x150/222/FFF?text=AMS' },
  { name: 'Stephen Johnston', category: 'Luthier', image: 'https://placehold.co/150x150/222/FFF?text=SJ' },
  { name: 'CD Shop', category: 'Music Shop', image: 'https://placehold.co/150x150/222/FFF?text=CS' },
]

const handleLogout = async () => {
  await supabase.auth.signOut()
  await navigateTo('/Login')
}
</script>

<template>
  <div class="h-full bg-[#0E0E10] text-white flex flex-col min-h-screen">
    <!-- Navbar -->
    <nav
      class="flex items-center justify-between px-10 py-4 bg-[#131315]/80 sticky top-0 backdrop-blur-sm border-b border-[#46464D]/75 z-50">
      <div class="flex gap-5">
        <div class="flex items-center">
          <img src="/TONO_LOGO.svg" alt="Logo" class="h-8 w-8 rounded-full" />
          <h1 class="text-[1.5rem] ml-2 font-bold">TONO</h1>
        </div>

        <div class="w-fit flex items-center justify-center">
          <form action="/search" method="GET" class="relative group">
            <div class="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400">
              <Icon name="ic:outline-search" class="absolute text-2xl text-[#C7C5CE]" />
            </div>

            <input type="search" name="q" placeholder="Search ..."
              class="w-fit py-2 pl-12 pr-5 bg-[#49494d] placeholder:text-[#C7C5CE] rounded-full" />
          </form>
        </div>
      </div>

      <div class="absolute left-1/2 -translate-x-1/2 flex text-white items-center gap-10">
        <button class="text-white hover:text-[#D0D4F7] cursor-pointer border-b-2 border-[#D0D4F7]">Discover</button>
        <button class="text-white hover:text-[#D0D4F7] cursor-pointer">Artists</button>
        <button class="text-white hover:text-[#D0D4F7] cursor-pointer">Events</button>
      </div>

      <div class="flex items-center gap-1">
        <Icon name="ic:baseline-notifications-none" class="text-2xl text-[#C7C5CE]" />
        <button @click="navigateTo('/userprofile')"
          class="flex items-center justify-center text-[#151A34] p-3 rounded-full font-semibold transition-colors cursor-pointer">
          <Icon name="ic:outline-account-circle" class="text-2xl text-[#C7C5CE]" />
        </button>
        
        <button 
          @click="handleLogout"
          class="flex items-center justify-center text-[#151A34] p-3 rounded-full font-semibold transition-colors cursor-pointer">
          <Icon name="ic:outline-vpn-key-off" class="text-2xl text-[#C7C5CE] hover:text-[#ff3c3c]" />
        </button>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="px-11.75 py-16 flex flex-col gap-12 mx-auto w-full">
      <!-- Location Filter Control Bar -->
      <div class="flex justify-end">
        <div class="flex flex-wrap items-center gap-10 p-4 w-fit rounded-2xl bg-[#131315]/80 border border-[#3A3A3C] shadow-lg backdrop-blur-md">
        <div class="flex items-center gap-3">
          <div class="p-2.5 flex rounded-xl bg-[#D0D4F7]/10 text-[#D0D4F7]">
            <Icon name="ic:baseline-location-on" class="text-xl" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-white">Location Filter Gateway</span>
              <span class="text-xs px-2 py-0.5 rounded-full"
                :class="isLocationFilterActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'">
                {{ isLocationFilterActive ? 'Active' : 'Inactive' }}
              </span>
            </div>
            <p class="text-xs text-gray-400 mt-0.5">
              {{ isLocationFilterActive 
                  ? `Showing matches near ${userCity || 'your city'}${userBarangay ? ' • ' + userBarangay : ''}`
                  : 'Showing tag-matched artists from all cities across the Philippines' }}
            </p>
          </div>
        </div>

        <!-- Toggle Switch -->
        <button
          @click="handleLocationToggle"
          :disabled="isMatchingLoading"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-300 border"
          :class="isLocationFilterActive 
            ? 'bg-[#1E1E24] hover:bg-[#282830] text-gray-200 border-[#3A3A3C]' 
            : 'bg-[#D0D4F7] text-[#0E0E10] border-[#D0D4F7] hover:bg-white shadow-md shadow-[#D0D4F7]/20'">
          <Icon :name="isLocationFilterActive ? 'ic:outline-public' : 'ic:baseline-location-searching'" class="text-base" />
          <span>{{ isLocationFilterActive ? 'Disable Location Filter (Show Everywhere)' : 'Re-enable Near Me' }}</span>
        </button>
      </div>
      </div>

      <!-- 1. HIGH COMPATIBILITY MATCHES (70% - 100%) -->
      <section class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h2 class="text-xl font-bold tracking-wide">Top Recommended Artists</h2>
            <!--<span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              70% - 100% Match
            </span>-->
          </div>
          <span v-if="!isMatchingLoading" class="text-xs text-gray-400 font-medium">
            {{ highMatches.length }} {{ highMatches.length === 1 ? 'artist' : 'artists' }}
          </span>
        </div>

        <!-- Carousel -->
        <div class="relative group">
          <!-- Left Arrow -->
          <div v-show="scrollStates.high.canScrollLeft"
            class="absolute left-0 top-0 bottom-0 w-24 z-20 flex items-center justify-start pl-2 bg-linear-to-r from-[#0E0E10] via-[#0E0E10]/80 to-transparent pointer-events-none">
            <button @click="scroll(highScrollRef, 'left')"
              class="flex bg-[#131315]/90 hover:bg-[#D0D4F7] hover:text-[#131315] text-white rounded-full p-2 transition-all shadow-lg backdrop-blur-md pointer-events-auto cursor-pointer">
              <Icon name="ic:baseline-chevron-left" class="text-2xl" />
            </button>
          </div>

          <!-- Loading Skeletons -->
          <div v-if="isMatchingLoading" class="flex gap-6 p-2 overflow-hidden">
            <div v-for="i in 5" :key="'high-skel-' + i" class="flex flex-col items-center shrink-0 animate-pulse">
              <div class="w-36 h-36 rounded-full bg-[#1E1E24] mb-3"></div>
              <div class="w-24 h-3 bg-[#2A2A32] rounded-md mb-2"></div>
              <div class="w-16 h-2 bg-[#2A2A32] rounded-md"></div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="highMatches.length === 0"
            class="p-8 rounded-2xl bg-[#131315]/50 border border-[#2A2A2E] text-center flex flex-col items-center justify-center gap-2">
            <div class="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl mb-1">
              <Icon name="ic:outline-music-note" />
            </div>
            <p class="text-sm font-medium text-gray-300">No Artists Can be Found In This Category</p>
            <p class="text-xs text-gray-500 max-w-md">

            </p>
          </div>

          <!-- Artists List -->
          <div v-else ref="highScrollRef" @scroll="checkScroll(highScrollRef, 'high')"
            class="flex overflow-x-auto gap-6 p-2 pt-4 scrollbar-hide scroll-smooth">
            <div v-for="artist in highMatches" :key="artist.artist_id"
              class="flex flex-col items-center shrink-0 cursor-pointer transition-transform hover:scale-105 group/item">
              <div class="relative mb-3">
                <img :src="getArtistAvatarUrl(artist)" :alt="artist.display_name"
                  class="w-36 h-36 rounded-full object-cover shadow-md transition-all"
                  :class="getTierAvatarRing(artist.match_tier)" />
                <span class="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap shadow-md"
                  :class="getTierBadgeClass(artist.match_tier)">
                  {{ formatScorePercent(artist.total_score) }}% Match
                </span>
              </div>

              <span class="text-gray-100 text-sm font-semibold tracking-wide mt-2 text-center max-w-35 truncate">
                {{ artist.display_name }}
              </span>
              <span class="text-gray-400 text-sm mt-1 font-light text-center max-w-35 truncate">
                {{ artist.specialty}}
              </span>
              <div v-if="artist.shared_genres.length" class="flex flex-wrap justify-center gap-1 mt-1 max-w-35">
                <span v-for="g in artist.shared_genres.slice(0, 2)" :key="g"
                  class="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 truncate">
                  {{ g }}
                </span>
              </div>
            </div>
          </div>

          <!-- Right Arrow -->
          <div v-show="scrollStates.high.canScrollRight"
            class="absolute right-0 top-0 bottom-0 w-24 z-20 flex items-center justify-end pr-2 bg-linear-to-l from-[#0E0E10] via-[#0E0E10]/80 to-transparent pointer-events-none">
            <button @click="scroll(highScrollRef, 'right')"
              class="flex bg-[#131315]/90 hover:bg-[#D0D4F7] hover:text-[#131315] text-white rounded-full p-2 transition-all shadow-lg backdrop-blur-md pointer-events-auto cursor-pointer">
              <Icon name="ic:baseline-chevron-right" class="text-2xl" />
            </button>
          </div>
        </div>
      </section>

      <!-- 2. MEDIUM COMPATIBILITY MATCHES (30% - 69%) -->
      <section class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h2 class="text-xl font-bold tracking-wide">You May Also Like</h2>
            <!--<span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              30% - 69% Match
            </span>-->
          </div>
          <span v-if="!isMatchingLoading" class="text-xs text-gray-400 font-medium">
            {{ mediumMatches.length }} {{ mediumMatches.length === 1 ? 'artist' : 'artists' }}
          </span>
        </div>

        <!-- Carousel -->
        <div class="relative group">
          <!-- Left Arrow -->
          <div v-show="scrollStates.medium.canScrollLeft"
            class="absolute left-0 top-0 bottom-0 w-24 z-20 flex items-center justify-start pl-2 bg-linear-to-r from-[#0E0E10] via-[#0E0E10]/80 to-transparent pointer-events-none">
            <button @click="scroll(mediumScrollRef, 'left')"
              class="flex bg-[#131315]/90 hover:bg-[#D0D4F7] hover:text-[#131315] text-white rounded-full p-2 transition-all shadow-lg backdrop-blur-md pointer-events-auto cursor-pointer">
              <Icon name="ic:baseline-chevron-left" class="text-2xl" />
            </button>
          </div>

          <!-- Loading Skeletons -->
          <div v-if="isMatchingLoading" class="flex gap-6 p-2 overflow-hidden">
            <div v-for="i in 5" :key="'med-skel-' + i" class="flex flex-col items-center shrink-0 animate-pulse">
              <div class="w-36 h-36 rounded-full bg-[#1E1E24] mb-3"></div>
              <div class="w-24 h-3 bg-[#2A2A32] rounded-md mb-2"></div>
              <div class="w-16 h-2 bg-[#2A2A32] rounded-md"></div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="mediumMatches.length === 0"
            class="p-8 rounded-2xl bg-[#131315]/50 border border-[#2A2A2E] text-center flex flex-col items-center justify-center gap-2">
            <div class="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xl mb-1">
              <Icon name="ic:outline-queue-music" />
            </div>
            <p class="text-sm font-medium text-gray-300">No Artists Can be Found In This Category</p>
            <p class="text-xs text-gray-500 max-w-md">

            </p>
          </div>

          <!-- Artists List -->
          <div v-else ref="mediumScrollRef" @scroll="checkScroll(mediumScrollRef, 'medium')"
            class="flex overflow-x-auto gap-6 p-2 pt-4 scrollbar-hide scroll-smooth">
            <div v-for="artist in mediumMatches" :key="artist.artist_id"
              class="flex flex-col items-center shrink-0 cursor-pointer transition-transform hover:scale-105 group/item">
              <div class="relative mb-3">
                <img :src="getArtistAvatarUrl(artist)" :alt="artist.display_name"
                  class="w-36 h-36 rounded-full object-cover shadow-md transition-all"
                  :class="getTierAvatarRing(artist.match_tier)" />
                <span class="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap shadow-md"
                  :class="getTierBadgeClass(artist.match_tier)">
                  {{ formatScorePercent(artist.total_score) }}% Match
                </span>
              </div>

              <span class="text-gray-100 text-sm font-semibold tracking-wide mt-2 text-center max-w-35 truncate">
                {{ artist.display_name }}
              </span>
              <span class="text-gray-400 text-sm mt-1 font-light text-center max-w-35 truncate">
                {{ artist.specialty}}
              </span>
              <div v-if="artist.shared_genres.length" class="flex flex-wrap justify-center gap-1 mt-1 max-w-35">
                <span v-for="g in artist.shared_genres.slice(0, 2)" :key="g"
                  class="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 truncate">
                  {{ g }}
                </span>
              </div>
            </div>
          </div>

          <!-- Right Arrow -->
          <div v-show="scrollStates.medium.canScrollRight"
            class="absolute right-0 top-0 bottom-0 w-24 z-20 flex items-center justify-end pr-2 bg-linear-to-l from-[#0E0E10] via-[#0E0E10]/80 to-transparent pointer-events-none">
            <button @click="scroll(mediumScrollRef, 'right')"
              class="flex bg-[#131315]/90 hover:bg-[#D0D4F7] hover:text-[#131315] text-white rounded-full p-2 transition-all shadow-lg backdrop-blur-md pointer-events-auto cursor-pointer">
              <Icon name="ic:baseline-chevron-right" class="text-2xl" />
            </button>
          </div>
        </div>
      </section>

      <!-- 3. LOW COMPATIBILITY MATCHES (1% - 29%) -->
      <section class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h2 class="text-xl font-bold tracking-wide">Emerging & Different Tastes</h2>
            <!--<span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
              1% - 29% Match
            </span>-->
          </div>
          <span v-if="!isMatchingLoading" class="text-xs text-gray-400 font-medium">
            {{ lowMatches.length }} {{ lowMatches.length === 1 ? 'artist' : 'artists' }}
          </span>
        </div>

        <!-- Carousel -->
        <div class="relative group">
          <!-- Left Arrow -->
          <div v-show="scrollStates.low.canScrollLeft"
            class="absolute left-0 top-0 bottom-0 w-24 z-20 flex items-center justify-start pl-2 bg-linear-to-r from-[#0E0E10] via-[#0E0E10]/80 to-transparent pointer-events-none">
            <button @click="scroll(lowScrollRef, 'left')"
              class="flex bg-[#131315]/90 hover:bg-[#D0D4F7] hover:text-[#131315] text-white rounded-full p-2 transition-all shadow-lg backdrop-blur-md pointer-events-auto cursor-pointer">
              <Icon name="ic:baseline-chevron-left" class="text-2xl" />
            </button>
          </div>

          <!-- Loading Skeletons -->
          <div v-if="isMatchingLoading" class="flex gap-6 p-2 overflow-hidden">
            <div v-for="i in 5" :key="'low-skel-' + i" class="flex flex-col items-center shrink-0 animate-pulse">
              <div class="w-36 h-36 rounded-full bg-[#1E1E24] mb-3"></div>
              <div class="w-24 h-3 bg-[#2A2A32] rounded-md mb-2"></div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="lowMatches.length === 0"
            class="p-8 rounded-2xl bg-[#131315]/50 border border-[#2A2A2E] text-center flex flex-col items-center justify-center gap-2">
            <div class="w-12 h-12 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center text-xl mb-1">
              <Icon name="ic:outline-explore" />
            </div>
            <p class="text-sm font-medium text-gray-300">No Artists Can be Found In This Category</p>
            <p class="text-xs text-gray-500 max-w-md">

            </p>
          </div>

          <!-- Artists List -->
          <div v-else ref="lowScrollRef" @scroll="checkScroll(lowScrollRef, 'low')"
            class="flex overflow-x-auto gap-6 p-2 pt-4 scrollbar-hide scroll-smooth">
            <div v-for="artist in lowMatches" :key="artist.artist_id"
              class="flex flex-col items-center shrink-0 cursor-pointer transition-transform hover:scale-105 group/item">
              <div class="relative mb-3">
                <img :src="getArtistAvatarUrl(artist)" :alt="artist.display_name"
                  class="w-36 h-36 rounded-full object-cover shadow-md transition-all ring-1 ring-zinc-700" />
                <span class="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap shadow-md bg-zinc-800 text-zinc-400 border border-zinc-700">
                  {{ formatScorePercent(artist.total_score) }}% Match
                </span>
              </div>

              <span class="text-gray-200 text-sm font-medium tracking-wide mt-2 text-center max-w-35 truncate">
                {{ artist.display_name }}
              </span>
              <span class="text-gray-400 text-xs font-light text-center max-w-35 truncate">
                {{ artist.specialty }}
              </span>
            </div>
          </div>

          <!-- Right Arrow -->
          <div v-show="scrollStates.low.canScrollRight"
            class="absolute right-0 top-0 bottom-0 w-24 z-20 flex items-center justify-end pr-2 bg-linear-to-l from-[#0E0E10] via-[#0E0E10]/80 to-transparent pointer-events-none">
            <button @click="scroll(lowScrollRef, 'right')"
              class="flex bg-[#131315]/90 hover:bg-[#D0D4F7] hover:text-[#131315] text-white rounded-full p-2 transition-all shadow-lg backdrop-blur-md pointer-events-auto cursor-pointer">
              <Icon name="ic:baseline-chevron-right" class="text-2xl" />
            </button>
          </div>
        </div>
      </section>

      <!-- 4. DISCOVER NEW ARTISTS (FALLBACK & ZERO-MATCH SHOWCASE) -->
      <section class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold tracking-wide">Discover New Artists</h2>
            <p class="text-xs text-gray-400 mt-0.5">Explore artists beyond your preferred tags and discover fresh sounds</p>
          </div>
          <span v-if="!isMatchingLoading" class="text-xs text-gray-400 font-medium">
            {{ unmatchedArtists.length }} {{ unmatchedArtists.length === 1 ? 'artist' : 'artists' }}
          </span>
        </div>

        <div class="relative group">
          <!-- Left Arrow -->
          <div v-show="scrollStates.discover.canScrollLeft"
            class="absolute left-0 top-0 bottom-0 w-32 z-20 flex items-center justify-start pl-2 bg-linear-to-r from-[#0E0E10] via-[#0E0E10]/80 to-transparent pointer-events-none">
            <button @click="scroll(discoverScrollRef, 'left')"
              class="flex bg-[#131315]/90 hover:bg-[#D0D4F7] hover:text-[#131315] text-white rounded-full p-2 transition-all shadow-lg backdrop-blur-md pointer-events-auto cursor-pointer">
              <Icon name="ic:baseline-chevron-left" class="text-2xl" />
            </button>
          </div>

          <!-- Loading Skeletons -->
          <div v-if="isMatchingLoading" class="flex gap-4 h-72 overflow-hidden">
            <div v-for="i in 3" :key="'disc-skel-' + i" class="flex-1 min-w-50 rounded-2xl bg-[#1E1E24] animate-pulse"></div>
          </div>

          <!-- Empty State -->
          <div v-else-if="unmatchedArtists.length === 0"
            class="p-10 rounded-2xl bg-[#131315]/50 border border-[#2A2A2E] text-center flex flex-col items-center justify-center gap-2">
            <div class="w-14 h-14 rounded-full bg-[#D0D4F7]/10 text-[#D0D4F7] flex items-center justify-center text-2xl mb-1">
              <Icon name="ic:outline-album" />
            </div>
            <p class="text-base font-semibold text-gray-200">No New Artists To Discover Yet</p>
            <p class="text-xs text-gray-500 max-w-md">

            </p>
          </div>

          <!-- Large Expandable Cards Carousel -->
          <div v-else ref="discoverScrollRef" @scroll="checkScroll(discoverScrollRef, 'discover')"
            class="flex h-72 gap-4 w-full overflow-x-auto scrollbar-hide scroll-smooth">
            <div v-for="(artist, index) in unmatchedArtists" :key="artist.artist_id"
              :class="[
                'group/card relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-500 ease-in-out flex-1 min-w-50 hover:min-w-[320px] hover:flex-[3_3_0%] border-2 border-transparent hover:border-[#D0D4F7] hover:z-10',
                index === unmatchedArtists.length - 1 && unmatchedArtists.length > 1 ? 'hover:-ml-12' : ''
              ]">
              <img :src="getArtistCoverUrl(artist)" :alt="artist.display_name"
                class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105" />

              <div class="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent"></div>
              <div class="absolute inset-0 bg-black/30 transition-opacity duration-500 group-hover/card:bg-transparent"></div>

              <div class="absolute top-4 right-4">
                <span class="text-[11px] px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-gray-300 border border-white/10">
                  {{ artist.artist_type }}
                </span>
              </div>

              <div class="absolute bottom-0 left-0 p-6 flex flex-col justify-end whitespace-nowrap">
                <h3 class="text-xl font-bold text-white tracking-tight">{{ artist.display_name }}</h3>
                <p class="text-xs font-medium text-gray-300 mt-1">
                  {{ artist.genres.length ? artist.genres.join(', ') : 'Genre Open' }}
                </p>
                <p class="text-[11px] font-light text-gray-400 mt-0.5">
                  {{ getLocationLabel(artist) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Right Arrow -->
          <div v-show="scrollStates.discover.canScrollRight"
            class="absolute right-0 top-0 bottom-0 w-32 z-20 flex items-center justify-end pr-2 bg-linear-to-l from-[#0E0E10] via-[#0E0E10]/80 to-transparent pointer-events-none">
            <button @click="scroll(discoverScrollRef, 'right')"
              class="flex bg-[#131315]/90 hover:bg-[#D0D4F7] hover:text-[#131315] text-white rounded-full p-2 transition-all shadow-lg backdrop-blur-md pointer-events-auto cursor-pointer">
              <Icon name="ic:baseline-chevron-right" class="text-2xl" />
            </button>
          </div>
        </div>
      </section>

      <!-- 5. LOCAL MUSIC INDUSTRY (SERVICES) -->
      <section class="flex flex-col gap-4">
        <h2 class="text-xl font-bold tracking-wide">Local Music Industry</h2>
        <div class="relative group -mt-2">
          <!-- Left Arrow -->
          <div v-show="scrollStates.services.canScrollLeft"
            class="absolute left-0 top-0 bottom-0 w-32 z-20 flex items-center justify-start pl-2 bg-linear-to-r from-[#0E0E10] via-[#0E0E10]/80 to-transparent pointer-events-none">
            <button @click="scroll(servicesScrollRef, 'left')"
              class="flex bg-[#131315]/90 hover:bg-[#D0D4F7] hover:text-[#131315] text-white rounded-full p-2 transition-all shadow-lg backdrop-blur-md pointer-events-auto cursor-pointer">
              <Icon name="ic:baseline-chevron-left" class="text-2xl" />
            </button>
          </div>

          <div ref="servicesScrollRef" @scroll="checkScroll(servicesScrollRef, 'services')"
            class="flex overflow-x-auto gap-6 p-2 pt-4 scrollbar-hide scroll-smooth">
            <div v-for="service in services" :key="service.name"
              class="flex flex-col items-center shrink-0 cursor-pointer transition-transform hover:scale-105">
              <img :src="service.image" :alt="service.name"
                class="w-28 h-28 rounded-full object-cover shadow-md mb-3 border border-[#3A3A3C]" />
              <span class="text-gray-200 text-sm font-medium tracking-wide">
                {{ service.name }}
              </span>
              <span class="text-gray-400 text-xs font-light">
                {{ service.category }}
              </span>
            </div>
          </div>

          <!-- Right Arrow -->
          <div v-show="scrollStates.services.canScrollRight"
            class="absolute right-0 top-0 bottom-0 w-32 z-20 flex items-center justify-end pr-2 bg-linear-to-l from-[#0E0E10] via-[#0E0E10]/80 to-transparent pointer-events-none">
            <button @click="scroll(servicesScrollRef, 'right')"
              class="flex bg-[#131315]/90 hover:bg-[#D0D4F7] hover:text-[#131315] text-white rounded-full p-2 transition-all shadow-lg backdrop-blur-md pointer-events-auto cursor-pointer">
              <Icon name="ic:baseline-chevron-right" class="text-2xl" />
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>