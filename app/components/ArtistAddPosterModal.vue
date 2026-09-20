<script setup lang="ts">
import { ref, watch } from 'vue'
import { validateImageFile } from '~/utils/imageOptimizer'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    initialTitle?: string
    initialFileUrl?: string
    isEdit?: boolean
    uploadFn: (file: File | Blob, subfolder: 'milestones' | 'posters') => Promise<string>
  }>(),
  {
    initialTitle: '',
    initialFileUrl: '',
    isEdit: false,
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { fileUrl: string; title: string }): void
}>()

const title = ref('')
const fileUrl = ref('')
const selectedFile = ref<File | null>(null)
const previewUrl = ref('')
const isUploading = ref(false)
const errorMessage = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      title.value = props.initialTitle || ''
      fileUrl.value = props.initialFileUrl || ''
      previewUrl.value = props.initialFileUrl || ''
      selectedFile.value = null
      errorMessage.value = null
    }
  },
  { immediate: true }
)

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const validation = validateImageFile(file, 15)
  if (!validation.valid) {
    errorMessage.value = validation.error || 'Invalid image file.'
    return
  }

  errorMessage.value = null
  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
}

const handleSave = async () => {
  if (!selectedFile.value && !fileUrl.value) {
    errorMessage.value = 'Please select a promotional poster image.'
    return
  }

  isUploading.value = true
  errorMessage.value = null

  try {
    let finalUrl = fileUrl.value

    if (selectedFile.value) {
      finalUrl = await props.uploadFn(selectedFile.value, 'posters')
    }

    emit('save', {
      fileUrl: finalUrl,
      title: title.value.trim(),
    })
    emit('close')
  } catch (err: any) {
    console.error('Poster upload error:', err)
    errorMessage.value = err.message || 'Failed to upload promotional poster.'
  } finally {
    isUploading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md transition-opacity">
      <div
        class="relative w-full max-w-lg bg-[#131315] border border-[#46464D]/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white animate-in fade-in zoom-in-95 duration-200">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-[#46464D]/40 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-[#1E1E24] flex items-center justify-center border border-[#46464D]/50 shrink-0">
              <Icon name="ic:outline-photo-library" class="text-xl text-[#D0D4F7]" />
            </div>
            <div>
              <h2 class="font-Sora font-semibold text-base sm:text-lg text-white">
                {{ isEdit ? 'Edit Promotional Poster' : 'Upload Promotional Poster' }}
              </h2>
              <span class="text-xs text-gray-400 font-Geist">
                Gigs, Tours, Single Artwork, or Event Flyers (Max 4)
              </span>
            </div>
          </div>

          <button
            @click="$emit('close')"
            :disabled="isUploading"
            class="flex p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Close">
            <Icon name="ic:round-close" class="text-xl" />
          </button>
        </div>

        <!-- Form Body -->
        <div class="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5 scrollbar-thin">
          <div
            v-if="errorMessage"
            class="p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center gap-2">
            <Icon name="ic:outline-error-outline" class="text-base shrink-0 text-red-400" />
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Vertical Poster Picker -->
          <div class="flex flex-col items-center justify-center gap-3 py-2">
            <div
              @click="fileInputRef?.click()"
              class="relative w-48 sm:w-56 aspect-3/4 rounded-xl overflow-hidden bg-[#1E1E24] border-2 border-dashed border-[#D0D4F7]/60 hover:border-[#D0D4F7] cursor-pointer group flex items-center justify-center transition-all shadow-xl">
              <img
                v-if="previewUrl"
                :src="previewUrl"
                alt="Poster Preview"
                class="w-full h-full object-cover group-hover:opacity-75 transition-opacity" />
              <div
                v-else
                class="flex flex-col items-center text-center p-4 text-gray-400 group-hover:text-[#D0D4F7] transition-colors">
                <Icon name="ic:outline-add-photo-alternate" class="text-4xl mb-2" />
                <span class="text-xs font-medium">Click to select poster</span>
                <span class="text-[10px] text-gray-500 mt-0.5">Aspect ratio 3:4</span>
              </div>

              <div
                v-if="previewUrl"
                class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-semibold text-white">
                Change Poster
              </div>
            </div>

            <input
              ref="fileInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="hidden"
              @change="handleFileSelect" />

            <span class="text-[11px] text-gray-400">
              Vertical poster / flyer format (JPEG, PNG, WebP up to 15MB)
            </span>
          </div>

          <!-- Poster Title / Tour Name -->
          <div>
            <label class="block text-xs sm:text-sm font-semibold text-gray-200 mb-1.5 font-Sora">
              Poster / Event Title <span class="text-gray-400 font-normal text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              v-model="title"
              maxlength="80"
              placeholder="e.g. Echoes of the Night: Summer Tour 2026"
              class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all" />
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="px-5 sm:px-7 py-3.5 bg-[#18181D] border-t border-[#46464D]/40 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            @click="$emit('close')"
            :disabled="isUploading"
            class="px-4 py-2 rounded-xl bg-transparent hover:bg-white/5 border border-[#46464D]/70 text-xs sm:text-sm font-medium text-gray-300 hover:text-white transition-all cursor-pointer disabled:opacity-50">
            Cancel
          </button>

          <button
            type="button"
            @click="handleSave"
            :disabled="isUploading || (!previewUrl && !fileUrl)"
            class="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D0D4F7] hover:bg-[#B8BCF0] text-black text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md">
            <Icon v-if="isUploading" name="ic:baseline-sync" class="animate-spin text-base" />
            <Icon v-else name="ic:round-check" class="text-base" />
            <span>{{ isUploading ? 'Uploading...' : isEdit ? 'Update Poster' : 'Save Poster' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
