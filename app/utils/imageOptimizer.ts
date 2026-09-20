/**
 * Image Optimizer Utility for TONO
 * Handles client-side strict-fit cropping, manual crop area framing,
 * high-quality antialiased downscaling, and WebP compression to minimize
 * storage usage while retaining high visual fidelity.
 */

export interface ImageValidationResult {
  valid: boolean
  error?: string
}

export interface CropArea {
  x: number      // X offset on source image (in natural pixels)
  y: number      // Y offset on source image (in natural pixels)
  width: number  // Source crop width (in natural pixels)
  height: number // Source crop height (in natural pixels)
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
]

/**
 * Validates file type and raw file size before processing.
 */
export const validateImageFile = (file: File | Blob, maxMb = 15): ImageValidationResult => {
  if (!file) {
    return { valid: false, error: 'No file selected.' }
  }

  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'Please upload a valid image file (JPEG, PNG, WebP, or GIF).',
    }
  }

  const maxBytes = maxMb * 1024 * 1024
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `Image exceeds the ${maxMb}MB file size limit.`,
    }
  }

  return { valid: true }
}

/**
 * Loads a File, Blob, or URL string into an HTMLImageElement for canvas manipulation.
 */
export const loadImage = (source: File | Blob | string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    let url: string

    if (typeof source === 'string') {
      url = source
      // Only set crossOrigin on remote HTTP/HTTPS endpoints to prevent issues on local/blob URLs
      if (source.startsWith('http://') || source.startsWith('https://')) {
        img.crossOrigin = 'anonymous'
      }
    } else {
      url = URL.createObjectURL(source)
    }

    img.onload = () => {
      resolve(img)
    }

    img.onerror = () => {
      reject(new Error('Failed to load image for processing.'))
    }

    img.src = url
  })
}

/**
 * Converts a Canvas to a WebP Blob with specified quality.
 */
export const canvasToWebpBlob = (canvas: HTMLCanvasElement, quality = 0.82): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to encode image to WebP format.'))
        }
      },
      'image/webp',
      quality
    )
  })
}

/**
 * Optimizes an Avatar Image:
 * - Uses custom CropArea if provided, or center-crops to a 1:1 square.
 * - Scales down to max 500x500px.
 * - Compresses to WebP @ 82% quality (~35KB - 80KB).
 */
export const optimizeAvatar = async (
  source: File | Blob | string | HTMLImageElement,
  cropArea?: CropArea,
  targetDimension = 500,
  quality = 0.82
): Promise<Blob> => {
  const img = source instanceof HTMLImageElement ? source : await loadImage(source)
  const naturalWidth = img.naturalWidth
  const naturalHeight = img.naturalHeight

  let sourceX = 0
  let sourceY = 0
  let sourceSize = Math.min(naturalWidth, naturalHeight)

  if (cropArea && cropArea.width > 0 && cropArea.height > 0) {
    sourceX = Math.max(0, Math.min(cropArea.x, naturalWidth - 1))
    sourceY = Math.max(0, Math.min(cropArea.y, naturalHeight - 1))
    sourceSize = Math.min(
      cropArea.width,
      cropArea.height,
      naturalWidth - sourceX,
      naturalHeight - sourceY
    )
  } else {
    sourceX = (naturalWidth - sourceSize) / 2
    sourceY = (naturalHeight - sourceSize) / 2
  }

  // Output dimensions (strictly square, capped at targetDimension)
  const outputSize = Math.max(1, Math.min(Math.round(sourceSize), targetDimension))

  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context is not supported in this browser.')
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  ctx.drawImage(
    img,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    outputSize,
    outputSize
  )

  return canvasToWebpBlob(canvas, quality)
}

/**
 * Optimizes a Cover Banner Image:
 * - Uses custom CropArea if provided, or center-crops to a 3:1 banner.
 * - Scales down to max 1920px wide and 640px high (~3:1 aspect ratio).
 * - Applies smart center-cover fit to prevent letterboxing or stretched graphics.
 * - Compresses to WebP to 82% quality (~120KB - 250KB) will refer on supabase bucket.
 */
export const optimizeCover = async (
  source: File | Blob | string | HTMLImageElement,
  cropArea?: CropArea,
  maxWidth = 1920,
  maxHeight = 640,
  quality = 0.82
): Promise<Blob> => {
  const img = source instanceof HTMLImageElement ? source : await loadImage(source)
  const naturalWidth = img.naturalWidth
  const naturalHeight = img.naturalHeight

  const targetRatio = maxWidth / maxHeight // 3.0 (3:1 banner)
  let sourceX = 0
  let sourceY = 0
  let sourceWidth = naturalWidth
  let sourceHeight = naturalHeight

  if (cropArea && cropArea.width > 0 && cropArea.height > 0) {
    sourceX = Math.max(0, Math.min(cropArea.x, naturalWidth - 1))
    sourceY = Math.max(0, Math.min(cropArea.y, naturalHeight - 1))

    // Strictly enforce 3:1 aspect ratio on the source crop
    sourceWidth = Math.min(cropArea.width, naturalWidth - sourceX)
    sourceHeight = sourceWidth / targetRatio

    if (sourceY + sourceHeight > naturalHeight) {
      sourceHeight = naturalHeight - sourceY
      sourceWidth = sourceHeight * targetRatio
    }
  } else {
    const sourceRatio = naturalWidth / naturalHeight
    if (sourceRatio > targetRatio) {
      // Image is wider than 3:1 banner -> crop sides
      sourceWidth = naturalHeight * targetRatio
      sourceX = (naturalWidth - sourceWidth) / 2
      sourceHeight = naturalHeight
    } else {
      // Image is taller than 3:1 banner -> crop top and bottom
      sourceHeight = naturalWidth / targetRatio
      sourceY = (naturalHeight - sourceHeight) / 2
      sourceWidth = naturalWidth
    }
  }

  const outputWidth = Math.max(1, Math.min(Math.round(sourceWidth), maxWidth))
  const outputHeight = Math.max(1, Math.round(outputWidth / targetRatio))

  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context is not supported in this browser.')
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  ctx.drawImage(
    img,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight
  )

  return canvasToWebpBlob(canvas, quality)
}
