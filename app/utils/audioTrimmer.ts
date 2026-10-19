import { Mp3Encoder } from '@breezystack/lamejs'

/**
 * Web Audio API Trimmer & In-Browser Audio Processor
 * Converts raw/uncompressed audio (FLAC, WAV, AAC, WebM, MP3) into
 * optimized 192kbps MP3 (44.1kHz stereo) for fast streaming and compact file size.
 */

export interface TrimmedAudioResult {
  blob: Blob
  duration: number
  format: 'mp3' | 'wav'
  sizeFormatted: string
  waveformData?: number[]
}

/**
 * Decodes an uploaded audio file into an AudioBuffer using the browser's AudioContext.
 * Natively supports FLAC, MP3, WAV, AAC/M4A, OGG, and WebM in modern browsers.
 */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer()
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
  const audioCtx = new AudioContextClass()
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    return audioBuffer
  } finally {
    if (audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {})
    }
  }
}

/**
 * Samples peak amplitudes from an AudioBuffer to render an interactive waveform canvas.
 */
export function generateWaveformData(audioBuffer: AudioBuffer, samples = 100): number[] {
  const channelData = audioBuffer.getChannelData(0)
  const blockSize = Math.floor(channelData.length / samples)
  const waveform: number[] = []

  for (let i = 0; i < samples; i++) {
    const blockStart = blockSize * i
    let sum = 0
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(channelData[blockStart + j] || 0)
    }
    const average = sum / blockSize
    // Normalize to 0 - 1 range
    waveform.push(Math.min(1, average * 2.5))
  }

  return waveform
}

/**
 * Extracts a sliced portion of an AudioBuffer (up to max duration, e.g. 60 seconds).
 */
export function sliceAudioBuffer(
  audioBuffer: AudioBuffer,
  startTimeSeconds: number,
  durationSeconds: number
): AudioBuffer {
  const sampleRate = audioBuffer.sampleRate
  const channels = audioBuffer.numberOfChannels
  const startOffset = Math.floor(startTimeSeconds * sampleRate)
  const endOffset = Math.min(
    audioBuffer.length,
    Math.floor((startTimeSeconds + durationSeconds) * sampleRate)
  )
  const frameCount = Math.max(1, endOffset - startOffset)

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
  const audioCtx = new AudioContextClass()
  const slicedBuffer = audioCtx.createBuffer(channels, frameCount, sampleRate)

  for (let c = 0; c < channels; c++) {
    const srcData = audioBuffer.getChannelData(c)
    const destData = slicedBuffer.getChannelData(c)
    for (let i = 0; i < frameCount; i++) {
      destData[i] = srcData[startOffset + i] || 0
    }
  }

  audioCtx.close().catch(() => {})
  return slicedBuffer
}

/**
 * Resamples an AudioBuffer to target sample rate (default: 44,100 Hz).
 * Crucial for high-res inputs (96kHz / 192kHz / 48kHz FLAC) before MP3 encoding.
 */
export async function resampleAudioBuffer(
  audioBuffer: AudioBuffer,
  targetSampleRate = 44100
): Promise<AudioBuffer> {
  if (audioBuffer.sampleRate === targetSampleRate) {
    return audioBuffer
  }

  const numChannels = Math.min(audioBuffer.numberOfChannels, 2)
  const targetLength = Math.max(1, Math.ceil(audioBuffer.duration * targetSampleRate))

  const OfflineContextClass =
    window.OfflineAudioContext || (window as any).webkitOfflineAudioContext
  if (!OfflineContextClass) {
    return audioBuffer
  }

  const offlineCtx = new OfflineContextClass(numChannels, targetLength, targetSampleRate)
  const source = offlineCtx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(offlineCtx.destination)
  source.start(0)

  return await offlineCtx.startRendering()
}

/**
 * Encodes an AudioBuffer into high-quality 192kbps MP3 (Joint Stereo, 44.1kHz).
 * Yields ~1.4MB for a 60-second slice, far below the 15MB limit with transparent audio quality.
 */
