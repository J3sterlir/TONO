<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import type { PostItem } from '~/composables/useArtistPosts'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    post: PostItem | null
    artistName?: string
    artistAvatar?: string | null
    artistId?: string
  }>(),
  {
    artistName: 'Artist',
    artistAvatar: '',
    artistId: '',
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updated', post: PostItem): void
}>()

const { updatePost } = useArtistPosts()

// --- Media State ---
const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const newMediaPreviewUrl = ref<string | null>(null)
const existingMediaUrl = ref<string | null>(null)
const removedExistingImage = ref(false)
const isDragging = ref(false)
const errorMessage = ref<string | null>(null)

// Cropper interaction state (for replacement images)
type AspectRatioType = 'original' | '1:1' | '4:5' | '16:9'
const selectedRatio = ref<AspectRatioType>('original')
const zoom = ref(1.0)
const pan = ref({ x: 0, y: 0 })
const showGrid = ref(true)
const isPanning = ref(false)
const showAspectMenu = ref(false)
const showZoomSlider = ref(false)

// Dimensions for aspect ratio
const naturalWidth = ref(0)
const naturalHeight = ref(0)
const cropperContainerRef = ref<HTMLDivElement | null>(null)

let dragStartX = 0
let dragStartY = 0
let initialPanX = 0
let initialPanY = 0

// --- Caption & Location Details ---
const caption = ref('')
const location = ref('')
const maxCaptionLength = 2200
const isSubmitting = ref(false)

const cleanupNewMediaUrl = () => {
  if (newMediaPreviewUrl.value) {
    URL.revokeObjectURL(newMediaPreviewUrl.value)
    newMediaPreviewUrl.value = null
  }
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    processImageFile(file)
  }
  target.value = ''
}

const handleDrop = (e: DragEvent) => {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    processImageFile(file)
  }
}

const processImageFile = (file: File) => {
  errorMessage.value = null
  if (!file.type.startsWith('image/')) {
    errorMessage.value = 'Please select a valid image file (JPG, PNG, WEBP).'
    return
  }

  if (file.size > 15 * 1024 * 1024) {
    errorMessage.value = 'Image exceeds 15MB. Please choose a smaller image.'
    return
  }

  cleanupNewMediaUrl()
  selectedFile.value = file
  const objectUrl = URL.createObjectURL(file)
  newMediaPreviewUrl.value = objectUrl

  const img = new Image()
  img.onload = () => {
    naturalWidth.value = img.naturalWidth
    naturalHeight.value = img.naturalHeight
    selectedRatio.value = 'original'
    zoom.value = 1.0
    pan.value = { x: 0, y: 0 }
  }
  img.src = objectUrl
}

const revertNewImage = () => {
  cleanupNewMediaUrl()
  selectedFile.value = null
  selectedRatio.value = 'original'
  zoom.value = 1.0
  pan.value = { x: 0, y: 0 }
  showAspectMenu.value = false
  showZoomSlider.value = false
  errorMessage.value = null
}

const handleRemoveExistingImage = () => {
  removedExistingImage.value = true
  revertNewImage()
}

const handleUndoRemoveImage = () => {
  removedExistingImage.value = false
}

// Framing style for cropper
const apertureAspectClass = computed(() => {
  switch (selectedRatio.value) {
    case '1:1':
      return 'aspect-square h-full max-h-[460px] max-w-full'
    case '4:5':
      return 'aspect-4/5 h-full max-h-[480px] max-w-full'
    case '16:9':
      return 'aspect-video w-full max-w-full max-h-[92%]'
    case 'original':
    default:
      if (naturalWidth.value && naturalHeight.value) {
        if (naturalWidth.value >= naturalHeight.value) {
          return 'w-full max-w-full max-h-[92%]'
        } else {
          return 'h-full max-h-[480px] max-w-full'
        }
      }
      return 'aspect-square h-full max-h-[460px] max-w-full'
  }
})

const apertureCustomStyle = computed(() => {
  if (selectedRatio.value === 'original' && naturalWidth.value && naturalHeight.value) {
    return {
      aspectRatio: `${naturalWidth.value} / ${naturalHeight.value}`,
    }
  }
  return {}
})

