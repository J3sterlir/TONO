<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { loadImage, optimizeAvatar, optimizeCover, type CropArea } from '~/utils/imageOptimizer'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    imageSource: string | File | Blob | null
    mode?: 'avatar' | 'cover'
    title?: string
  }>(),
  {
    mode: 'avatar',
    title: undefined,
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'apply', blob: Blob): void
}>()

// DOM & State Refs
const apertureRef = ref<HTMLDivElement | null>(null)
const imageEl = ref<HTMLImageElement | null>(null)
const previewUrl = ref<string | null>(null)
const isLoaded = ref(false)
const isApplying = ref(false)
const errorMessage = ref<string | null>(null)

let activeObjectUrl: string | null = null

const cleanupObjectUrl = () => {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl)
    activeObjectUrl = null
  }
}

// Natural Image Dimensions
const naturalWidth = ref(0)
const naturalHeight = ref(0)

// Target aspect ratio (3:1 for cover, 1:1 for avatar)
const targetAspectRatio = computed(() => (props.mode === 'cover' ? 3 : 1))

// Aperture frame measured in CSS pixels
const frameWidth = ref(props.mode === 'cover' ? 540 : 300)
const frameHeight = ref(props.mode === 'cover' ? 180 : 300)

// Pan & Zoom
const pan = ref({ x: 0, y: 0 })
const zoom = ref(1.0)
const isDragging = ref(false)

// Drag Tracking
let dragStartX = 0
let dragStartY = 0
let initialPanX = 0
let initialPanY = 0

// Pinch Zoom Tracking
let initialPinchDistance = 0
let initialPinchZoom = 1.0

// Base scale to ensure the image covers the frame at zoom = 1.0
const baseScale = computed(() => {
  if (!naturalWidth.value || !naturalHeight.value || !frameWidth.value || !frameHeight.value) {
    return 1
  }
  return Math.max(
    frameWidth.value / naturalWidth.value,
    frameHeight.value / naturalHeight.value
  )
})

// Current rendered image dimensions
const renderedDimensions = computed(() => {
  const currentScale = baseScale.value * zoom.value
  return {
    width: naturalWidth.value * currentScale,
    height: naturalHeight.value * currentScale,
  }
})

// Maximum pan bounds to keep the image covering the aperture
const maxPan = computed(() => {
  const { width, height } = renderedDimensions.value
  return {
    x: Math.max(0, (width - frameWidth.value) / 2),
    y: Math.max(0, (height - frameHeight.value) / 2),
  }
})

// Ensure pan stays strictly within coverage bounds
const clampPan = () => {
  const { x: maxX, y: maxY } = maxPan.value
  pan.value = {
    x: Math.max(-maxX, Math.min(maxX, pan.value.x)),
    y: Math.max(-maxY, Math.min(maxY, pan.value.y)),
  }
}

// Watch zoom changes to keep pan clamped
watch(zoom, () => {
  clampPan()
})

// Update measured aperture size based on responsive layout
const updateFrameDimensions = () => {
  if (!apertureRef.value) return
  const rect = apertureRef.value.getBoundingClientRect()
  if (rect.width > 0) {
    frameWidth.value = rect.width
    // Strictly calculate height from width using target aspect ratio
    frameHeight.value = rect.width / targetAspectRatio.value
    clampPan()
  }
}

// Load source image whenever imageSource changes or modal opens
const loadSourceImage = async () => {
  cleanupObjectUrl()

  if (!props.isOpen || !props.imageSource) {
    isLoaded.value = false
    previewUrl.value = null
    imageEl.value = null
    return
  }

  isLoaded.value = false
  errorMessage.value = null
  pan.value = { x: 0, y: 0 }
  zoom.value = 1.0

  try {
    let srcUrl: string
    if (typeof props.imageSource === 'string') {
      srcUrl = props.imageSource
      // Append cache buster to remote HTTP/HTTPS image to prevent non-CORS cached responses
      if (srcUrl.startsWith('http://') || srcUrl.startsWith('https://')) {
        const delimiter = srcUrl.includes('?') ? '&' : '?'
        srcUrl = `${srcUrl}${delimiter}_cors=${Date.now()}`
      }
    } else {
      activeObjectUrl = URL.createObjectURL(props.imageSource)
      srcUrl = activeObjectUrl
    }

    previewUrl.value = srcUrl
    const img = await loadImage(srcUrl)
    imageEl.value = img
    naturalWidth.value = img.naturalWidth
    naturalHeight.value = img.naturalHeight

    // Mark as loaded before measuring so aperture is visible in DOM
    isLoaded.value = true
    await nextTick()
    updateFrameDimensions()
  } catch (err: any) {
    console.error('Failed to load image into cropper:', err)
    errorMessage.value = 'Failed to load image. Please check file format or permissions.'
  }
}

