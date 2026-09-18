import { ref } from 'vue'
import { validateImageFile, optimizeAvatar, optimizeCover, type CropArea } from '~/utils/imageOptimizer'

export const useMediaUpload = () => {
  const supabase = useSupabaseClient()
  const isUploadingAvatar = ref(false)
  const isUploadingCover = ref(false)
  const uploadError = ref<string | null>(null)

  /**
   * Helper to extract the relative storage file path from a full public Supabase URL.
   */
  const extractStoragePath = (url: string | null | undefined, bucket: string): string | null => {
    if (!url) return null
    try {
      const marker = `/storage/v1/object/public/${bucket}/`
      const index = url.indexOf(marker)
      if (index !== -1) {
        const pathPart = url.substring(index + marker.length).split('?')[0]
        return pathPart ? decodeURIComponent(pathPart) : null
      }
    } catch (e) {
      console.warn('Failed to parse previous storage path:', e)
    }
    return null
  }

  /**
   * Deletes an existing file from a bucket if it belongs to the user.
   */
  const cleanupOldFile = async (bucket: string, oldUrl: string | null | undefined) => {
    const oldPath = extractStoragePath(oldUrl, bucket)
    if (oldPath) {
      try {
        await supabase.storage.from(bucket).remove([oldPath])
      } catch (err) {
        // Silently log; cleanup failure should not prevent new image usage
        console.warn(`Could not remove old file from ${bucket}:`, err)
      }
    }
  }

  /**
   * Optimizes and uploads an Avatar image to Supabase Storage,
   * updates the USER_ACCOUNT database record, and cleans up the previous avatar.
   */
  const uploadAvatar = async (
    fileOrBlob: File | Blob,
    previousUrl?: string | null,
    cropArea?: CropArea
  ): Promise<{ url: string } | null> => {
    uploadError.value = null

    if (fileOrBlob instanceof File) {
      const validation = validateImageFile(fileOrBlob, 15)
      if (!validation.valid) {
        uploadError.value = validation.error || 'Invalid file.'
        throw new Error(uploadError.value)
      }
    }

    const { data: authData, error: authError } = await supabase.auth.getUser()
    const user = authData?.user
    if (authError || !user) {
      uploadError.value = 'User authentication required to upload image.'
      throw new Error(uploadError.value)
    }

    isUploadingAvatar.value = true

    try {
      // 1. Optimize image (or use pre-optimized WebP blob)
      let optimizedBlob: Blob
      if (fileOrBlob instanceof Blob && fileOrBlob.type === 'image/webp' && !cropArea) {
        optimizedBlob = fileOrBlob
      } else {
        optimizedBlob = await optimizeAvatar(fileOrBlob, cropArea)
      }

      // 2. Prepare file path in user's isolated folder
      const timestamp = Date.now()
      const filePath = `${user.id}/avatar_${timestamp}.webp`

      // 3. Upload to Supabase Storage 'avatars' bucket
      const { error: storageError } = await supabase.storage
        .from('avatars')
        .upload(filePath, optimizedBlob, {
          contentType: 'image/webp',
          upsert: true,
        })

      if (storageError) {
        throw storageError
      }

      // 4. Retrieve public URL
      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const publicUrl = publicData.publicUrl

      // 5. Update USER_ACCOUNT table
      const db = supabase as any
      const { error: dbError } = await db
        .from('USER_ACCOUNT')
        .update({ Profile_Picture: publicUrl })
        .eq('ACCOUNT_ID', user.id)

      if (dbError) {
        throw dbError
      }

      // Sync globally shared avatar state across navbars
      try {
        const globalAvatar = useState<string | null>('tono_user_avatar', () => null)
        globalAvatar.value = publicUrl
      } catch (e) {
        // Non-blocking if called outside nuxt context
      }

      // 6. Asynchronously clean up old avatar if one exists
      if (previousUrl && previousUrl !== publicUrl) {
        cleanupOldFile('avatars', previousUrl)
      }

      return { url: publicUrl }
    } catch (err: any) {
      console.error('Error uploading avatar:', err)
      uploadError.value = err.message || 'Failed to upload profile picture.'
      throw err
    } finally {
      isUploadingAvatar.value = false
    }
  }

  /**
   * Optimizes and uploads a Cover banner image to Supabase Storage,
   * updates the USER_ACCOUNT database record, and cleans up the previous cover.
   */
  const uploadCover = async (
    fileOrBlob: File | Blob,
    previousUrl?: string | null,
    cropArea?: CropArea
  ): Promise<{ url: string } | null> => {
    uploadError.value = null

    if (fileOrBlob instanceof File) {
      const validation = validateImageFile(fileOrBlob, 20)
      if (!validation.valid) {
        uploadError.value = validation.error || 'Invalid file.'
        throw new Error(uploadError.value)
      }
    }

    const { data: authData, error: authError } = await supabase.auth.getUser()
    const user = authData?.user
    if (authError || !user) {
      uploadError.value = 'User authentication required to upload image.'
      throw new Error(uploadError.value)
    }

    isUploadingCover.value = true

    try {
      // 1. Optimize image (or use pre-optimized WebP blob)
      let optimizedBlob: Blob
      if (fileOrBlob instanceof Blob && fileOrBlob.type === 'image/webp' && !cropArea) {
        optimizedBlob = fileOrBlob
      } else {
        optimizedBlob = await optimizeCover(fileOrBlob, cropArea)
      }

      // 2. Prepare file path in user's isolated folder
      const timestamp = Date.now()
      const filePath = `${user.id}/cover_${timestamp}.webp`

      // 3. Upload to Supabase Storage 'covers' bucket
      const { error: storageError } = await supabase.storage
        .from('covers')
        .upload(filePath, optimizedBlob, {
          contentType: 'image/webp',
          upsert: true,
        })

      if (storageError) {
        throw storageError
      }

      // 4. Retrieve public URL
      const { data: publicData } = supabase.storage.from('covers').getPublicUrl(filePath)
      const publicUrl = publicData.publicUrl

      // 5. Update USER_ACCOUNT table
      const db = supabase as any
      const { error: dbError } = await db
        .from('USER_ACCOUNT')
        .update({ Cover_Picture: publicUrl })
        .eq('ACCOUNT_ID', user.id)

      if (dbError) {
        throw dbError
      }

      // 6. Asynchronously clean up old cover if one exists
      if (previousUrl && previousUrl !== publicUrl) {
        cleanupOldFile('covers', previousUrl)
      }

      return { url: publicUrl }
    } catch (err: any) {
      console.error('Error uploading cover:', err)
      uploadError.value = err.message || 'Failed to upload cover banner.'
      throw err
    } finally {
      isUploadingCover.value = false
    }
  }

  return {
    uploadAvatar,
    uploadCover,
    isUploadingAvatar,
    isUploadingCover,
    uploadError,
  }
}
