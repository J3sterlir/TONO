<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { parseMediaUrl } from '~/utils/embedHelper'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    initialUrl?: string
    initialTitle?: string
    initialCaption?: string
    isEdit?: boolean
  }>(),
  {
    initialUrl: '',
    initialTitle: '',
    initialCaption: '',
    isEdit: false,
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { url: string; title: string; caption: string }): void
}>()

const url = ref('')
const title = ref('')
const caption = ref('')

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      url.value = props.initialUrl || ''
      title.value = props.initialTitle || ''
      caption.value = props.initialCaption || ''
    }
  },
  { immediate: true }
)

const parsedMedia = computed(() => parseMediaUrl(url.value))
const isValid = computed(() => {
  return url.value.trim().length > 0 && parsedMedia.value.type !== 'unsupported' && Boolean(parsedMedia.value.embedUrl)
})

const handleSave = () => {
  if (!isValid.value) return
  emit('save', {
    url: url.value.trim(),
    title: title.value.trim(),
    caption: caption.value.trim(),
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
              <Icon name="ic:outline-video-library" class="text-xl text-[#D0D4F7]" />
            </div>
            <div>
              <h2 class="font-Sora font-semibold text-base sm:text-lg text-white">
                {{ isEdit ? 'Edit Featured Media' : 'Add Featured Media' }}
              </h2>
              <span class="text-xs text-gray-400 font-Geist">
                YouTube, Google Drive, or Vimeo Video
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
          <!-- Public / Unlisted Notice Banner -->
          <div class="p-3.5 rounded-xl bg-[#1E1E24] border border-[#46464D]/50 flex items-start gap-3">
            <Icon name="ic:outline-info" class="text-xl text-[#D0D4F7] shrink-0 mt-0.5" />
            <div class="text-xs text-gray-300 leading-relaxed">
              <p class="font-semibold text-white mb-0.5">Sharing Permissions Notice</p>
              Please ensure your video link is set to <span class="text-[#D0D4F7] font-medium">Public</span> or <span class="text-[#D0D4F7] font-medium">Unlisted</span>. For Google Drive, the file access must be set to <span class="text-[#D0D4F7] font-medium">'Anyone with the link can view'</span>.
            </div>
          </div>

          <!-- Video URL Input -->
          <div>
            <label class="block text-xs sm:text-sm font-semibold text-gray-200 mb-1.5 font-Sora">
              Video URL <span class="text-[#D0D4F7]">*</span>
            </label>
            <input
              type="text"
              v-model="url"
              placeholder="e.g. https://www.youtube.com/watch?v=... or Google Drive link"
              class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all" />
            <p v-if="url && !isValid" class="text-[11px] text-amber-300 mt-1">
              Please enter a valid YouTube, Google Drive, or Vimeo link.
            </p>
          </div>

          <!-- Live Preview -->
          <div v-if="url && isValid" class="space-y-1.5">
            <label class="block text-xs font-semibold text-gray-300 font-Sora">
              Live Preview ({{ parsedMedia.platformName }})
            </label>
            <MediaEmbed :url="url" />
          </div>

          <!-- Headline / Title Input -->
          <div>
            <label class="block text-xs sm:text-sm font-semibold text-gray-200 mb-1.5 font-Sora">
              Performance / Release Title <span class="text-gray-400 font-normal text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              v-model="title"
              maxlength="100"
              placeholder="e.g. Battle of the Bands Championship Finale"
              class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all" />
          </div>

          <!-- Caption Textarea -->
          <div>
            <label class="block text-xs sm:text-sm font-semibold text-gray-200 mb-1.5 font-Sora">
              Post Caption <span class="text-gray-400 font-normal text-xs">(Optional)</span>
            </label>
            <textarea
              v-model="caption"
              maxlength="400"
              rows="3"
              placeholder="Tell your fans about this performance, music video, or live session..."
              class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all resize-none leading-relaxed"></textarea>
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
            :disabled="!isValid"
            class="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D0D4F7] hover:bg-[#B8BCF0] text-black text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md">
            <Icon name="ic:round-check" class="text-base" />
            <span>{{ isEdit ? 'Update Media' : 'Add to Media' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
