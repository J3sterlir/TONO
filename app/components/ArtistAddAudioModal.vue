<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { parseMediaUrl } from '~/utils/embedHelper'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    initialUrl?: string
    initialTitle?: string
    initialDisplayText?: string
    isEdit?: boolean
  }>(),
  {
    initialUrl: '',
    initialTitle: '',
    initialDisplayText: '',
    isEdit: false,
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { url: string; title: string; displayText: string; platform: string }): void
}>()

const url = ref('')
const title = ref('')
const displayText = ref('')

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      url.value = props.initialUrl || ''
      title.value = props.initialTitle || ''
      displayText.value = props.initialDisplayText || ''
    }
  },
  { immediate: true }
)

const parsedMedia = computed(() => parseMediaUrl(url.value))
const isAudioValid = computed(() => {
  return (
    url.value.trim().length > 0 &&
    (parsedMedia.value.type === 'spotify' || parsedMedia.value.type === 'soundcloud') &&
    Boolean(parsedMedia.value.embedUrl)
  )
})

const handleSave = () => {
  if (!isAudioValid.value) return
  emit('save', {
    url: url.value.trim(),
    title: title.value.trim(),
    displayText: displayText.value.trim(),
    platform: parsedMedia.value.type,
  })
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md transition-opacity">
      <div
        class="relative w-full max-w-xl bg-[#131315] border border-[#46464D]/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white animate-in fade-in zoom-in-95 duration-200">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-[#46464D]/40 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-[#1E1E24] flex items-center justify-center border border-[#46464D]/50 shrink-0">
              <Icon name="ic:outline-music-note" class="text-xl text-[#D0D4F7]" />
            </div>
            <div>
              <h2 class="font-Sora font-semibold text-base sm:text-lg text-white">
                {{ isEdit ? 'Edit Audio Release' : 'Add Original Song / Release' }}
              </h2>
              <span class="text-xs text-gray-400 font-Geist">
                Spotify Track/Album or SoundCloud Song
              </span>
            </div>
          </div>

          <button
            @click="$emit('close')"
            class="flex p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Close">
            <Icon name="ic:round-close" class="text-xl" />
          </button>
        </div>

        <!-- Form Body -->
        <div class="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5 scrollbar-thin">
          <!-- Audio URL Input -->
          <div>
            <label class="block text-xs sm:text-sm font-semibold text-gray-200 mb-1.5 font-Sora">
              Audio Link (Spotify or SoundCloud) <span class="text-[#D0D4F7]">*</span>
            </label>
            <input
              type="text"
              v-model="url"
              placeholder="e.g. https://open.spotify.com/track/... or soundcloud.com/..."
              class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all" />
            <p v-if="url && !isAudioValid" class="text-[11px] text-amber-300 mt-1">
              Please enter a valid Spotify track/album or SoundCloud URL.
            </p>
          </div>

          <!-- Live Preview -->
          <div v-if="url && isAudioValid" class="space-y-1.5">
            <label class="block text-xs font-semibold text-gray-300 font-Sora">
              Live Preview ({{ parsedMedia.platformName }})
            </label>
            <MediaEmbed :url="url" />
          </div>

          <!-- Song Title Input -->
          <div>
            <label class="block text-xs sm:text-sm font-semibold text-gray-200 mb-1.5 font-Sora">
              Track / Album Title <span class="text-[#D0D4F7]">*</span>
            </label>
            <input
              type="text"
              v-model="title"
              maxlength="100"
              placeholder="e.g. Mix Up Machine"
              class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all" />
          </div>

          <!-- Optional Release Notes / Caption -->
          <div>
            <label class="block text-xs sm:text-sm font-semibold text-gray-200 mb-1.5 font-Sora">
              Release Notes / Details <span class="text-gray-400 font-normal text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              v-model="displayText"
              maxlength="150"
              placeholder="e.g. Debut Single • Produced by TONO Records"
              class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all" />
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="px-5 sm:px-7 py-3.5 bg-[#18181D] border-t border-[#46464D]/40 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            @click="$emit('close')"
            class="px-4 py-2 rounded-xl bg-transparent hover:bg-white/5 border border-[#46464D]/70 text-xs sm:text-sm font-medium text-gray-300 hover:text-white transition-all cursor-pointer">
            Cancel
          </button>

          <button
            type="button"
            @click="handleSave"
            :disabled="!isAudioValid || !title.trim()"
            class="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D0D4F7] hover:bg-[#B8BCF0] text-black text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md">
            <Icon name="ic:round-check" class="text-base" />
            <span>{{ isEdit ? 'Update Song' : 'Add to Songs' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