watch(
  () => [props.isOpen, props.imageSource],
  () => {
    if (props.isOpen) {
      loadSourceImage()
    } else {
      cleanupObjectUrl()
      previewUrl.value = null
      imageEl.value = null
      isLoaded.value = false
    }
  },
  { immediate: true }
)

// Mouse drag handlers
const onMouseDown = (e: MouseEvent) => {
  if (!isLoaded.value) return
  e.preventDefault()
  isDragging.value = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  initialPanX = pan.value.x
  initialPanY = pan.value.y

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

const onMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return
  const deltaX = e.clientX - dragStartX
  const deltaY = e.clientY - dragStartY

  pan.value = {
    x: initialPanX + deltaX,
    y: initialPanY + deltaY,
  }
  clampPan()
}

const onMouseUp = () => {
  if (isDragging.value) {
    isDragging.value = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }
}

// Mouse wheel zoom handler
const onWheel = (e: WheelEvent) => {
  if (!isLoaded.value) return
  e.preventDefault()
  const zoomFactor = -e.deltaY * 0.0012
  const nextZoom = Math.max(1.0, Math.min(3.0, zoom.value + zoomFactor))
  zoom.value = Math.round(nextZoom * 100) / 100
}

// Touch drag & pinch zoom handlers (Mobile)
const onTouchStart = (e: TouchEvent) => {
  if (!isLoaded.value) return

  if (e.touches.length === 1) {
    const touch = e.touches[0]
    if (!touch) return
    isDragging.value = true
    dragStartX = touch.clientX
    dragStartY = touch.clientY
    initialPanX = pan.value.x
    initialPanY = pan.value.y
  } else if (e.touches.length === 2) {
    const t1 = e.touches[0]
    const t2 = e.touches[1]
    if (!t1 || !t2) return
    isDragging.value = false
    initialPinchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
    initialPinchZoom = zoom.value
  }
}

const onTouchMove = (e: TouchEvent) => {
  if (!isLoaded.value) return
  e.preventDefault() // Crucial: prevents mobile pull-to-refresh & screen scrolling

  if (e.touches.length === 1 && isDragging.value) {
    const touch = e.touches[0]
    if (!touch) return
    const deltaX = touch.clientX - dragStartX
    const deltaY = touch.clientY - dragStartY

    pan.value = {
      x: initialPanX + deltaX,
      y: initialPanY + deltaY,
    }
    clampPan()
  } else if (e.touches.length === 2 && initialPinchDistance > 0) {
    const t1 = e.touches[0]
    const t2 = e.touches[1]
    if (!t1 || !t2) return
    const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
    const scaleMultiplier = currentDist / initialPinchDistance
    const nextZoom = Math.max(1.0, Math.min(3.0, initialPinchZoom * scaleMultiplier))
    zoom.value = Math.round(nextZoom * 100) / 100
  }
}

const onTouchEnd = (e: TouchEvent) => {
  if (e.touches.length === 0) {
    isDragging.value = false
    initialPinchDistance = 0
  } else if (e.touches.length === 1) {
    // Transitioned from pinch to 1 finger
    const touch = e.touches[0]
    if (!touch) return
    isDragging.value = true
    dragStartX = touch.clientX
    dragStartY = touch.clientY
    initialPanX = pan.value.x
    initialPanY = pan.value.y
    initialPinchDistance = 0
  }
}

// Reset framing
const resetFraming = () => {
  pan.value = { x: 0, y: 0 }
  zoom.value = 1.0
}

// Zoom helpers for slider buttons
const zoomIn = () => {
  zoom.value = Math.min(3.0, Math.round((zoom.value + 0.15) * 100) / 100)
}

const zoomOut = () => {
  zoom.value = Math.max(1.0, Math.round((zoom.value - 0.15) * 100) / 100)
}

// Keyboard handling
const onKeyDown = (e: KeyboardEvent) => {
  if (!props.isOpen) return
  if (e.key === 'Escape') {
    handleClose()
  } else if (e.key === 'Enter' && !isApplying.value && isLoaded.value) {
    applyCrop()
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && apertureRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateFrameDimensions()
    })
    resizeObserver.observe(apertureRef.value)
  }
  window.addEventListener('resize', updateFrameDimensions)
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  cleanupObjectUrl()
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  window.removeEventListener('resize', updateFrameDimensions)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

