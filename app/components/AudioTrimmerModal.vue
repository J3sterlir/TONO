<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import {
  decodeAudioFile,
  generateWaveformData,
  sliceAudioBuffer,
  compressAndExportAudio
} from '~/utils/audioTrimmer'
import { useTonoSongs } from '~/composables/useTonoSongs'

const props = defineProps<{
  isOpen: boolean
  artistId: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'uploaded', song: any): void
}>()

const { uploadArtistSong } = useTonoSongs()

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const isDecoding = ref(false)
const isExporting = ref(false)
const errorMessage = ref('')

const audioBuffer = ref<AudioBuffer | null>(null)
const waveform = ref<number[]>([])
const fileDuration = ref(0)

// Trimmer range (in seconds)
const startTime = ref(0)
const trimDuration = ref(60)

// Metadata inputs
const songTitle = ref('')
const songGenre = ref('')
const songDescription = ref('')

// Waveform preview playback
const isPreviewPlaying = ref(false)
let previewAudioCtx: AudioContext | null = null
let previewSourceNode: AudioBufferSourceNode | null = null

const isDraggingOver = ref(false)

const resetAudioFile = () => {
  stopPreview()
  selectedFile.value = null
  audioBuffer.value = null
  waveform.value = []
  fileDuration.value = 0
  startTime.value = 0
  trimDuration.value = 60
}

const resetForm = () => {
  resetAudioFile()
  songTitle.value = ''
  songGenre.value = ''
  songDescription.value = ''
  errorMessage.value = ''
  isDecoding.value = false
  isExporting.value = false
  isDraggingOver.value = false
}

watch(
  () => props.isOpen,
  (open) => {
    if (!open) {
      resetForm()
    }
  }
)

const processAudioFile = async (file: File) => {
  if (!file) return

  const validAudioExtensions = ['.flac', '.mp3', '.wav', '.webm', '.aac', '.m4a', '.ogg']
  const fileExt = '.' + (file.name.split('.').pop() || '').toLowerCase()
  const isAudioType = file.type.startsWith('audio/') || validAudioExtensions.includes(fileExt)

  if (!isAudioType) {
    errorMessage.value = 'Please select a valid audio file (FLAC, MP3, WAV, WebM, AAC).'
    return
  }

  errorMessage.value = ''
  selectedFile.value = file
  songTitle.value = file.name.replace(/\.[^/.]+$/, '')

  isDecoding.value = true
  try {
    const decoded = await decodeAudioFile(file)
    audioBuffer.value = decoded
    fileDuration.value = decoded.duration
    waveform.value = generateWaveformData(decoded, 120)

    // Default slice to 60s max
    startTime.value = 0
    trimDuration.value = Math.min(60, Math.floor(decoded.duration))
  } catch (err: any) {
    console.error('[AudioTrimmer] Error decoding audio:', err)
    errorMessage.value = 'Failed to decode audio file. Please try another audio file.'
    selectedFile.value = null
  } finally {
    isDecoding.value = false
  }
}

const handleFileSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    await processAudioFile(file)
  }
  target.value = ''
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  if (!isDecoding.value) {
    isDraggingOver.value = true
  }
}

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  const currentTarget = e.currentTarget as HTMLElement
  const relatedTarget = e.relatedTarget as HTMLElement
  if (!currentTarget || !relatedTarget || !currentTarget.contains(relatedTarget)) {
    isDraggingOver.value = false
  }
}

const handleDrop = async (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isDraggingOver.value = false

  if (isDecoding.value) return

  const file = e.dataTransfer?.files?.[0]
  if (file) {
    await processAudioFile(file)
  }
}

const togglePreview = () => {
  if (isPreviewPlaying.value) {
    stopPreview()
  } else {
    startPreview()
  }
}

