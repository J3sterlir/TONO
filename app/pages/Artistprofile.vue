<script setup lang="ts">
definePageMeta({
  layout: 'artist',
  middleware: ['auth', 'artist']
})

import { ref, computed, onMounted } from 'vue'

const supabase = useSupabaseClient()
const { fetchCurrentUserProfile, resolveUserType } = useTonoAuth()

const artistName = ref('Artist')
const artistBio = ref('')
const usertype = ref('')
const artistTags = ref<string[]>([])
const isLoading = ref(true)

const tagsDisplay = computed(() => {
  if (artistTags.value.length === 0) return 'No tags selected'
  return artistTags.value.join(', ')
})

onMounted(async () => {
  try {
    const profile = await fetchCurrentUserProfile()

    if (profile) {
      // If artist is Band, fetch Band_Name from BAND table
      if (profile.artistProfile?.Artist_Type === 'Band') {
        const { data: bandData } = await supabase
          .from('BAND')
          .select('Band_Name')
          .eq('ARTIST_ID', profile.artistProfile.ARTIST_ID)
          .maybeSingle()

        if (bandData?.Band_Name) {
          artistName.value = bandData.Band_Name
        } else if (profile.artistProfile?.StageName) {
          artistName.value = profile.artistProfile.StageName
        } else if (profile.account?.Username) {
          artistName.value = profile.account.Username
        }
      } else if (profile.artistProfile?.Artist_Type === 'Solo') {
        const { data: soloData } = await supabase
          .from('SOLO_ARTIST')
          .select('Artist_Name')
          .eq('ARTIST_ID', profile.artistProfile.ARTIST_ID)
          .maybeSingle()

        if (soloData?.Artist_Name) {
          artistName.value = soloData.Artist_Name
        } else if (profile.artistProfile?.StageName) {
          artistName.value = profile.artistProfile.StageName
        } else if (profile.account?.Username) {
          artistName.value = profile.account.Username
        }
      } else if (profile.artistProfile?.StageName) {
        artistName.value = profile.artistProfile.StageName
      } else if (profile.account?.Username) {
        artistName.value = profile.account.Username
      }

      if (profile.artistProfile?.Bio) {
        artistBio.value = profile.artistProfile.Bio
      }

      usertype.value = resolveUserType(profile)
      artistTags.value = [...(profile.genres || []), ...(profile.instruments || [])]
    }
  } catch (error) {
    console.error('Error fetching profile:', error)
  } finally {
    isLoading.value = false
  }
})

const handleLogout = async () => {
  await supabase.auth.signOut()
  await navigateTo('/Login')
}
</script>

