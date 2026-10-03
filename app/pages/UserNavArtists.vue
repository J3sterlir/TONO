<script setup lang="ts">
definePageMeta({
  layout: 'user',
  middleware: 'auth'
})

import { ref, computed, onMounted } from 'vue'

const supabase = useSupabaseClient()
const db = supabase as any
const { fetchCurrentUserProfile } = useTonoAuth()

interface ArtistCard {
  artistId: string
  accountId: string
  username: string
  displayName: string
  artistType: 'Solo' | 'Band'
  specialty?: string
  city?: string
  avatarUrl: string
  isVerified: boolean
  genres: string[]
}

const artists = ref<ArtistCard[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const selectedType = ref<'all' | 'Solo' | 'Band'>('all')

onMounted(async () => {
  try {
    const profile = await fetchCurrentUserProfile()
    if (profile?.artistProfile) {
      setPageLayout('artist')
    } else {
      setPageLayout('user')
    }

    await fetchArtists()
  } catch (error) {
    console.error('Error initializing artists page:', error)
  } finally {
    isLoading.value = false
  }
})

const fetchArtists = async () => {
  try {
    const { data, error } = await db
      .from('ARTIST')
      .select(`
        ARTIST_ID,
        ACCOUNT_ID,
        Artist_Type,
        Is_Verified,
        Status,
        USER_ACCOUNT (
          Username,
          City,
          Profile_Picture
        ),
        SOLO_ARTIST (
          Artist_Name,
          Specialty,
          SOLO_GENRES (
            TAG_GENRE ( Name )
          )
        ),
        BAND (
          Band_Name,
          BAND_GENRES (
            TAG_GENRE ( Name )
          )
        )
      `)
      .order('Created_at', { ascending: false })

    if (error) throw error

    artists.value = (data || []).map((row: any) => {
      const isBand = row.Artist_Type === 'Band'
      const solo = Array.isArray(row.SOLO_ARTIST) ? row.SOLO_ARTIST[0] : row.SOLO_ARTIST
      const band = Array.isArray(row.BAND) ? row.BAND[0] : row.BAND
      const user = row.USER_ACCOUNT || {}

      const displayName = isBand 
        ? (band?.Band_Name || user.Username || 'Band')
        : (solo?.Artist_Name || user.Username || 'Artist')

      let genres: string[] = []
      if (isBand && band?.BAND_GENRES) {
        genres = band.BAND_GENRES.map((g: any) => g.TAG_GENRE?.Name).filter(Boolean)
      } else if (solo?.SOLO_GENRES) {
        genres = solo.SOLO_GENRES.map((g: any) => g.TAG_GENRE?.Name).filter(Boolean)
      }

      const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1E1E24&color=D0D4F7&bold=true&size=150`

      return {
        artistId: row.ARTIST_ID,
        accountId: row.ACCOUNT_ID,
        username: user.Username || '',
        displayName,
        artistType: (row.Artist_Type as 'Solo' | 'Band') || 'Solo',
        specialty: solo?.Specialty || '',
        city: user.City || '',
        avatarUrl: user.Profile_Picture || defaultAvatar,
        isVerified: !!row.Is_Verified,
        genres
      }
    })
  } catch (err) {
    console.error('Error fetching artists catalog:', err)
  }
}

const filteredArtists = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return artists.value.filter((artist) => {
    const matchesType = selectedType.value === 'all' || artist.artistType === selectedType.value
    if (!matchesType) return false

    if (!query) return true
    const inName = artist.displayName.toLowerCase().includes(query)
    const inUsername = artist.username.toLowerCase().includes(query)
    const inSpecialty = (artist.specialty || '').toLowerCase().includes(query)
    const inCity = (artist.city || '').toLowerCase().includes(query)
    const inGenres = artist.genres.some(g => g.toLowerCase().includes(query))

    return inName || inUsername || inSpecialty || inCity || inGenres
  })
})
</script>

<template>
  <title>Artists | TONO</title>
  <div class="h-full bg-[#0E0E10] text-white flex flex-col min-h-screen">
    <main class="max-w-7xl mx-auto w-full px-6 sm:px-10 py-10 flex flex-col gap-8">
      <!-- Header & Intro -->
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#2A2A2E]">
        <div>
          <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-[#E5E1E4]">
            Discover Artists
          </h1>
          <p class="text-sm text-gray-400 mt-2">
            Explore verified Filipino musicians, solo artists, and indie bands across the country.
          </p>
        </div>

        <!-- Search Bar -->
        <div class="relative w-full md:w-80">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search artists, genres, or cities..."
            class="w-full bg-[#18181B] border border-[#3A3A3C] rounded-xl px-4 py-2.5 pl-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#D0D4F7] transition-colors"
          />
          <Icon name="ic:baseline-search" class="absolute left-3 top-3 text-gray-400 text-lg" />
        </div>
      </div>

      <!-- Filters Row -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <button
            @click="selectedType = 'all'"
            class="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
            :class="selectedType === 'all' ? 'bg-[#D0D4F7] text-[#0E0E10] font-semibold' : 'bg-[#18181B] text-gray-400 hover:text-white border border-[#2A2A2E]'"
          >
            All ({{ artists.length }})
          </button>
          <button
            @click="selectedType = 'Solo'"
            class="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
            :class="selectedType === 'Solo' ? 'bg-[#D0D4F7] text-[#0E0E10] font-semibold' : 'bg-[#18181B] text-gray-400 hover:text-white border border-[#2A2A2E]'"
          >
            Solo Artists
          </button>
          <button
            @click="selectedType = 'Band'"
            class="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
            :class="selectedType === 'Band' ? 'bg-[#D0D4F7] text-[#0E0E10] font-semibold' : 'bg-[#18181B] text-gray-400 hover:text-white border border-[#2A2A2E]'"
          >
            Bands
          </button>
        </div>

        <span class="text-xs text-gray-500">
          Showing {{ filteredArtists.length }} {{ filteredArtists.length === 1 ? 'artist' : 'artists' }}
        </span>
      </div>

      <!-- Loading Skeleton -->
      <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <div
          v-for="i in 8"
          :key="'skel-' + i"
          class="p-6 rounded-2xl bg-[#131315] border border-[#2A2A2E] flex flex-col items-center animate-pulse gap-3"
        >
          <div class="w-24 h-24 rounded-full bg-[#1E1E24]"></div>
          <div class="w-32 h-4 bg-[#2A2A32] rounded"></div>
          <div class="w-20 h-3 bg-[#2A2A32] rounded"></div>
          <div class="w-full h-8 bg-[#1E1E24] rounded-lg mt-2"></div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="filteredArtists.length === 0"
        class="py-16 px-6 text-center rounded-2xl bg-[#131315]/50 border border-[#2A2A2E] flex flex-col items-center justify-center gap-3"
      >
        <div class="w-14 h-14 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-2xl mb-1">
          <Icon name="ic:outline-person-search" />
        </div>
        <h3 class="text-lg font-semibold text-gray-200">No artists found</h3>
        <p class="text-xs text-gray-400 max-w-sm">
          No artists matched your search criteria. Try clearing the filters or searching with different keywords.
        </p>
        <button
          v-if="searchQuery || selectedType !== 'all'"
          @click="searchQuery = ''; selectedType = 'all'"
          class="mt-2 px-4 py-2 rounded-xl bg-[#2A2A2E] hover:bg-[#3A3A3E] text-xs text-gray-200 transition-colors"
        >
          Reset Filters
        </button>
      </div>

      <!-- Artists Grid -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <div
          v-for="artist in filteredArtists"
          :key="artist.artistId"
          class="group p-5 rounded-2xl bg-[#131315] border border-[#2A2A2E] hover:border-[#46464D] transition-all flex flex-col justify-between"
        >
          <div class="flex flex-col items-center text-center">
            <!-- Avatar with Verified Badge -->
            <div class="relative mb-3">
              <img
                :src="artist.avatarUrl"
                :alt="artist.displayName"
                class="w-24 h-24 rounded-full object-cover shadow-lg border-2 border-[#2A2A2E] group-hover:border-[#D0D4F7] transition-colors"
              />
              <span
                v-if="artist.isVerified"
                class="absolute bottom-0 right-0 p-1 bg-indigo-500 text-white rounded-full text-xs shadow flex items-center justify-center"
                title="Verified Artist"
              >
                <Icon name="ic:baseline-verified" />
              </span>
            </div>

            <!-- Names -->
            <h3 class="text-base font-semibold text-gray-100 group-hover:text-[#D0D4F7] transition-colors truncate max-w-full">
              {{ artist.displayName }}
            </h3>
            <span class="text-xs text-gray-400 truncate max-w-full mt-0.5">
              @{{ artist.username }}
            </span>

            <!-- Specialty & Location -->
            <div class="mt-2 flex flex-col items-center gap-1 text-xs text-gray-400">
              <span v-if="artist.specialty" class="text-gray-300 font-light truncate max-w-full">
                {{ artist.specialty }}
              </span>
              <span v-if="artist.city" class="flex items-center gap-1 text-[11px] text-gray-500">
                <Icon name="ic:baseline-location-on" class="text-xs" />
                {{ artist.city }}
              </span>
            </div>

            <!-- Genre Badges -->
            <div v-if="artist.genres.length" class="flex flex-wrap justify-center gap-1.5 mt-3">
              <span
                v-for="genre in artist.genres.slice(0, 3)"
                :key="genre"
                class="px-2 py-0.5 rounded-md text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
              >
                {{ genre }}
              </span>
            </div>
          </div>

          <!-- Profile Link Button -->
          <NuxtLink
            v-if="artist.username"
            :to="`/artist/${artist.username}`"
            class="mt-5 w-full py-2 rounded-xl bg-[#1E1E24] hover:bg-[#D0D4F7] text-gray-300 hover:text-[#0E0E10] text-xs font-medium text-center transition-all flex items-center justify-center gap-1.5 no-underline"
          >
            <span>View Profile</span>
            <Icon name="ic:baseline-arrow-outward" class="text-xs" />
          </NuxtLink>
        </div>
      </div>
    </main>
  </div>
</template>