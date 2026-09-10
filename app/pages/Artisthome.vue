<script setup lang="ts">
definePageMeta({
  middleware: ['auth', 'artist']
})

import { ref, computed, onMounted, onUnmounted } from 'vue'

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

const discoverArtists = computed(() => {
  return [...lowMatches.value, ...unmatchedArtists.value]
})

const artistName = ref('Artist')
const userCity = ref<string | null>(null)
const userBarangay = ref<string | null>(null)
const feedMode = ref<'discovery' | 'recruitment'>('discovery')

// Scroll refs
const highScrollRef = ref<HTMLElement | null>(null)
const mediumScrollRef = ref<HTMLElement | null>(null)
const discoverScrollRef = ref<HTMLElement | null>(null)
const servicesScrollRef = ref<HTMLElement | null>(null)

const scrollStates = ref({
  high: { canScrollLeft: false, canScrollRight: false },
  medium: { canScrollLeft: false, canScrollRight: false },
  discover: { canScrollLeft: false, canScrollRight: false },
  services: { canScrollLeft: false, canScrollRight: false }
})

const checkScroll = (element: HTMLElement | null, key: 'high' | 'medium' | 'discover' | 'services') => {
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
    if (profile?.artistProfile?.StageName) {
      artistName.value = profile.artistProfile.StageName
    } else if (profile?.account?.Username) {
      artistName.value = profile.account.Username
    }

    if (profile?.account) {
      loggedInUserId.value = profile.account.ACCOUNT_ID
      userCity.value = profile.account.City
      userBarangay.value = profile.account.Barangay
    }
  } catch (error) {
    console.error('Error fetching artist profile:', error)
  }

  await Promise.all([
    fetchRecommendations({ context: feedMode.value, userId: loggedInUserId.value || undefined }),
    fetchBusinessProfiles()
  ])

  setTimeout(() => {
    updateAllScrolls()
  }, 200)

  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

const switchFeedMode = async (mode: 'discovery' | 'recruitment') => {
  feedMode.value = mode
  await fetchRecommendations({ context: mode, userId: loggedInUserId.value || undefined })
  setTimeout(() => {
    updateAllScrolls()
  }, 200)
}

const handleLocationToggle = async () => {
  await toggleLocationFilter({ context: feedMode.value, userId: loggedInUserId.value || undefined })
  setTimeout(() => {
    updateAllScrolls()
  }, 200)
}

interface BusinessProfileItem {
  BUSINESS_ID: string
  Business_Name: string
  Business_Service: string | null
  Profile_Picture: string | null
  Business_Address?: string | null
  Contact_Information?: string | null
}

const businessProfiles = ref<BusinessProfileItem[]>([])
const isBusinessesLoading = ref(false)

const getBusinessAvatarUrl = (business: BusinessProfileItem) => {
  if (business?.Profile_Picture) return business.Profile_Picture
  const name = encodeURIComponent(business?.Business_Name || 'Business')
  return `https://ui-avatars.com/api/?name=${name}&background=1E1E24&color=D0D4F7&bold=true&size=150`
}