export async function encodeMp3(audioBuffer: AudioBuffer, kbps = 192): Promise<Blob> {
  // 1. Resample to standard 44.1kHz if needed
  const buffer = await resampleAudioBuffer(audioBuffer, 44100)

  const numChannels = Math.min(buffer.numberOfChannels, 2)
  const sampleRate = buffer.sampleRate
  const numSamples = buffer.length

  // Mono tracks can use 128 kbps (broadcast transparent); stereo tracks use 192 kbps
  const effectiveKbps = numChannels === 1 ? Math.min(128, kbps) : kbps
  const encoder = new Mp3Encoder(numChannels, sampleRate, effectiveKbps)

  const leftFloat = buffer.getChannelData(0)
  const rightFloat = numChannels > 1 ? buffer.getChannelData(1) : null

  // Convert float32 [-1.0, 1.0] to 16-bit PCM integer [-32768, 32767]
  const leftInt16 = new Int16Array(numSamples)
  const rightInt16 = rightFloat ? new Int16Array(numSamples) : null

  for (let i = 0; i < numSamples; i++) {
    const lVal = Math.max(-1, Math.min(1, leftFloat[i] ?? 0))
    leftInt16[i] = lVal < 0 ? lVal * 0x8000 : lVal * 0x7fff

    if (rightInt16 && rightFloat) {
      const rVal = Math.max(-1, Math.min(1, rightFloat[i] ?? 0))
      rightInt16[i] = rVal < 0 ? rVal * 0x8000 : rVal * 0x7fff
    }
  }

  const mp3Data: Uint8Array[] = []
  const chunkSize = 1152 // Standard MPEG-1 Layer III chunk

  for (let i = 0; i < numSamples; i += chunkSize) {
    const leftChunk = leftInt16.subarray(i, i + chunkSize)
    let mp3buf: Uint8Array

    if (numChannels === 1 || !rightInt16) {
      mp3buf = encoder.encodeBuffer(leftChunk)
    } else {
      const rightChunk = rightInt16.subarray(i, i + chunkSize)
      mp3buf = encoder.encodeBuffer(leftChunk, rightChunk)
    }

    if (mp3buf && mp3buf.length > 0) {
      mp3Data.push(mp3buf)
    }
  }

  const endBuf = encoder.flush()
  if (endBuf && endBuf.length > 0) {
    mp3Data.push(endBuf)
  }

  return new Blob(mp3Data as unknown as BlobPart[], { type: 'audio/mpeg' })
}

/**
 * Fallback WAV encoder (16-bit PCM at 44.1kHz).
 */
export async function encodeWav(buffer: AudioBuffer): Promise<Blob> {
  const resampled = await resampleAudioBuffer(buffer, 44100)
  const numChannels = Math.min(resampled.numberOfChannels, 2)
  const sampleRate = resampled.sampleRate
  const length = resampled.length * numChannels * 2 + 44
  const out = new DataView(new ArrayBuffer(length))

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  // RIFF chunk descriptor
  writeString(out, 0, 'RIFF')
  out.setUint32(4, 36 + resampled.length * numChannels * 2, true)
  writeString(out, 8, 'WAVE')

  // FMT sub-chunk
  writeString(out, 12, 'fmt ')
  out.setUint32(16, 16, true)
  out.setUint16(20, 1, true)
  out.setUint16(22, numChannels, true)
  out.setUint32(24, sampleRate, true)
  out.setUint32(28, sampleRate * numChannels * 2, true)
  out.setUint16(32, numChannels * 2, true)
  out.setUint16(34, 16, true)

  // DATA sub-chunk
  writeString(out, 36, 'data')
  out.setUint32(40, resampled.length * numChannels * 2, true)

  let offset = 44
  const channelData: Float32Array[] = []
  for (let i = 0; i < numChannels; i++) {
    channelData.push(resampled.getChannelData(i))
  }

  for (let i = 0; i < resampled.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const channel = channelData[c]
      const rawSample = channel ? channel[i] ?? 0 : 0
      const sample = Math.max(-1, Math.min(1, rawSample))
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      out.setInt16(offset, intSample, true)
      offset += 2
    }
  }

  return new Blob([out.buffer], { type: 'audio/wav' })
}

/**
 * Primary compression and export method.
 * Attempts MP3 conversion at 192kbps (optimal perceptible quality/size ratio).
 * Gracefully falls back to 44.1kHz WAV if MP3 encoding encounters an issue.
 */
export async function compressAndExportAudio(
  buffer: AudioBuffer,
  options?: { kbps?: number }
): Promise<{ blob: Blob; duration: number; format: 'mp3' | 'wav'; sizeFormatted: string }> {
  const kbps = options?.kbps || 192

  try {
    const mp3Blob = await encodeMp3(buffer, kbps)
    const sizeMb = (mp3Blob.size / (1024 * 1024)).toFixed(2)
    return {
      blob: mp3Blob,
      duration: buffer.duration,
      format: 'mp3',
      sizeFormatted: `${sizeMb} MB`
    }
  } catch (err) {
    console.warn('[audioTrimmer] MP3 encoding failed, falling back to 44.1kHz WAV:', err)
    const wavBlob = await encodeWav(buffer)
    const sizeMb = (wavBlob.size / (1024 * 1024)).toFixed(2)
    return {
      blob: wavBlob,
      duration: buffer.duration,
      format: 'wav',
      sizeFormatted: `${sizeMb} MB`
    }
  }
}