const handleClose = () => {
  if (isApplying.value) return
  cleanupObjectUrl()
  emit('close')
}

// Crop & Export
const applyCrop = async () => {
  if (!imageEl.value || !isLoaded.value || isApplying.value) return

  isApplying.value = true
  errorMessage.value = null

  try {
    const totalScale = baseScale.value * zoom.value
    const aspect = targetAspectRatio.value

    // Strictly enforce the target aspect ratio for the crop rectangle
    const cropWidth = frameWidth.value / totalScale
    const cropHeight = cropWidth / aspect

    // Map screen pan offset back to natural image coordinates
    const cropX = naturalWidth.value / 2 - pan.value.x / totalScale - cropWidth / 2
    const cropY = naturalHeight.value / 2 - pan.value.y / totalScale - cropHeight / 2

    const cropArea: CropArea = {
      x: cropX,
      y: cropY,
      width: cropWidth,
      height: cropHeight,
    }

    let resultBlob: Blob
    if (props.mode === 'cover') {
      resultBlob = await optimizeCover(imageEl.value, cropArea, 1920, 640, 0.84)
    } else {
      resultBlob = await optimizeAvatar(imageEl.value, cropArea, 500, 0.84)
    }

    cleanupObjectUrl()
    emit('apply', resultBlob)
  } catch (err: any) {
    console.error('Error applying crop:', err)
    errorMessage.value = err.message || 'Failed to crop and optimize image.'
  } finally {
    isApplying.value = false
  }
}