// Drag to Pan Handlers
const startPan = (e: MouseEvent | TouchEvent) => {
  if (!newMediaPreviewUrl.value) return
  isPanning.value = true

  const clientX = 'touches' in e && e.touches[0] ? e.touches[0].clientX : ('clientX' in e ? e.clientX : 0)
  const clientY = 'touches' in e && e.touches[0] ? e.touches[0].clientY : ('clientY' in e ? e.clientY : 0)

  dragStartX = clientX
  dragStartY = clientY
  initialPanX = pan.value.x
  initialPanY = pan.value.y

  window.addEventListener('mousemove', onPanMove)
  window.addEventListener('mouseup', endPan)
  window.addEventListener('touchmove', onPanMove, { passive: false })
  window.addEventListener('touchend', endPan)
}

const onPanMove = (e: MouseEvent | TouchEvent) => {
  if (!isPanning.value) return
  const clientX = 'touches' in e && e.touches[0] ? e.touches[0].clientX : ('clientX' in e ? e.clientX : dragStartX)
  const clientY = 'touches' in e && e.touches[0] ? e.touches[0].clientY : ('clientY' in e ? e.clientY : dragStartY)

  const deltaX = clientX - dragStartX
  const deltaY = clientY - dragStartY

  const maxOffset = (zoom.value - 1) * 180 + 80
  pan.value = {
    x: Math.max(-maxOffset, Math.min(maxOffset, initialPanX + deltaX)),
    y: Math.max(-maxOffset, Math.min(maxOffset, initialPanY + deltaY)),
  }
}

const endPan = () => {
  isPanning.value = false
  window.removeEventListener('mousemove', onPanMove)
  window.removeEventListener('mouseup', endPan)
  window.removeEventListener('touchmove', onPanMove)
  window.removeEventListener('touchend', endPan)
}

const remainingChars = computed(() => maxCaptionLength - caption.value.length)

const hasActiveMedia = computed(() => {
  if (selectedFile.value) return true
  if (existingMediaUrl.value && !removedExistingImage.value) return true
  return false
})

const canSubmit = computed(() => {
  return (caption.value.trim().length > 0 || hasActiveMedia.value) && !isSubmitting.value
})

const hasChanges = computed(() => {
  if (!props.post) return false
  const origCaption = props.post.Caption || ''
  const origLocation = props.post.Location || ''
  const captionChanged = caption.value.trim() !== origCaption.trim()
  const locationChanged = location.value.trim() !== origLocation.trim()
  const mediaChanged = Boolean(selectedFile.value) || removedExistingImage.value
  return captionChanged || locationChanged || mediaChanged
})

const handleClose = () => {
  if (hasChanges.value) {
    if (confirm('Discard unsaved changes to this post?')) {
      emit('close')
    }
  } else {
    emit('close')
  }
}

const populateFromPost = () => {
  if (!props.post) return
  caption.value = props.post.Caption || ''
  location.value = props.post.Location || ''
  existingMediaUrl.value = props.post.Media || null
  removedExistingImage.value = false
  revertNewImage()
  errorMessage.value = null
  isSubmitting.value = false
}