const startPreview = () => {
  if (!audioBuffer.value) return
  stopPreview()

  try {
    previewAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const sliced = sliceAudioBuffer(audioBuffer.value, startTime.value, trimDuration.value)

    previewSourceNode = previewAudioCtx.createBufferSource()
    previewSourceNode.buffer = sliced
    previewSourceNode.connect(previewAudioCtx.destination)

    previewSourceNode.onended = () => {
      isPreviewPlaying.value = false
    }

    previewSourceNode.start()
    isPreviewPlaying.value = true
  } catch (err) {
    console.warn('[AudioTrimmer] Preview failed:', err)
    stopPreview()
  }
}

const stopPreview = () => {
  if (previewSourceNode) {
    try {
      previewSourceNode.stop()
      previewSourceNode.disconnect()
    } catch {}
    previewSourceNode = null
  }
  if (previewAudioCtx && previewAudioCtx.state !== 'closed') {
    previewAudioCtx.close().catch(() => {})
    previewAudioCtx = null
  }
  isPreviewPlaying.value = false
}

onUnmounted(() => {
  stopPreview()
})

const handleStartChange = (e: Event) => {
  const val = Number((e.target as HTMLInputElement).value)
  startTime.value = Math.max(0, Math.min(val, Math.max(0, fileDuration.value - 5)))
  // Keep duration capped at 60s or remainder
  const maxPossibleDuration = Math.min(60, fileDuration.value - startTime.value)
  if (trimDuration.value > maxPossibleDuration) {
    trimDuration.value = Math.max(5, maxPossibleDuration)
  }
  if (isPreviewPlaying.value) startPreview()
}

const handleDurationChange = (e: Event) => {
  const val = Number((e.target as HTMLInputElement).value)
  const maxPossible = Math.min(60, fileDuration.value - startTime.value)
  trimDuration.value = Math.max(5, Math.min(val, maxPossible))
  if (isPreviewPlaying.value) startPreview()
}

