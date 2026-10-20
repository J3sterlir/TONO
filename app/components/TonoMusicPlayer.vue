<script setup lang="ts">
import { watch, onMounted, onBeforeUnmount } from 'vue'
import { useTonoSongs } from '~/composables/useTonoSongs'

const user = useSupabaseUser()
const supabase = useSupabaseClient()

const {
  currentSong,
  isPlaying,
  currentTime,
  songDuration,
  isMiniPlayerVisible,
  togglePlayPause,
  replaySong,
  seekTo,
  closePlayer,
  toggleSongLike
} = useTonoSongs()

// Watch authenticated user state: if user logs out, immediately stop playback and hide player
watch(
  () => user.value,
  (newUser) => {
    if (!newUser) {
      closePlayer()
    }
  }
)

let authListenerSubscription: any = null

onMounted(() => {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      closePlayer()
    }
  })
  authListenerSubscription = data?.subscription
})

onBeforeUnmount(() => {
  if (authListenerSubscription) {
    authListenerSubscription.unsubscribe()
  }
})

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const handleSeek = (e: Event) => {
  const val = Number((e.target as HTMLInputElement).value)
  seekTo(val)
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="transform translate-y-8 opacity-0 scale-95"
    enter-to-class="transform translate-y-0 opacity-100 scale-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="transform translate-y-0 opacity-100 scale-100"
    leave-to-class="transform translate-y-8 opacity-0 scale-95"
  >
    <div
      v-if="user && isMiniPlayerVisible && currentSong"
      class="fixed bottom-5 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-50 bg-[#161619]/95 backdrop-blur-xl border border-[#46464D]/60 hover:border-[#D0D4F7]/40 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.7)] p-3.5 flex flex-col gap-2.5 text-white transition-all select-none"
    >
      <!-- Top Row: Track Info + Controls -->
      <div class="flex items-center justify-between gap-3">
        <!-- Track & Artist Info -->
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <!-- Album / Artist Thumbnail -->
          <div class="w-10 h-10 shrink-0 rounded-xl overflow-hidden bg-[#242429] border border-[#3A3A3E] flex items-center justify-center">
            <img
              v-if="currentSong.artistAvatar"
              :src="currentSong.artistAvatar"
              class="w-full h-full object-cover"
              alt="Artist avatar"
            />
            <div v-else class="w-full h-full bg-[#D0D4F7]/10 flex items-center justify-center text-[#D0D4F7]">
              <Icon name="mdi:music" class="text-lg" />
            </div>
          </div>

          <!-- Title & Artist -->
          <div class="truncate min-w-0">
            <p class="font-Sora text-xs font-semibold text-white truncate">
              {{ currentSong.Title }}
            </p>
            <p class="text-[11px] text-gray-400 font-Geist truncate">
              {{ currentSong.artistName || 'Artist' }}
            </p>
          </div>
        </div>

        <!-- Controls: Replay, Like, Play/Pause, Close -->
        <div class="flex items-center gap-1 shrink-0">
          <!-- Replay Button -->
          <button
            type="button"
            @click="replaySong"
            class="flex p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Replay from start"
          >
            <Icon name="ic:round-replay" class="text-base" />
          </button>

          <!-- Like Button -->
          <button
            type="button"
            @click="toggleSongLike(currentSong.Song_ID)"
            class="flex p-1.5 transition-colors cursor-pointer"
            :class="currentSong.userHasLiked ? 'text-[#D0D4F7]' : 'text-gray-400 hover:text-[#D0D4F7]'"
            title="Like Track"
          >
            <Icon
              :name="currentSong.userHasLiked ? 'ic:baseline-favorite' : 'ic:baseline-favorite-border'"
              class="text-lg"
            />
          </button>

          <!-- Play/Pause Button -->
          <button
            type="button"
            @click="togglePlayPause"
            class="w-8 h-8 rounded-full bg-[#D0D4F7] text-[#0E0E10] flex items-center justify-center hover:bg-[#b8bdf2] transition-colors shadow-sm cursor-pointer ml-0.5"
            :title="isPlaying ? 'Pause' : 'Play'"
          >
            <Icon
              :name="isPlaying ? 'ic:round-pause' : (currentTime >= songDuration && songDuration > 0 ? 'ic:round-replay' : 'ic:round-play-arrow')"
              class="text-xl"
            />
          </button>

          <!-- Close Button -->
          <button
            type="button"
            @click="closePlayer"
            class="flex p-1.5 text-gray-400 hover:text-white transition-colors ml-1 cursor-pointer"
            title="Close Player"
          >
            <Icon name="ic:round-close" class="text-lg" />
          </button>
        </div>
      </div>

      <!-- Bottom Row: Progress Scrubber & Times -->
      <div class="flex items-center gap-2 px-0.5">
        <span class="text-[10px] text-gray-400 font-mono w-7">
          {{ formatTime(currentTime) }}
        </span>
        <input
          type="range"
          :min="0"
          :max="songDuration || 60"
          :step="0.5"
          :value="currentTime"
          @input="handleSeek"
          class="flex-1 h-1 bg-[#2A2A2E] rounded-lg accent-[#D0D4F7] cursor-pointer"
        />
        <span class="text-[10px] text-gray-400 font-mono w-7 text-right">
          {{ formatTime(songDuration) }}
        </span>
      </div>
    </div>
  </Transition>
</template>
