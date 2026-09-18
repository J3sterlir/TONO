<script setup lang="ts">
import { ref, watch } from 'vue'
import { validateImageFile } from '~/utils/imageOptimizer'
import { getMilestoneInitials } from '~/utils/milestoneHelper'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    initialTitle?: string
    initialEventDate?: string
    initialDescription?: string
    initialFileUrl?: string
    isEdit?: boolean
    uploadFn: (file: File | Blob, subfolder: 'milestones' | 'posters') => Promise<string>
  }>(),
  {
    initialTitle: '',
    initialEventDate: '',
    initialDescription: '',
    initialFileUrl: '',
    isEdit: false,
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { fileUrl: string; title: string; eventDate: string; description: string }): void
}>()

const title = ref('')
const eventDate = ref('')
const description = ref('')
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
      eventDate.value = props.initialEventDate || ''
      description.value = props.initialDescription || ''
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

  const validation = validateImageFile(file, 10)
  if (!validation.valid) {
    errorMessage.value = validation.error || 'Invalid image file.'
    return
  }

  errorMessage.value = null
  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
}

const clearPhoto = () => {
  selectedFile.value = null
  previewUrl.value = ''
  fileUrl.value = ''
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

const handleSave = async () => {
  if (!title.value.trim()) {
    errorMessage.value = 'Please enter a milestone or winning title.'
    return
  }

  isUploading.value = true
  errorMessage.value = null

  try {
    let finalUrl = fileUrl.value || ''

    if (selectedFile.value) {
      finalUrl = await props.uploadFn(selectedFile.value, 'milestones')
    }

    emit('save', {
      fileUrl: finalUrl,
      title: title.value.trim(),
      eventDate: eventDate.value.trim(),
      description: description.value.trim(),
    })
    emit('close')
  } catch (err: any) {
    console.error('Milestone upload error:', err)
    errorMessage.value = err.message || 'Failed to upload milestone photo.'
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
              <Icon name="ic:outline-emoji-events" class="text-xl text-[#D0D4F7]" />
            </div>
            <div>
              <h2 class="font-Sora font-semibold text-base sm:text-lg text-white">
                {{ isEdit ? 'Edit Milestone' : 'Add Milestone & Achievement' }}
              </h2>
              <span class="text-xs text-gray-400 font-Geist">
                Trophies, Wins, Competitions, or Milestones
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

          <!-- Circular Photo Picker / Initials Preview -->
          <div class="flex flex-col items-center justify-center gap-2.5 py-2">
            <div
              @click="fileInputRef?.click()"
              class="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-linear-to-br from-[#26262E] to-[#151518] border-2 border-dashed border-[#D0D4F7]/60 hover:border-[#D0D4F7] cursor-pointer group flex items-center justify-center transition-all shadow-xl">
              <!-- Selected or existing image -->
              <img
                v-if="previewUrl"
                :src="previewUrl"
                alt="Milestone Preview"
                class="w-full h-full object-cover group-hover:opacity-75 transition-opacity" />

              <!-- Initials placeholder or upload prompt -->
              <div
                v-else
                class="flex flex-col items-center justify-center text-center p-3 text-[#D0D4F7] group-hover:scale-105 transition-transform select-none">
                <span v-if="title.trim()" class="font-Sora font-bold text-2xl sm:text-3xl text-white tracking-wider">
                  {{ getMilestoneInitials(title) }}
                </span>
                <Icon v-else name="ic:outline-add-photo-alternate" class="text-3xl text-gray-400 group-hover:text-[#D0D4F7] transition-colors mb-1" />
                <span class="text-[10px] sm:text-[11px] text-gray-400 group-hover:text-[#D0D4F7] font-medium transition-colors mt-0.5">
                  {{ title.trim() ? 'Add Photo' : 'Upload Photo' }}
                </span>
              </div>

              <!-- Hover overlay when photo is set -->
              <div
                v-if="previewUrl"
                class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-semibold text-white">
                Change Photo
              </div>
            </div>

            <!-- Remove Photo Button (to revert back to initials badge) -->
            <button
              v-if="previewUrl"
              type="button"
              @click="clearPhoto"
              class="text-xs text-red-400 hover:text-red-300 hover:underline flex items-center gap-1 cursor-pointer transition-colors">
              <Icon name="ic:round-close" class="text-sm" />
              <span>Remove photo (use initials badge)</span>
            </button>

            <input
              ref="fileInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="hidden"
              @change="handleFileSelect" />

            <span class="text-[11px] text-gray-400 text-center">
              Photo is optional
            </span>
          </div>

          <!-- Title Input -->
          <div>
            <label class="block text-xs sm:text-sm font-semibold text-gray-200 mb-1.5 font-Sora">
              Achievement / Winning Title <span class="text-[#D0D4F7]">*</span>
            </label>
            <input
              type="text"
              v-model="title"
              maxlength="80"
              placeholder="e.g. Winner: Battle of the Bands 2025"
              class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all" />
          </div>

          <!-- Date / Year Input -->
          <div>
            <label class="block text-xs sm:text-sm font-semibold text-gray-200 mb-1.5 font-Sora">
              Year / Date <span class="text-gray-400 font-normal text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              v-model="eventDate"
              maxlength="30"
              placeholder="e.g. August 2025 or 2024"
              class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all" />
          </div>

          <!-- Optional Description -->
          <div>
            <label class="block text-xs sm:text-sm font-semibold text-gray-200 mb-1.5 font-Sora">
              Details / Organizer <span class="text-gray-400 font-normal text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              v-model="description"
              maxlength="120"
              placeholder="e.g. Rock Manila Grand Finals • Ranked #1 out of 50 bands"
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
            :disabled="isUploading || !title.trim()"
            class="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D0D4F7] hover:bg-[#B8BCF0] text-black text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md">
            <Icon v-if="isUploading" name="ic:baseline-sync" class="animate-spin text-base" />
            <Icon v-else name="ic:round-check" class="text-base" />
            <span>{{ isUploading ? 'Uploading...' : isEdit ? 'Update Milestone' : 'Add Milestone' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