const formatSeconds = (sec: number) => {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const handleTrimAndUpload = async () => {
  if (!audioBuffer.value || !songTitle.value.trim()) {
    errorMessage.value = 'Please provide a track title.'
    return
  }

  isExporting.value = true
  errorMessage.value = ''
  stopPreview()

  try {
    // 1. Slice audio buffer
    const sliced = sliceAudioBuffer(audioBuffer.value, startTime.value, trimDuration.value)

    // 2. Client-side audio export (192kbps MP3 conversion & 44.1kHz resampling)
    const { blob, duration, format, sizeFormatted } = await compressAndExportAudio(sliced)
    console.log(`[AudioTrimmer] Exported ${duration.toFixed(1)}s as ${format.toUpperCase()} (${sizeFormatted})`)

    // 3. Upload to Supabase bucket and insert into SONG table
    const createdSong = await uploadArtistSong({
      artistId: props.artistId,
      title: songTitle.value.trim(),
      description: songDescription.value.trim(),
      genre: songGenre.value.trim(),
      audioBlob: blob,
      durationSeconds: duration
    })

    emit('uploaded', createdSong)
    emit('close')
  } catch (err: any) {
    console.error('[AudioTrimmer] Upload error:', err)
    errorMessage.value = err?.message || 'Upload failed. Please try again.'
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
      @click.self="emit('close')"
    >
      <div
        class="bg-[#131315] border border-[#46464D]/40 rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-2xl flex flex-col gap-6 text-white my-8"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between pb-3 border-b border-[#2A2A2E]">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-[#D0D4F7]/10 text-[#D0D4F7] flex items-center justify-center">
              <Icon name="mdi:music" class="text-xl" />
            </div>
            <div>
              <h2 class="font-Sora text-lg font-semibold text-white">Upload Track</h2>
            </div>
          </div>
          <button
            @click="emit('close')"
            class="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <Icon name="ic:round-close" class="text-2xl" />
          </button>
        </div>

        <!-- Error Alert -->
        <div
          v-if="errorMessage"
          class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2"
        >
          <Icon name="ic:baseline-warning" class="text-base shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>

        <!-- 1. File Picker & Drag-and-Drop Zone (when no file selected) -->
        <div
          v-if="!audioBuffer"
          @click="fileInputRef?.click()"
          @dragover="handleDragOver"
          @dragenter="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
          :class="[
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 select-none',
            isDraggingOver
              ? 'border-[#D0D4F7] bg-[#D0D4F7]/15 scale-[1.01] shadow-lg shadow-[#D0D4F7]/10'
              : 'border-[#46464D]/60 hover:border-[#D0D4F7] bg-[#18181B]/50 hover:bg-[#18181B]'
          ]"
        >
          <input
            ref="fileInputRef"
            type="file"
            accept="audio/*,.flac,.mp3,.wav,.webm,.aac,.m4a,.ogg"
            class="hidden"
            @change="handleFileSelect"
          />

          <div
            :class="[
              'w-12 h-12 rounded-full flex items-center justify-center transition-all pointer-events-none',
              isDraggingOver
                ? 'bg-[#D0D4F7] text-[#0E0E10] scale-110 shadow-md'
                : 'bg-[#D0D4F7]/10 text-[#D0D4F7]'
            ]"
          >
            <Icon :name="isDraggingOver ? 'ic:round-download' : 'ic:round-cloud-upload'" class="text-2xl" />
          </div>

          <div class="pointer-events-none">
            <p class="font-medium text-sm text-gray-200">
              {{ isDecoding ? 'Decoding audio file...' : isDraggingOver ? 'Drop your audio track to upload' : 'Click or drop your audio track here' }}
            </p>
            <p class="text-xs text-gray-400 mt-1">Supports FLAC, MP3, WAV, WebM, AAC (Auto-compressed to 192kbps MP3)</p>
          </div>

          <div v-if="isDecoding" class="flex items-center gap-2 text-xs text-[#D0D4F7] pointer-events-none">
            <Icon name="ic:baseline-refresh" class="animate-spin text-base" />
            <span>Processing waveform & spectrum...</span>
          </div>
        </div>

        <!-- 2. Interactive Waveform Trimmer (when file loaded) -->
        <div v-else class="flex flex-col gap-5">
          <!-- Waveform Canvas Display -->
          <div class="bg-[#18181B] border border-[#2A2A2E] rounded-xl p-4 flex flex-col gap-3">
            <div class="flex items-center justify-between text-xs text-gray-400">
              <div class="flex items-center gap-2 truncate max-w-70">
                <Icon name="mdi:music" class="text-sm text-[#D0D4F7] shrink-0" />
                <span class="truncate text-gray-200 font-medium">{{ selectedFile?.name }}</span>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <span>Total: {{ formatSeconds(fileDuration) }}</span>
                <button
                  type="button"
                  @click="resetAudioFile"
                  class="text-xs text-[#D0D4F7] hover:underline flex items-center gap-1 transition-colors"
                >
                  <Icon name="ic:round-swap-horiz" class="text-sm" />
                  <span>Change</span>
                </button>
              </div>
            </div>

            <!-- Waveform Bars -->
            <div class="h-20 w-full flex items-end gap-0.5 bg-black/40 rounded-lg p-2 overflow-hidden relative">
              <div
                v-for="(peak, idx) in waveform"
                :key="idx"
                class="flex-1 bg-[#46464D] rounded-full transition-all"
                :style="{
                  height: `${Math.max(10, peak * 100)}%`,
                  backgroundColor:
                    (idx / waveform.length) * fileDuration >= startTime &&
                    (idx / waveform.length) * fileDuration <= startTime + trimDuration
                      ? '#D0D4F7'
                      : '#3A3A3E'
                }"
              />
            </div>

            <!-- Time Chips & Preview Button -->
            <div class="flex items-center justify-between pt-1">
              <button
                type="button"
                @click="togglePreview"
                class="px-3.5 py-1.5 rounded-lg bg-[#2A2A2E] hover:bg-[#3A3A3E] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
              >
                <Icon
                  :name="isPreviewPlaying ? 'ic:round-pause' : 'ic:round-play-arrow'"
                  class="text-base text-[#D0D4F7]"
                />
                <span>{{ isPreviewPlaying ? 'Pause Preview' : 'Preview Slice' }}</span>
              </button>

              <div class="flex items-center gap-2 text-xs font-mono text-gray-300">
                <span class="px-2 py-1 rounded bg-[#131315] border border-[#3A3A3E]">
                  Start: {{ formatSeconds(startTime) }}
                </span>
                <span>-</span>
                <span class="px-2 py-1 rounded bg-[#131315] border border-[#3A3A3E]">
                  End: {{ formatSeconds(startTime + trimDuration) }}
                </span>
                <span class="text-[#D0D4F7] font-semibold">({{ trimDuration }}s)</span>
              </div>
            </div>
          </div>

          <!-- Trimmer Sliders -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-300 mb-1">
                Start Time ({{ formatSeconds(startTime) }})
              </label>
              <input
                type="range"
                :min="0"
                :max="Math.max(0, fileDuration - 5)"
                :step="1"
                :value="startTime"
                @input="handleStartChange"
                class="w-full accent-[#D0D4F7] cursor-pointer"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-300 mb-1">
                Duration: {{ trimDuration }}s (Max 60s)
              </label>
              <input
                type="range"
                :min="5"
                :max="Math.min(60, Math.max(5, fileDuration - startTime))"
                :step="1"
                :value="trimDuration"
                @input="handleDurationChange"
                class="w-full accent-[#D0D4F7] cursor-pointer"
              />
            </div>
          </div>

          <!-- Dynamic Audio Compression Info Pill -->
          <div class="flex items-center justify-between p-3 rounded-xl bg-[#D0D4F7]/10 border border-[#D0D4F7]/20 text-xs text-[#D0D4F7]">
            <div class="flex items-center gap-2">
              <Icon name="mdi:tune" class="text-base shrink-0" />
              <span>Compression: <strong>192 kbps MP3</strong> (44.1kHz stereo)</span>
            </div>
            <div class="text-[11px] font-mono text-gray-300">
              Est. Size: ~{{ Math.max(0.1, (trimDuration * 24 / 1024)).toFixed(2) }} MB
            </div>
          </div>

          <!-- Metadata Fields -->
          <div class="space-y-3 pt-2 border-t border-[#2A2A2E]">
            <div>
              <label class="block text-xs font-medium text-gray-300 mb-1">Track Title *</label>
              <input
                v-model="songTitle"
                type="text"
                placeholder="e.g. Midnight Serenade (Acoustic)"
                class="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-[#2A2A2E] text-sm text-white focus:outline-none focus:border-[#D0D4F7]"
              />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-300 mb-1">Genre</label>
                <input
                  v-model="songGenre"
                  type="text"
                  placeholder="e.g. Indie Rock / Pop"
                  class="w-full px-3.5 py-2 rounded-xl bg-[#18181B] border border-[#2A2A2E] text-xs text-white focus:outline-none focus:border-[#D0D4F7]"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-300 mb-1">Description (Optional)</label>
                <input
                  v-model="songDescription"
                  type="text"
                  placeholder="Short note or vibe"
                  class="w-full px-3.5 py-2 rounded-xl bg-[#18181B] border border-[#2A2A2E] text-xs text-white focus:outline-none focus:border-[#D0D4F7]"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Actions -->
        <div class="flex items-center justify-end gap-3 pt-4 border-t border-[#2A2A2E]">
          <button
            type="button"
            @click="emit('close')"
            :disabled="isExporting"
            class="px-4 py-2.5 rounded-xl bg-[#18181B] border border-[#2A2A2E] text-xs text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            v-if="audioBuffer"
            type="button"
            @click="handleTrimAndUpload"
            :disabled="isExporting || !songTitle.trim()"
            class="px-5 py-2.5 rounded-xl bg-[#D0D4F7] text-[#0E0E10] text-xs font-semibold hover:bg-[#b8bdf2] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Icon v-if="isExporting" name="ic:baseline-refresh" class="animate-spin text-base" />
            <span>{{ isExporting ? 'Compressing & Uploading...' : 'Trim & Upload MP3' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