const modalTitle = computed(() => {
  if (props.title) return props.title
  return props.mode === 'cover' ? 'Customize Cover Banner' : 'Customize Profile Picture'
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden bg-black/85 backdrop-blur-md transition-opacity">
      <!-- Modal Container -->
      <div
        class="relative w-full max-w-2xl bg-[#131315] border border-[#46464D]/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white animate-in fade-in zoom-in-95 duration-200">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#46464D]/40 shrink-0">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-full bg-[#1E1E24] flex items-center justify-center border border-[#46464D]/50 shrink-0">
              <Icon
                :name="mode === 'cover' ? 'ic:outline-photo-size-select-actual' : 'ic:outline-account-circle'"
                class="text-lg text-[#D0D4F7]" />
            </div>
            <div class="truncate">
              <h2 class="font-Sora font-semibold text-base sm:text-lg text-white truncate">
                {{ modalTitle }}
              </h2>
              <span class="text-xs text-gray-400 font-Geist">
                {{ mode === 'cover' ? 'Aspect Ratio 3:1 • Wide Banner' : 'Aspect Ratio 1:1 • Center Avatar' }}
              </span>
            </div>
          </div>

          <button
            @click="handleClose"
            :disabled="isApplying"
            class="flex p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
            title="Close">
            <Icon name="ic:round-close" class="text-xl" />
          </button>
        </div>

        <!-- Error Banner -->
        <div
          v-if="errorMessage"
          class="mx-4 sm:mx-6 mt-4 px-3.5 py-2 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs sm:text-sm flex items-center gap-2">
          <Icon name="ic:outline-info" class="text-lg shrink-0 text-red-400" />
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Cropper Viewport Area -->
        <div
          class="relative flex-1 min-h-64 sm:min-h-80 max-h-[55vh] bg-[#0E0E10] flex items-center justify-center p-4 sm:p-6 overflow-hidden select-none">
          <!-- Loading State -->
          <div v-if="!isLoaded && !errorMessage" class="flex flex-col items-center gap-3 text-gray-400">
            <Icon name="ic:baseline-sync" class="text-3xl text-[#D0D4F7] animate-spin" />
            <span class="text-xs font-medium">Preparing image for preview...</span>
          </div>

          <!-- Interactive Viewport -->
          <div
            v-show="isLoaded"
            ref="apertureRef"
            @mousedown="onMouseDown"
            @wheel="onWheel"
            @touchstart="onTouchStart"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
            @touchcancel="onTouchEnd"
            class="relative overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none shadow-2xl transition-all"
            :class="[
              mode === 'avatar'
                ? 'w-64 h-64 sm:w-72 sm:h-72 rounded-full border-2 border-[#D0D4F7]/80'
                : 'w-full max-w-xl rounded-xl border-2 border-[#D0D4F7]/80'
            ]"
            :style="{ aspectRatio: mode === 'cover' ? '3 / 1' : '1 / 1' }">
            <!-- Rendered Image -->
            <div
              v-if="previewUrl"
              class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <img
                :src="previewUrl"
                alt="Crop preview"
                class="max-w-none origin-center pointer-events-none transition-none"
                :style="{
                  width: `${naturalWidth * baseScale}px`,
                  height: `${naturalHeight * baseScale}px`,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }" />
            </div>

            <!-- Rule-of-Thirds Grid Overlay (faint guide while framing) -->
            <div
              class="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 transition-opacity duration-200"
              :class="isDragging ? 'opacity-40' : 'opacity-15'">
              <div class="border-r border-b border-white/60"></div>
              <div class="border-r border-b border-white/60"></div>
              <div class="border-b border-white/60"></div>
              <div class="border-r border-b border-white/60"></div>
              <div class="border-r border-b border-white/60"></div>
              <div class="border-b border-white/60"></div>
              <div class="border-r border-white/60"></div>
              <div class="border-r border-white/60"></div>
              <div></div>
            </div>

            <!-- Subtle framing center crosshair -->
            <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div class="w-2 h-2 rounded-full bg-[#D0D4F7]/50"></div>
            </div>
          </div>

          <!-- Floating Help Hint -->
          <div
            v-if="isLoaded"
            class="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/10 text-[11px] text-gray-300 pointer-events-none flex items-center gap-1.5 shadow-md">
            <Icon name="ic:outline-touch-app" class="text-sm text-[#D0D4F7]" />
            <span>Drag to move • Pinch or scroll to zoom</span>
          </div>
        </div>

        <!-- Controls Toolbar -->
        <div class="px-4 sm:px-6 py-3 bg-[#18181D] border-t border-[#46464D]/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <!-- Zoom Controls -->
          <div class="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              @click="zoomOut"
              :disabled="zoom <= 1.0 || !isLoaded"
              class="flex p-1.5 rounded-lg bg-[#23232A] hover:bg-[#2C2C36] text-gray-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              title="Zoom out">
              <Icon name="ic:round-zoom-out" class="text-base" />
            </button>

            <!-- Custom Slider -->
            <div class="flex-1 sm:w-44 flex items-center">
              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.01"
                v-model.number="zoom"
                :disabled="!isLoaded"
                class="w-full accent-[#D0D4F7] h-1.5 bg-[#2A2A33] rounded-lg cursor-pointer disabled:opacity-40" />
            </div>

            <button
              @click="zoomIn"
              :disabled="zoom >= 3.0 || !isLoaded"
              class="flex p-1.5 rounded-lg bg-[#23232A] hover:bg-[#2C2C36] text-gray-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              title="Zoom in">
              <Icon name="ic:round-zoom-in" class="text-base" />
            </button>

            <span class="text-xs text-gray-400 font-mono w-10 text-right shrink-0">
              {{ Math.round(zoom * 100) }}%
            </span>
          </div>

          <!-- Reset Button -->
          <button
            @click="resetFraming"
            :disabled="!isLoaded || (zoom === 1.0 && pan.x === 0 && pan.y === 0)"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#23232A] hover:bg-[#2C2C36] text-xs text-gray-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
            <Icon name="ic:round-refresh" class="text-sm" />
            <span>Reset Position</span>
          </button>
        </div>

        <!-- Modal Footer Actions -->
        <div class="px-4 sm:px-6 py-3.5 bg-[#131315] border-t border-[#46464D]/40 flex items-center justify-end gap-3 shrink-0">
          <button
            @click="handleClose"
            :disabled="isApplying"
            class="px-4 py-2 rounded-xl bg-transparent hover:bg-white/5 border border-[#46464D]/70 text-xs sm:text-sm font-medium text-gray-300 hover:text-white transition-all cursor-pointer disabled:opacity-50">
            Cancel
          </button>

          <button
            @click="applyCrop"
            :disabled="!isLoaded || isApplying"
            class="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D0D4F7] hover:bg-[#B8BCF0] text-black text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-lg hover:shadow-[#D0D4F7]/20 disabled:opacity-50 disabled:cursor-not-allowed">
            <Icon
              v-if="isApplying"
              name="ic:baseline-sync"
              class="text-base animate-spin text-black" />
            <Icon
              v-else
              name="ic:round-check"
              class="text-base text-black" />
            <span>{{ isApplying ? 'Saving Image...' : 'Apply & Save' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