<template>
  <div class="h-full bg-[#0E0E10] text-white flex flex-col min-h-screen pb-16 overflow-x-hidden">

    <!-- Header Banner & Profile Info -->
    <div class="relative w-full overflow-hidden bg-[#131315] border-b border-[#46464D]/20">
      <!-- Background Banner Image -->
      <div class="absolute inset-0 z-0">
        <div v-if="isLoading" class="w-full h-full bg-[#1E1E24] animate-pulse"></div>
        <img
          v-else
          src="https://images.unsplash.com/photo-1542813813-1f873f401e9b"
          alt="Profile Banner"
          class="w-full h-full object-cover object-center opacity-70 mask-x-from-70% mask-x-to-90%" />
        <!-- Soft gradient overlay for contrast on both mobile and desktop -->
        <div class="absolute inset-0 bg-gradient-to-t from-[#0E0E10] via-[#0E0E10]/40 to-transparent md:bg-gradient-to-r md:from-[#0E0E10]/90 md:via-[#0E0E10]/60 md:to-transparent"></div>
      </div>

      <!-- Loading Skeleton for Header -->
      <div
        v-if="isLoading"
        class="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-8 sm:py-10 min-h-[300px] md:min-h-[340px] flex flex-col-reverse md:flex-row items-center md:items-end justify-between gap-6 animate-pulse">
        <div class="flex flex-col items-center md:items-start gap-3 w-full md:w-auto">
          <div class="h-4 w-24 bg-[#1E1E24] rounded-md"></div>
          <div class="h-12 sm:h-16 w-64 sm:w-80 max-w-full bg-[#1E1E24] rounded-xl"></div>
          <div class="h-4 w-48 sm:w-64 max-w-full bg-[#1E1E24] rounded-md"></div>
          <div class="h-5 w-48 sm:w-60 max-w-full bg-[#1E1E24] rounded-md"></div>
        </div>
        <div class="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full bg-[#1E1E24] border border-[#46464D]/30 shrink-0"></div>
      </div>

      <!-- Loaded Header Info -->
      <div
        v-else
        class="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-8 sm:py-10 min-h-[300px] md:min-h-[340px] flex flex-col-reverse md:flex-row items-center md:items-end justify-between gap-6">
        <!-- Left: Details -->
        <div class="flex flex-col items-center md:items-start text-center md:text-left gap-1.5 min-w-0 max-w-full">
          <span class="font-Geist font-medium text-xs sm:text-[14px] text-[#D0D4F7]/90 tracking-wider uppercase">
            {{ usertype || 'Artist' }}
          </span>
          <h1 class="font-Sora font-bold text-3xl sm:text-5xl lg:text-[64px] tracking-tight text-white leading-tight break-words max-w-full">
            {{ artistName || 'Artist' }}
          </h1>
          <div class="max-w-xl my-1">
            <p v-if="artistBio" class="text-xs sm:text-sm md:text-[15px] text-gray-200/90 leading-relaxed line-clamp-3 md:line-clamp-4">
              {{ artistBio }}
            </p>
            <p v-else class="text-xs sm:text-sm text-gray-400/70 italic">
              No bio yet. Click Update Profile to add your story.
            </p>
          </div>
          <div class="flex flex-wrap items-center justify-center md:justify-start gap-2 bg-black/50 backdrop-blur-xs px-3 py-1.5 rounded-lg max-w-full border border-white/5">
            <span class="font-HankenGrotesk text-xs sm:text-[15px] text-gray-400 font-bold shrink-0">
              Artist Tags:
            </span>
            <span class="text-xs sm:text-[15px] text-[#D0D4F7] font-medium break-words">
              {{ tagsDisplay }}
            </span>
          </div>
        </div>

        <!-- Right: Avatar & Edit button -->
        <div class="flex flex-col justify-center items-center shrink-0">
          <div
            class="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 bg-[#353437] rounded-full flex items-center justify-center text-gray-500 overflow-hidden shadow-2xl border-2 border-[#46464D]/50 relative group">
            <Icon name="ic:outline-account-circle" class="w-full h-full text-[#46464D]" />
          </div>
          <button class="flex gap-1.5 justify-center items-center mt-3 text-xs sm:text-sm text-[#C7C5CE] hover:text-[#D0D4F7] transition-colors cursor-pointer group">
            <span>Update Profile</span>
            <Icon name="ic:outline-edit" class="text-base group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="w-full border-b border-[#46464D]/20 bg-[#0E0E10]">
      <div class="max-w-7xl mx-auto px-4 sm:px-8 md:px-16 overflow-x-auto scrollbar-hide">
        <div class="flex gap-8 sm:gap-12 text-[15px] sm:text-[17px] min-w-max">
          <button class="font-Sora text-[#D0D4F7] hover:text-[#D0D4F7] cursor-pointer">
            <span class="inline-block border-b-2 border-[#D0D4F7] py-4 sm:py-5 font-semibold">Posts</span>
          </button>
          <button class="font-Sora text-[#C7C5CE] hover:text-[#D0D4F7] cursor-pointer transition-colors">
            <span class="inline-block py-4 sm:py-5">Calendar</span>
          </button>
          <button class="font-Sora text-[#C7C5CE] hover:text-[#D0D4F7] cursor-pointer transition-colors">
            <span class="inline-block py-4 sm:py-5">Portfolio</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <main class="max-w-7xl mx-auto w-full px-4 sm:px-8 md:px-16 mt-6 sm:mt-8">
      <!-- Loading Skeleton for Feed & Sidebar -->
      <div v-if="isLoading" class="flex flex-col lg:flex-row gap-6 items-start w-full animate-pulse">
        <div class="flex-1 w-full min-w-0 flex flex-col gap-6">
          <div class="h-32 sm:h-40 rounded-xl bg-[#1E1E24]"></div>
          <div class="h-96 rounded-xl bg-[#1E1E24]"></div>
        </div>
        <div class="w-full lg:w-80 xl:w-92 h-80 rounded-xl bg-[#1E1E24] shrink-0"></div>
      </div>

      <!-- Loaded Content -->
      <div v-else class="flex flex-col lg:flex-row gap-6 items-start w-full">
        <!-- Left: Feed Column -->
        <div class="flex-1 w-full min-w-0 flex flex-col gap-6">
          <!-- Create Post Card -->
          <div
            class="flex gap-2 flex-col items-center justify-center p-6 sm:p-10 md:p-12 border border-[#46464D] border-dashed rounded-xl min-h-[140px] sm:h-46.25 transition-all hover:border-[#D0D4F7] hover:bg-[#D0D4F7]/5 group cursor-pointer w-full">
            <div class="flex border p-2.5 sm:p-3 rounded-full border-[#46464D] group-hover:border-[#D0D4F7] transition-colors">
              <Icon name="ic:baseline-plus" class="text-xl text-[#C7C5CE] group-hover:text-[#D0D4F7]" />
            </div>
            <h2 class="font-Geist font-medium text-xs sm:text-[14px] text-[#C7C5CE] group-hover:text-[#D0D4F7] transition-all tracking-wide">
              CREATE A POST
            </h2>
          </div>

          <!-- Post Card -->
          <article class="bg-[#1B1B1D] border border-[#46464D]/40 rounded-xl overflow-hidden w-full shadow-lg">
            <div class="w-full aspect-[16/9] sm:aspect-[21/9] md:aspect-[16/9] max-h-[550px] overflow-hidden bg-black/40">
              <img
                src="https://images.unsplash.com/photo-1468392788711-903a924761a6"
                alt="Post Media"
                class="object-cover w-full h-full hover:scale-[1.02] transition-transform duration-500" />
            </div>

            <div class="flex flex-col gap-4 p-4 sm:p-6">
              <div>
                <h3 class="font-Sora text-base sm:text-[18px] font-semibold text-white">
                  {{ artistName || 'Artist' }}
                </h3>
                <span class="font-HankenGrotesk text-xs text-[#C7C5CE]">2 hours ago</span>
              </div>

              <div>
                <p class="text-sm sm:text-base text-gray-300 leading-relaxed">
                  Post Caption goes here. "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. We've been experimenting with these new textures lately."
                </p>
              </div>

              <div class="flex justify-between items-center pt-2 border-t border-[#46464D]/20 text-sm">
                <div class="flex gap-4 sm:gap-6 items-center">
                  <button class="flex gap-1.5 items-center text-[#C7C5CE] hover:text-[#D0D4F7] transition-colors cursor-pointer">
                    <Icon name="ic:baseline-favorite-border" class="text-xl sm:text-2xl" />
                    <span class="text-xs sm:text-sm font-medium">1.2k</span>
                  </button>

                  <button class="flex gap-1.5 items-center text-[#C7C5CE] hover:text-[#D0D4F7] transition-colors cursor-pointer">
                    <Icon name="ic:sharp-chat-bubble-outline" class="text-xl sm:text-2xl" />
                    <span class="text-xs sm:text-sm font-medium">1.3k</span>
                  </button>
                </div>

                <button class="text-[#C7C5CE] hover:text-[#D0D4F7] transition-colors cursor-pointer" title="Share Post">
                  <Icon name="ic:round-share" class="text-xl sm:text-2xl" />
                </button>
              </div>
            </div>
          </article>
        </div>

        <!-- Right: Upcoming Events Sidebar -->
        <aside class="w-full lg:w-80 xl:w-92 shrink-0 bg-[#1B1B1D] border border-[#46464D]/30 rounded-xl p-5 sm:p-6 flex flex-col justify-between gap-6 shadow-lg">
          <div class="flex flex-col gap-4">
            <h2 class="font-Sora text-lg sm:text-[20px] text-[#D0D4F7] font-semibold">
              Upcoming Events
            </h2>

            <div class="flex flex-col gap-3 sm:gap-4">
              <div class="flex items-center gap-3 sm:gap-4 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                <div
                  class="flex p-2.5 sm:p-3 border border-[#B4B8DA]/20 rounded-lg bg-[#B4B8DA]/10 items-center justify-center w-12 h-12 sm:w-14 sm:h-14 shrink-0 text-center">
                  <div class="flex flex-col font-HankenGrotesk leading-tight">
                    <span class="text-sm sm:text-base font-bold text-white">24</span>
                    <span class="text-[10px] text-[#D0D4F7] uppercase tracking-wider font-semibold">OCT</span>
                  </div>
                </div>

                <div class="flex flex-col min-w-0">
                  <h4 class="font-medium text-sm sm:text-base text-white truncate">Neon Nights Live</h4>
                  <p class="text-xs text-gray-400 truncate">Quezon City, Manila</p>
                </div>
              </div>

              <div class="flex items-center gap-3 sm:gap-4 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                <div
                  class="flex p-2.5 sm:p-3 border border-[#B4B8DA]/20 rounded-lg bg-[#B4B8DA]/10 items-center justify-center w-12 h-12 sm:w-14 sm:h-14 shrink-0 text-center">
                  <div class="flex flex-col font-HankenGrotesk leading-tight">
                    <span class="text-sm sm:text-base font-bold text-white">28</span>
                    <span class="text-[10px] text-[#D0D4F7] uppercase tracking-wider font-semibold">OCT</span>
                  </div>
                </div>

                <div class="flex flex-col min-w-0">
                  <h4 class="font-medium text-sm sm:text-base text-white truncate">Acoustic Session</h4>
                  <p class="text-xs text-gray-400 truncate">BGC, Taguig</p>
                </div>
              </div>
            </div>
          </div>

          <button class="w-full flex items-center justify-center p-3 border rounded-lg border-[#D0D4F7]/60 hover:border-[#D0D4F7] hover:bg-[#D0D4F7]/10 font-Geist font-medium text-xs sm:text-sm text-[#D0D4F7] transition-all cursor-pointer">
            <span>VIEW ALL EVENTS</span>
          </button>
        </aside>
      </div>
    </main>

  </div>
</template>