const fetchBusinessProfiles = async () => {
  isBusinessesLoading.value = true
  try {
    const { data, error } = await supabase
      .from('BUSINESS_PROFILE')
      .select('BUSINESS_ID, Business_Name, Business_Service, Profile_Picture, Business_Address, Contact_Information')
      .order('Business_Name', { ascending: true })

    if (error) {
      console.error('Error fetching business profiles:', error)
      return
    }
    businessProfiles.value = data || []
  } catch (err) {
    console.error('Error in fetchBusinessProfiles:', err)
  } finally {
    isBusinessesLoading.value = false
    setTimeout(() => {
      checkScroll(servicesScrollRef.value, 'services')
    }, 100)
  }
}

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
      </div>

      <div class="absolute left-1/2 -translate-x-1/2 flex text-white items-center gap-10">
        <button class="text-white hover:text-[#D0D4F7] cursor-pointer border-b-2 border-[#D0D4F7]">Discover</button>
        <button class="text-white hover:text-[#D0D4F7] cursor-pointer">Artists</button>
        <button class="text-white hover:text-[#D0D4F7] cursor-pointer">Events</button>
      </div>

      <div class="flex items-center gap-1">
        <Icon name="ic:baseline-notifications-none" class="text-2xl text-[#C7C5CE]" />
        <button @click="navigateTo('/Artistprofile')"
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
      <!-- Artist Welcome & Context Tabs -->

      <!-- Location Filter Control Bar -->
      <div class="flex flex-row gap-2 justify-between">

        <div class="flex flex-col gap-4">
        <div>
          <!--<span class="text-xs font-semibold tracking-wider uppercase text-[#D0D4F7]/80">Artist Dashboard</span>-->
          <!--<h1 class="text-2xl md:text-3xl font-bold text-white mt-1">
            Welcome back, <span class="text-[#D0D4F7]">{{ artistName }}</span>
          </h1>-->
          <!--<p class="text-xs text-gray-400 mt-1">
            Browse peer artists in your scene or discover instrumentalists to invite to your band.
          </p>-->
        </div>

        <!-- Mode Switcher Tabs 0.8 Genre / 0.2 Inst to 0.3 Genre / 0.7 Inst-->
        <div class="flex items-center p-1 rounded-2xl bg-[#0E0E10] border border-[#3A3A3C] shrink-0">
          <button
            @click="switchFeedMode('discovery')"
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer"
            :class="feedMode === 'discovery' ? 'bg-[#D0D4F7] text-[#0E0E10] shadow-md' : 'text-gray-400 hover:text-white'">
            <Icon name="ic:outline-music-note" class="text-base" />
            <span>Discovery Feed (Genres over Instruments)</span>
          </button>
          <button
            @click="switchFeedMode('recruitment')"
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer"
            :class="feedMode === 'recruitment' ? 'bg-[#D0D4F7] text-[#0E0E10] shadow-md' : 'text-gray-400 hover:text-white'">
            <Icon name="ic:outline-group-add" class="text-base" />
            <span>Recruitment Feed (Instruments over Genres)</span>
          </button>
        </div>
      </div>

        <div class="flex flex-wrap items-center justify-between gap-10 p-4 rounded-2xl bg-[#131315]/80 border border-[#3A3A3C] shadow-lg backdrop-blur-md">
        <div class="flex items-center gap-3">
          <div class="flex p-2.5 rounded-xl bg-[#D0D4F7]/10 text-[#D0D4F7]">
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
                  ? `Filtering by ${userCity || 'your city'}${userBarangay ? ' • ' + userBarangay : ''}`
                  : 'Showing matches across all cities and regions' }}
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

      <!-- 1. HIGH COMPATIBILITY (70% - 100%) -->
      <section class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h2 class="text-xl font-bold tracking-wide">
              {{ feedMode === 'recruitment' ? 'Top Member Candidates' : 'High Compatibility Artists' }}
            </h2>
            <!--<span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              70% - 100% Match
            </span>-->
          </div>
          <span v-if="!isMatchingLoading" class="text-xs text-gray-400 font-medium">
            {{ highMatches.length }} {{ highMatches.length === 1 ? 'candidate' : 'candidates' }}
          </span>
        </div>

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
            <!--<p class="text-xs text-gray-500 max-w-md">
              {{ feedMode === 'recruitment' 
                  ? 'No musicians with strong instrument and genre overlap found in your area yet.' 
                  : 'New artists matching your preferred genres and instruments will appear here.' }}
            </p>-->
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
              <span class="text-gray-400 text-xs font-light text-center max-w-35 truncate">
                {{ artist.specialty || getLocationLabel(artist) }}
              </span>

              <!-- In recruitment mode, highlight matched instruments -->
              <div v-if="feedMode === 'recruitment' && artist.shared_instruments.length" class="flex flex-wrap justify-center gap-1 mt-1 max-w-35">
                <span v-for="inst in artist.shared_instruments.slice(0, 2)" :key="inst"
                  class="text-[10px] px-1.5 py-0.2 rounded bg-[#D0D4F7]/15 text-[#D0D4F7] truncate">
                  {{ inst }}
                </span>
              </div>
              <div v-else-if="artist.shared_genres.length" class="flex flex-wrap justify-center gap-1 mt-1 max-w-35">
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

      <!-- 2. MEDIUM COMPATIBILITY (30% - 69%) -->
      <section class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h2 class="text-xl font-bold tracking-wide">
              {{ feedMode === 'recruitment' ? 'Potential Band Members' : 'Good Compatibility Matches' }}
            </h2>
            <!--<span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              30% - 69% Match
            </span>-->
          </div>
          <span v-if="!isMatchingLoading" class="text-xs text-gray-400 font-medium">
            {{ mediumMatches.length }} {{ mediumMatches.length === 1 ? 'candidate' : 'candidates' }}
          </span>
        </div>

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
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="mediumMatches.length === 0"
            class="p-8 rounded-2xl bg-[#131315]/50 border border-[#2A2A2E] text-center flex flex-col items-center justify-center gap-2">
            <div class="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xl mb-1">
              <Icon name="ic:outline-queue-music" />
            </div>
            <p class="text-sm font-medium text-gray-300">No Artists Can be Found In This Category</p>
            <!--<p class="text-xs text-gray-500 max-w-md">
              Candidates sharing common musical elements will appear here.
            </p>-->
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
              <span class="text-gray-400 text-xs font-light text-center max-w-35 truncate">
                {{ artist.specialty || getLocationLabel(artist) }}
              </span>
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

      <!-- 3. DISCOVER NEW ARTISTS (FALLBACK & ZERO-MATCH SHOWCASE) -->
      <section class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold tracking-wide">Discover New Artists & Peer Collaborators</h2>
            <p class="text-xs text-gray-400 mt-0.5">Explore musicians across other genres and scenes</p>
          </div>
          <span v-if="!isMatchingLoading" class="text-xs text-gray-400 font-medium">
            {{ discoverArtists.length }} {{ discoverArtists.length === 1 ? 'artist' : 'artists' }}
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
          <div v-if="isMatchingLoading" class="flex gap-4 h-75 overflow-hidden">
            <div v-for="i in 3" :key="'disc-skel-' + i" class="flex-1 min-w-50 rounded-2xl bg-[#1E1E24] animate-pulse"></div>
          </div>

          <!-- Empty State -->
          <div v-else-if="discoverArtists.length === 0"
            class="p-10 rounded-2xl bg-[#131315]/50 border border-[#2A2A2E] text-center flex flex-col items-center justify-center gap-2">
            <div class="w-14 h-14 rounded-full bg-[#D0D4F7]/10 text-[#D0D4F7] flex items-center justify-center text-2xl mb-1">
              <Icon name="ic:outline-album" />
            </div>
            <p class="text-base font-semibold text-gray-200">No Artists Can be Found In This Category</p>
            <p class="text-xs text-gray-400 max-w-md">
              As new musicians and bands join the TONO community, they will appear here.
            </p>
          </div>

          <!-- Large Expandable Cards Carousel -->
          <div v-else ref="discoverScrollRef" @scroll="checkScroll(discoverScrollRef, 'discover')"
            class="flex h-75 gap-4 w-full overflow-x-auto scrollbar-hide scroll-smooth">
            <div v-for="(artist, index) in discoverArtists" :key="artist.artist_id"
              :class="[
                'group/card relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-500 ease-in-out flex-1 min-w-50 hover:min-w-100 hover:flex-[3_3_0%] border-2 border-transparent hover:border-[#D0D4F7] hover:z-10',
                index === discoverArtists.length - 1 && discoverArtists.length > 1 ? 'hover:-ml-12' : ''
              ]">
              <img :src="getArtistCoverUrl(artist)" :alt="artist.display_name"
                class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105" />

              <div class="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent"></div>
              <div class="absolute inset-0 bg-black/40 transition-opacity duration-500 group-hover/card:bg-transparent"></div>

              <div class="absolute top-4 right-4">
                <span class="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap shadow-md backdrop-blur-md"
                  :class="getTierBadgeClass(artist.match_tier)">
                  {{ formatScorePercent(artist.total_score) }}% Match
                </span>
              </div>

              <div class="absolute bottom-0 left-0 p-6 flex flex-col justify-end whitespace-nowrap">
                <h3 class="text-2xl font-semibold text-white tracking-tight">{{ artist.display_name }}</h3>
                <p class="text-sm font-medium text-gray-300 mt-1">
                  {{ artist.genres?.length ? artist.genres.join(', ') : (artist.specialty || 'Genre Open') }}
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
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold tracking-wide">Local Music Industry</h2>
          <span v-if="businessProfiles.length > 0" class="text-xs text-gray-500 font-medium">
            {{ businessProfiles.length }} {{ businessProfiles.length === 1 ? 'business' : 'businesses' }}
          </span>
        </div>

        <div class="relative group -mt-2">
          <!-- Left Arrow -->
          <div v-show="scrollStates.services.canScrollLeft"
            class="absolute left-0 top-0 bottom-0 w-32 z-20 flex items-center justify-start pl-2 bg-linear-to-r from-[#0E0E10] via-[#0E0E10]/80 to-transparent pointer-events-none">
            <button @click="scroll(servicesScrollRef, 'left')"
              class="flex bg-[#131315]/90 hover:bg-[#D0D4F7] hover:text-[#131315] text-white rounded-full p-2 transition-all shadow-lg backdrop-blur-md pointer-events-auto cursor-pointer">
              <Icon name="ic:baseline-chevron-left" class="text-2xl" />
            </button>
          </div>

          <!-- Skeleton Loading -->
          <div v-if="isBusinessesLoading" class="flex gap-6 p-2 pt-4 overflow-hidden">
            <div v-for="i in 5" :key="'biz-skel-' + i" class="flex flex-col items-center shrink-0 w-32">
              <div class="w-28 h-28 rounded-full bg-[#1E1E24] animate-pulse mb-3"></div>
              <div class="w-20 h-4 rounded bg-[#1E1E24] animate-pulse mb-1"></div>
              <div class="w-14 h-3 rounded bg-[#1E1E24] animate-pulse"></div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="businessProfiles.length === 0"
            class="p-8 rounded-2xl bg-[#131315]/50 border border-[#2A2A2E] text-center flex flex-col items-center justify-center gap-2">
            <div class="w-12 h-12 rounded-full bg-[#D0D4F7]/10 text-[#D0D4F7] flex items-center justify-center text-xl mb-1">
              <Icon name="ic:outline-storefront" />
            </div>
            <p class="text-sm font-medium text-gray-300">No Local Businesses Listed Yet</p>
            <p class="text-xs text-gray-500 max-w-md">
              Local music studios, repair shops, luthiers, and stores will appear here.
            </p>
          </div>

          <!-- Business Carousel -->
          <div v-else ref="servicesScrollRef" @scroll="checkScroll(servicesScrollRef, 'services')"
            class="flex overflow-x-auto gap-6 p-2 pt-4 scrollbar-hide scroll-smooth">
            <div v-for="business in businessProfiles" :key="business.BUSINESS_ID"
              class="flex flex-col items-center shrink-0 cursor-pointer transition-transform hover:scale-105 w-32 text-center">
              <img :src="getBusinessAvatarUrl(business)" :alt="business.Business_Name"
                class="w-28 h-28 rounded-full object-cover shadow-md mb-3 border border-[#3A3A3C]" />
              <span class="text-gray-200 text-sm font-medium tracking-wide truncate max-w-full" :title="business.Business_Name">
                {{ business.Business_Name }}
              </span>
              <span class="text-gray-400 text-xs font-light truncate max-w-full" :title="business.Business_Service || 'Music Service'">
                {{ business.Business_Service || 'Music Service' }}
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

      <!-- 6. JOB LISTINGS SECTION -->
      <section class="flex flex-col gap-4">
        <h2 class="text-xl font-bold tracking-wide">Job Listings & Opportunities</h2>
        <div class="p-8 rounded-2xl bg-[#131315]/50 border border-[#2A2A2E] text-center flex flex-col items-center justify-center gap-2">
          <div class="w-12 h-12 rounded-full bg-[#D0D4F7]/10 text-[#D0D4F7] flex items-center justify-center text-xl mb-1">
            <Icon name="ic:outline-work-outline" />
          </div>
          <p class="text-sm font-medium text-gray-300">No Open Job Listings Currently</p>
          <p class="text-xs text-gray-500 max-w-md">
            Venue and business job listings in your area will appear here when posted.
          </p>
        </div>
      </section>
    </div>
  </div>
</template>