const handleSubmit = async () => {
  if (!canSubmit.value || !props.post) return
  isSubmitting.value = true

  const result = await updatePost(props.post.POST_ID, {
    caption: caption.value.trim(),
    location: location.value.trim(),
    imageFile: selectedFile.value,
    removeExistingImage: removedExistingImage.value,
    aspectRatio: selectedRatio.value,
    cropData: {
      zoom: zoom.value,
      pan: { ...pan.value },
    },
  })

  if (result.success && result.post) {
    emit('updated', result.post)
    cleanupNewMediaUrl()
    emit('close')
  } else {
    errorMessage.value = result.error || 'Failed to update post. Please try again.'
  }
  isSubmitting.value = false
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    handleClose()
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (import.meta.client) {
      document.body.style.overflow = open ? 'hidden' : ''
      if (open) {
        populateFromPost()
        window.addEventListener('keydown', handleKeyDown)
      } else {
        window.removeEventListener('keydown', handleKeyDown)
        cleanupNewMediaUrl()
      }
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (import.meta.client) {
    document.body.style.overflow = ''
    window.removeEventListener('keydown', handleKeyDown)
  }
  cleanupNewMediaUrl()
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen && post"
        class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8"
      >
        <!-- A. Backdrop Overlay -->
        <div
          class="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
          @click="handleClose"
        />

        <!-- B. Centered Dual-Pane Modal Container -->
        <div
          class="relative z-10 flex flex-col md:flex-row w-full max-w-5xl h-[88vh] max-h-195 bg-[#18181B] border border-[#2A2A2E] rounded-2xl shadow-2xl overflow-hidden font-Sora text-white"
          @click.stop
        >
          <!-- ========================================== -->
          <!-- PANE 1: Media Preview / Cropper (Left)    -->
          <!-- ========================================== -->
          <div
            class="w-full md:w-[58%] lg:w-[62%] h-[48%] md:h-full bg-[#111113] relative flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-[#2A2A2E] overflow-hidden select-none"
            ref="cropperContainerRef"
          >
            <!-- Hidden File Input -->
            <input
              ref="fileInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              class="hidden"
              @change="handleFileSelect"
            />

            <!-- STATE 1: Interactive Cropper Viewport (When user picked a new photo) -->
            <div
              v-if="newMediaPreviewUrl"
              class="w-full h-full relative flex items-center justify-center bg-black/90 overflow-hidden"
            >
              <!-- Cropper Aperture Frame -->
              <div
                class="relative max-w-full max-h-full overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing border border-white/10 rounded-lg shadow-2xl"
                :class="apertureAspectClass"
                :style="apertureCustomStyle"
                @mousedown="startPan"
                @touchstart="startPan"
              >
                <!-- Rendered Image with Zoom & Pan Transform -->
                <img
                  :src="newMediaPreviewUrl"
                  alt="Crop preview"
                  class="w-full h-full object-cover pointer-events-none transition-transform duration-75 ease-out select-none"
                  :style="{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  }"
                  draggable="false"
                />

                <!-- Rule-of-Thirds Grid Overlay -->
                <div
                  v-if="showGrid"
                  class="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/20"
                >
                  <div class="border-r border-b border-white/20"></div>
                  <div class="border-r border-b border-white/20"></div>
                  <div class="border-b border-white/20"></div>
                  <div class="border-r border-b border-white/20"></div>
                  <div class="border-r border-b border-white/20"></div>
                  <div class="border-b border-white/20"></div>
                  <div class="border-r border-b border-white/20"></div>
                  <div class="border-r border-b border-white/20"></div>
                  <div></div>
                </div>
              </div>

              <!-- Top Left: Change / Revert Photo Button -->
              <div class="absolute top-4 left-4 z-20 flex items-center gap-2">
                <button
                  type="button"
                  @click="triggerFileInput"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-md text-gray-300 hover:text-white text-xs border border-white/10 transition-colors shadow-lg cursor-pointer"
                  title="Choose a different image"
                >
                  <Icon name="ic:round-refresh" class="text-sm" />
                  <span>Change</span>
                </button>

                <button
                  type="button"
                  @click="revertNewImage"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-md text-gray-300 hover:text-white text-xs border border-white/10 transition-colors shadow-lg cursor-pointer"
                  title="Revert to original photo"
                >
                  <Icon name="ic:round-undo" class="text-sm" />
                  <span>Revert</span>
                </button>

                <!-- Grid Toggle Button -->
                <button
                  type="button"
                  @click="showGrid = !showGrid"
                  class="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-md text-xs border border-white/10 transition-colors shadow-lg cursor-pointer"
                  :class="showGrid ? 'text-[#D0D4F7]' : 'text-gray-400 hover:text-white'"
                  title="Toggle Grid"
                >
                  <Icon name="ic:outline-grid-on" class="text-base" />
                </button>
              </div>

              <!-- Bottom Overlay Controls: Aspect Ratio & Zoom Toolbars -->
              <div class="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
                <!-- Left: Aspect Ratio Selector Popover -->
                <div class="relative pointer-events-auto">
                  <button
                    type="button"
                    @click="showAspectMenu = !showAspectMenu; showZoomSlider = false"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md text-xs font-medium border border-white/15 transition-colors shadow-lg cursor-pointer text-white"
                  >
                    <Icon name="ic:round-aspect-ratio" class="text-sm text-[#D0D4F7]" />
                    <span class="capitalize">{{ selectedRatio }}</span>
                    <Icon name="ic:round-arrow-drop-up" class="text-base text-gray-400" />
                  </button>

                  <!-- Aspect Ratio Dropdown Menu -->
                  <div
                    v-if="showAspectMenu"
                    class="absolute bottom-full mb-2 left-0 w-36 bg-[#1F1F24] border border-[#2A2A2E] rounded-xl p-1 shadow-2xl flex flex-col gap-0.5 text-xs font-Geist"
                  >
                    <button
                      type="button"
                      @click="selectedRatio = 'original'; showAspectMenu = false"
                      class="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left cursor-pointer"
                      :class="selectedRatio === 'original' ? 'text-[#D0D4F7] font-semibold' : 'text-gray-300'"
                    >
                      <span>Original</span>
                      <Icon v-if="selectedRatio === 'original'" name="ic:round-check" class="text-sm" />
                    </button>
                    <button
                      type="button"
                      @click="selectedRatio = '1:1'; showAspectMenu = false"
                      class="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left cursor-pointer"
                      :class="selectedRatio === '1:1' ? 'text-[#D0D4F7] font-semibold' : 'text-gray-300'"
                    >
                      <span>1:1 (Square)</span>
                      <Icon v-if="selectedRatio === '1:1'" name="ic:round-check" class="text-sm" />
                    </button>
                    <button
                      type="button"
                      @click="selectedRatio = '4:5'; showAspectMenu = false"
                      class="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left cursor-pointer"
                      :class="selectedRatio === '4:5' ? 'text-[#D0D4F7] font-semibold' : 'text-gray-300'"
                    >
                      <span>4:5 (Portrait)</span>
                      <Icon v-if="selectedRatio === '4:5'" name="ic:round-check" class="text-sm" />
                    </button>
                    <button
                      type="button"
                      @click="selectedRatio = '16:9'; showAspectMenu = false"
                      class="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left cursor-pointer"
                      :class="selectedRatio === '16:9' ? 'text-[#D0D4F7] font-semibold' : 'text-gray-300'"
                    >
                      <span>16:9 (Landscape)</span>
                      <Icon v-if="selectedRatio === '16:9'" name="ic:round-check" class="text-sm" />
                    </button>
                  </div>
                </div>

                <!-- Right: Zoom Slider Popover -->
                <div class="relative pointer-events-auto">
                  <button
                    type="button"
                    @click="showZoomSlider = !showZoomSlider; showAspectMenu = false"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md text-xs font-medium border border-white/15 transition-colors shadow-lg cursor-pointer text-white"
                  >
                    <Icon name="ic:round-zoom-in" class="text-base text-[#D0D4F7]" />
                    <span>{{ Math.round(zoom * 100) }}%</span>
                  </button>

                  <!-- Zoom Slider Popup -->
                  <div
                    v-if="showZoomSlider"
                    class="absolute bottom-full mb-2 right-0 w-44 bg-[#1F1F24] border border-[#2A2A2E] rounded-xl p-3 shadow-2xl flex items-center gap-2.5"
                  >
                    <button
                      type="button"
                      @click="zoom = Math.max(1.0, +(zoom - 0.2).toFixed(1))"
                      class="text-gray-400 hover:text-white"
                      title="Zoom Out"
                    >
                      <Icon name="ic:round-remove" class="text-sm" />
                    </button>
                    <input
                      type="range"
                      min="1.0"
                      max="3.0"
                      step="0.05"
                      v-model.number="zoom"
                      class="w-full accent-[#B4B8DA] cursor-pointer h-1.5 bg-[#2A2A30] rounded-lg appearance-none"
                    />
                    <button
                      type="button"
                      @click="zoom = Math.min(3.0, +(zoom + 0.2).toFixed(1))"
                      class="text-gray-400 hover:text-white"
                      title="Zoom In"
                    >
                      <Icon name="ic:round-add" class="text-sm" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- STATE 2: Existing Image Preview (From Post) -->
            <div
              v-else-if="existingMediaUrl && !removedExistingImage"
              class="w-full h-full relative flex items-center justify-center bg-black/90 p-4"
            >
              <img
                :src="existingMediaUrl"
                alt="Current Post Media"
                class="w-full h-full max-h-[85%] max-w-full object-contain rounded-lg border border-white/10 shadow-xl"
              />

              <!-- Action Bar over existing image -->
              <div class="absolute top-4 left-4 z-20 flex items-center gap-2">
                <button
                  type="button"
                  @click="triggerFileInput"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/70 hover:bg-black/90 backdrop-blur-md text-white text-xs border border-white/15 transition-colors shadow-lg cursor-pointer"
                  title="Replace photo"
                >
                  <Icon name="ic:round-add-photo-alternate" class="text-sm text-[#D0D4F7]" />
                  <span>Replace Photo</span>
                </button>

                <button
                  type="button"
                  @click="handleRemoveExistingImage"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-900/80 backdrop-blur-md text-red-300 hover:text-red-200 text-xs border border-red-500/30 transition-colors shadow-lg cursor-pointer"
                  title="Remove image to make post text-only"
                >
                  <Icon name="ic:round-delete-outline" class="text-sm" />
                  <span>Remove Photo</span>
                </button>
              </div>
            </div>

            <!-- STATE 3: Empty Dropzone (No Image or Removed Image) -->
            <div
              v-else
              class="w-full h-full flex flex-col items-center justify-center p-6 text-center transition-colors"
              :class="isDragging ? 'bg-[#D0D4F7]/10 border-2 border-dashed border-[#D0D4F7]' : 'hover:bg-white/2'"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="handleDrop"
            >
              <div
                class="w-20 h-20 rounded-full bg-[#1B1B1F] border border-[#2A2A2E] flex items-center justify-center mb-5 shadow-inner transition-transform group-hover:scale-105"
              >
                <Icon
                  name="ic:outline-photo-library"
                  class="text-4xl text-[#B4B8DA]"
                />
              </div>

              <h3 class="text-base sm:text-lg font-semibold text-white mb-1.5">
                {{ removedExistingImage ? 'Photo removed' : 'No photo attached' }}
              </h3>
              <p class="text-xs text-gray-400 max-w-xs mb-6 font-HankenGrotesk">
                {{
                  removedExistingImage
                    ? 'This post will become text-only upon saving, or you can add a new photo.'
                    : 'Optional: Photos only (JPG, PNG, WEBP). Leave empty for a text-only post!'
                }}
              </p>

              <!-- Upload & Undo Buttons -->
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  @click="triggerFileInput"
                  class="px-5 py-2.5 rounded-full bg-[#B4B8DA] hover:bg-white text-[#151A34] text-xs font-semibold tracking-wide transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center gap-2"
                >
                  <Icon name="ic:round-add-photo-alternate" class="text-base" />
                  <span>{{ removedExistingImage ? 'Choose new photo' : 'Select from computer' }}</span>
                </button>

                <button
                  v-if="removedExistingImage"
                  type="button"
                  @click="handleUndoRemoveImage"
                  class="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-200 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Icon name="ic:round-undo" class="text-sm" />
                  <span>Undo</span>
                </button>
              </div>

              <!-- Error Banner -->
              <div
                v-if="errorMessage"
                class="mt-4 px-4 py-2 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2"
              >
                <Icon name="ic:round-error-outline" class="text-sm shrink-0" />
                <span>{{ errorMessage }}</span>
              </div>
            </div>
          </div>

          <!-- ========================================== -->
          <!-- PANE 2: Caption & Post Details (Right)     -->
          <!-- ========================================== -->
          <div class="w-full md:w-[42%] lg:w-[38%] h-[52%] md:h-full flex flex-col bg-[#18181B] justify-between">
            <!-- Pane Header -->
            <div class="flex items-center justify-between px-5 py-3.5 border-b border-[#2A2A2E] shrink-0">
              <h2 class="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                <Icon name="ic:outline-edit" class="text-base text-[#D0D4F7]" />
                <span>Edit Post</span>
              </h2>
              <button
                type="button"
                @click="handleClose"
                class="flex text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                title="Close"
              >
                <Icon name="ic:round-close" class="text-xl" />
              </button>
            </div>

            <!-- Scrollable Middle Body -->
            <div class="flex-1 overflow-y-auto p-5 space-y-5">
              <!-- Artist Identity Row -->
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-full overflow-hidden bg-[#24242A] border border-[#2A2A2E] shrink-0 flex items-center justify-center"
                >
                  <img
                    v-if="artistAvatar"
                    :src="artistAvatar"
                    :alt="artistName"
                    class="w-full h-full object-cover"
                  />
                  <Icon
                    v-else
                    name="ic:baseline-person"
                    class="text-xl text-[#B4B8DA]"
                  />
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="text-sm font-semibold text-white truncate font-Sora">
                    {{ artistName }}
                  </span>
                  <span class="text-[11px] text-[#B4B8DA] font-HankenGrotesk">
                    Editing Post
                  </span>
                </div>
              </div>

              <!-- Caption Textarea -->
              <div class="flex flex-col gap-1.5">
                <textarea
                  v-model="caption"
                  :maxlength="maxCaptionLength"
                  placeholder="Write a caption, announce upcoming gigs, or tell a story..."
                  rows="5"
                  class="w-full bg-[#1F1F24]/70 border border-[#2A2A2E] rounded-xl p-3.5 text-xs sm:text-sm text-gray-200 placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7]/60 transition-colors resize-none leading-relaxed font-Geist"
                ></textarea>
                <!-- Character Counter -->
                <div class="flex justify-between items-center text-[11px] text-gray-400 font-Geist px-1">
                  <div class="flex items-center gap-1.5 text-gray-500">
                    <Icon name="ic:outline-info" class="text-xs" />
                    <span>Plain text or hashtags</span>
                  </div>
                  <span :class="remainingChars < 50 ? 'text-rose-400' : 'text-gray-400'">
                    {{ caption.length }} / {{ maxCaptionLength }}
                  </span>
                </div>
              </div>

              <!-- Post Extras: Location Input -->
              <div class="pt-2 border-t border-[#2A2A2E]">
                <div
                  class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#1F1F24]/70 border border-[#2A2A2E] focus-within:border-[#D0D4F7]/60 transition-colors"
                >
                  <Icon name="ic:outline-location-on" class="text-lg text-[#D0D4F7] shrink-0" />
                  <input
                    v-model="location"
                    type="text"
                    placeholder="Add location (optional)"
                    maxlength="100"
                    class="w-full bg-transparent text-xs text-gray-200 placeholder-gray-500 focus:outline-hidden font-Geist"
                  />
                  <button
                    v-if="location"
                    type="button"
                    @click="location = ''"
                    class="flex text-gray-500 hover:text-white cursor-pointer"
                    title="Clear location"
                  >
                    <Icon name="ic:round-close" class="text-sm" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Pane Footer Actions -->
            <div class="p-4 border-t border-[#2A2A2E] bg-[#161618] flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                @click="handleClose"
                class="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                @click="handleSubmit"
                :disabled="!canSubmit"
                class="px-6 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all shadow-md flex items-center gap-2"
                :class="
                  canSubmit
                    ? 'bg-[#B4B8DA] hover:bg-white text-[#151A34] cursor-pointer shadow-indigo-500/20'
                    : 'bg-white/10 text-gray-500 cursor-not-allowed'
                "
              >
                <Icon
                  v-if="isSubmitting"
                  name="ic:round-autorenew"
                  class="text-base animate-spin"
                />
                <span>{{ isSubmitting ? 'Saving...' : 'Save Changes' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
