import { ref } from 'vue'

export type PortfolioSection = 'media' | 'songs' | 'milestones' | 'posters' | null

export interface PortfolioMediaItem {
  id: string
  artistId: string
  category: 'media_embed'
  platform: string
  title?: string
  displayText?: string
  url: string
  displayOrder: number
  createdAt?: string
}

export interface PortfolioAudioItem {
  id: string
  artistId: string
  category: 'audio_embed'
  platform: string
  title?: string
  displayText?: string
  url: string
  displayOrder: number
  createdAt?: string
}

export interface PortfolioMilestoneItem {
  id: string
  artistId: string
  category: 'milestone'
  title: string
  description?: string
  eventDate?: string
  mediaType: 'image'
  fileUrl: string
  displayOrder: number
  uploadedAt?: string
}

export interface PortfolioPosterItem {
  id: string
  artistId: string
  category: 'poster'
  title?: string
  mediaType: 'image'
  fileUrl: string
  displayOrder: number
  uploadedAt?: string
}

export const useArtistPortfolio = () => {
  const supabase = useSupabaseClient()
  const db = supabase as any

  const activeEditingSection = ref<PortfolioSection>(null)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const portfolioError = ref<string | null>(null)

  // Loaded Items
  const mediaItems = ref<PortfolioMediaItem[]>([])
  const audioItems = ref<PortfolioAudioItem[]>([])
  const milestoneItems = ref<PortfolioMilestoneItem[]>([])
  const posterItems = ref<PortfolioPosterItem[]>([])

  // Drafts for granular editing
  const draftMediaItems = ref<PortfolioMediaItem[]>([])
  const draftAudioItems = ref<PortfolioAudioItem[]>([])
  const draftMilestones = ref<PortfolioMilestoneItem[]>([])
  const draftPosters = ref<PortfolioPosterItem[]>([])

  /**
   * Helper to parse the relative file path from a Supabase Storage public URL.
   */
  const extractStoragePath = (url: string | null | undefined, bucket = 'portfolio'): string | null => {
    if (!url) return null
    try {
      const marker = `/storage/v1/object/public/${bucket}/`
      const index = url.indexOf(marker)
      if (index !== -1) {
        const pathPart = url.substring(index + marker.length).split('?')[0]
        return pathPart ? decodeURIComponent(pathPart) : null
      }
    } catch (e) {
      console.warn('Failed to parse storage path:', e)
    }
    return null
  }

  /**
   * Cleans up deleted files from the Supabase 'portfolio' storage bucket.
   */
  const deleteStorageFile = async (fileUrl: string | null | undefined) => {
    const path = extractStoragePath(fileUrl, 'portfolio')
    if (path) {
      try {
        await supabase.storage.from('portfolio').remove([path])
      } catch (err) {
        console.warn('Failed to remove old file from portfolio bucket:', err)
      }
    }
  }

  /**
   * Upload an image to the 'portfolio' bucket with the RLS-compliant path:
   * {auth.uid()}/{subfolder}/{timestamp}_{filename}.webp
   */
  const uploadPortfolioImage = async (
    fileOrBlob: File | Blob,
    subfolder: 'milestones' | 'posters'
  ): Promise<string> => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error('You must be logged in to upload portfolio media.')
    }

    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const filePath = `${user.id}/${subfolder}/${timestamp}_${random}.webp`

    const { error: uploadErr } = await supabase.storage
      .from('portfolio')
      .upload(filePath, fileOrBlob, {
        contentType: 'image/webp',
        upsert: true,
      })

    if (uploadErr) {
      console.error('Storage upload failed:', uploadErr)
      throw uploadErr
    }

    const { data: publicData } = supabase.storage.from('portfolio').getPublicUrl(filePath)
    return publicData.publicUrl
  }

  /**
   * Fetch all portfolio data for the given artistId.
   */
  const fetchPortfolio = async (artistId: string) => {
    if (!artistId) return
    isLoading.value = true
    portfolioError.value = null

    try {
      // 1. Fetch Links (Media Embeds & Audio Embeds)
      let linksData: any[] | null = null
      const { data: lData, error: linksErr } = await db
        .from('PORTFOLIO_LINK')
        .select('*')
        .eq('ARTIST_ID', artistId)
        .order('Display_Order', { ascending: true })

      if (linksErr) {
        // Fallback if Display_Order column does not exist yet
        const { data: fallbackData, error: fallbackErr } = await db
          .from('PORTFOLIO_LINK')
          .select('*')
          .eq('ARTIST_ID', artistId)
          .order('Created_at', { ascending: true })
        if (fallbackErr) throw fallbackErr
        linksData = fallbackData
      } else {
        linksData = lData
      }

      const allLinks = linksData || []

      mediaItems.value = allLinks
        .filter((row: any) => row.Category === 'media_embed')
        .map((row: any) => ({
          id: row.LINK_ID,
          artistId: row.ARTIST_ID,
          category: 'media_embed',
          platform: row.Platform || 'youtube',
          title: row.Title || row.Display_Text || '',
          displayText: row.Display_Text || '',
          url: row.URL,
          displayOrder: row.Display_Order ?? 0,
          createdAt: row.Created_at,
        }))

      audioItems.value = allLinks
        .filter((row: any) => row.Category === 'audio_embed')
        .map((row: any) => ({
          id: row.LINK_ID,
          artistId: row.ARTIST_ID,
          category: 'audio_embed',
          platform: row.Platform || 'spotify',
          title: row.Title || row.Display_Text || '',
          displayText: row.Display_Text || '',
          url: row.URL,
          displayOrder: row.Display_Order ?? 0,
          createdAt: row.Created_at,
        }))

      // 2. Fetch Media (Milestones & Promotional Posters)
      let mediaData: any[] | null = null
      const { data: mData, error: mediaErr } = await db
        .from('PORTFOLIO_MEDIA')
        .select('*')
        .eq('ARTIST_ID', artistId)
        .order('Display_Order', { ascending: true })

      if (mediaErr) {
        const { data: fallbackMedia, error: fallbackErr } = await db
          .from('PORTFOLIO_MEDIA')
          .select('*')
          .eq('ARTIST_ID', artistId)
          .order('Uploaded_At', { ascending: true })
        if (fallbackErr) throw fallbackErr
        mediaData = fallbackMedia
      } else {
        mediaData = mData
      }

      const allMedia = mediaData || []

      milestoneItems.value = allMedia
        .filter((row: any) => row.Category === 'milestone')
        .map((row: any) => ({
          id: row.MEDIA_ID,
          artistId: row.ARTIST_ID,
          category: 'milestone',
          title: row.Title || row.Description || '',
          description: row.Description || '',
          eventDate: row.Event_Date || '',
          mediaType: 'image',
          fileUrl: row.File_URL,
          displayOrder: row.Display_Order ?? 0,
          uploadedAt: row.Uploaded_At,
        }))

      posterItems.value = allMedia
        .filter((row: any) => row.Category === 'poster')
        .map((row: any) => ({
          id: row.MEDIA_ID,
          artistId: row.ARTIST_ID,
          category: 'poster',
          title: row.Title || '',
          mediaType: 'image',
          fileUrl: row.File_URL,
          displayOrder: row.Display_Order ?? 0,
          uploadedAt: row.Uploaded_At,
        }))
    } catch (err: any) {
      console.error('Failed to load portfolio:', err)
      portfolioError.value = err.message || 'Failed to load portfolio content.'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Enter editing mode for a specific section.
   */
  const startEditing = (section: PortfolioSection) => {
    activeEditingSection.value = section

    if (section === 'media') {
      draftMediaItems.value = JSON.parse(JSON.stringify(mediaItems.value))
    } else if (section === 'songs') {
      draftAudioItems.value = JSON.parse(JSON.stringify(audioItems.value))
    } else if (section === 'milestones') {
      draftMilestones.value = JSON.parse(JSON.stringify(milestoneItems.value))
    } else if (section === 'posters') {
      draftPosters.value = JSON.parse(JSON.stringify(posterItems.value))
    }
  }

  /**
   * Cancel and discard changes for the active section.
   */
  const cancelEditing = () => {
    activeEditingSection.value = null
  }

  /**
   * Save Media Section (Max 5 items).
   */
  const saveMediaSection = async (artistId: string) => {
    if (!artistId) return
    isSaving.value = true
    portfolioError.value = null

    try {
      const itemsToSave = draftMediaItems.value.slice(0, 5)

      // Delete existing media_embed rows
      const { error: delErr } = await db
        .from('PORTFOLIO_LINK')
        .delete()
        .eq('ARTIST_ID', artistId)
        .eq('Category', 'media_embed')

      if (delErr) throw delErr

      // Insert new rows
      if (itemsToSave.length > 0) {
        const fullRows = itemsToSave.map((item, index) => ({
          ARTIST_ID: artistId,
          Category: 'media_embed',
          Platform: item.platform || 'youtube',
          Title: item.title?.trim() || null,
          Display_Text: item.displayText?.trim() || null,
          URL: item.url.trim(),
          Display_Order: index,
        }))

        const { error: insErr } = await db.from('PORTFOLIO_LINK').insert(fullRows)
        if (insErr) {
          if (insErr.code === 'PGRST204' || insErr.message?.includes('Display_Order') || insErr.message?.includes('Title')) {
            console.warn('PORTFOLIO_LINK missing Title/Display_Order column. Falling back to base columns.')
            const legacyRows = itemsToSave.map((item) => ({
              ARTIST_ID: artistId,
              Category: 'media_embed',
              Platform: item.platform || 'youtube',
              Display_Text: item.displayText?.trim() || item.title?.trim() || null,
              URL: item.url.trim(),
            }))
            const { error: legacyErr } = await db.from('PORTFOLIO_LINK').insert(legacyRows)
            if (legacyErr) throw legacyErr
          } else {
            throw insErr
          }
        }
      }

      // Refresh and exit
      await fetchPortfolio(artistId)
      activeEditingSection.value = null
    } catch (err: any) {
      console.error('Failed to save media section:', err)
      portfolioError.value = err.message || 'Failed to save media articles.'
      throw err
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Save Released Songs Section.
   */
  const saveAudioSection = async (artistId: string) => {
    if (!artistId) return
    isSaving.value = true
    portfolioError.value = null

    try {
      const itemsToSave = draftAudioItems.value

      // Delete existing audio_embed rows
      const { error: delErr } = await db
        .from('PORTFOLIO_LINK')
        .delete()
        .eq('ARTIST_ID', artistId)
        .eq('Category', 'audio_embed')

      if (delErr) throw delErr

      // Insert new rows
      if (itemsToSave.length > 0) {
        const fullRows = itemsToSave.map((item, index) => ({
          ARTIST_ID: artistId,
          Category: 'audio_embed',
          Platform: item.platform || 'spotify',
          Title: item.title?.trim() || null,
          Display_Text: item.displayText?.trim() || null,
          URL: item.url.trim(),
          Display_Order: index,
        }))

        const { error: insErr } = await db.from('PORTFOLIO_LINK').insert(fullRows)
        if (insErr) {
          if (insErr.code === 'PGRST204' || insErr.message?.includes('Display_Order') || insErr.message?.includes('Title')) {
            console.warn('PORTFOLIO_LINK missing Title/Display_Order column. Falling back to base columns.')
            const legacyRows = itemsToSave.map((item) => ({
              ARTIST_ID: artistId,
              Category: 'audio_embed',
              Platform: item.platform || 'spotify',
              Display_Text: item.displayText?.trim() || item.title?.trim() || null,
              URL: item.url.trim(),
            }))
            const { error: legacyErr } = await db.from('PORTFOLIO_LINK').insert(legacyRows)
            if (legacyErr) throw legacyErr
          } else {
            throw insErr
          }
        }
      }

      // Refresh and exit
      await fetchPortfolio(artistId)
      activeEditingSection.value = null
    } catch (err: any) {
      console.error('Failed to save audio section:', err)
      portfolioError.value = err.message || 'Failed to save released songs.'
      throw err
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Save Milestones Section.
   */
  const saveMilestonesSection = async (artistId: string) => {
    if (!artistId) return
    isSaving.value = true
    portfolioError.value = null

    try {
      const currentUrls = milestoneItems.value.map((m) => m.fileUrl).filter(Boolean)
      const newUrls = draftMilestones.value.map((m) => m.fileUrl).filter(Boolean)

      // Clean up deleted images from storage
      const removedUrls = currentUrls.filter((url) => !newUrls.includes(url))
      for (const url of removedUrls) {
        await deleteStorageFile(url)
      }

      // Delete existing milestone records
      const { error: delErr } = await db
        .from('PORTFOLIO_MEDIA')
        .delete()
        .eq('ARTIST_ID', artistId)
        .eq('Category', 'milestone')

      if (delErr) throw delErr

      // Insert updated milestones
      if (draftMilestones.value.length > 0) {
        const fullRows = draftMilestones.value.map((item, index) => ({
          ARTIST_ID: artistId,
          Category: 'milestone',
          Media_Type: 'image',
          File_URL: item.fileUrl?.trim() || '',
          Title: item.title?.trim() || 'Milestone',
          Description: item.description?.trim() || null,
          Event_Date: item.eventDate?.trim() || null,
          Display_Order: index,
        }))

        const { error: insErr } = await db.from('PORTFOLIO_MEDIA').insert(fullRows)
        if (insErr) {
          if (insErr.code === 'PGRST204' || insErr.message?.includes('Display_Order') || insErr.message?.includes('Title') || insErr.message?.includes('Event_Date')) {
            console.warn('PORTFOLIO_MEDIA missing enhanced columns. Falling back to base columns.')
            const legacyRows = draftMilestones.value.map((item) => ({
              ARTIST_ID: artistId,
              Category: 'milestone',
              Media_Type: 'image',
              File_URL: item.fileUrl?.trim() || '',
              Description: item.description?.trim() || item.title?.trim() || null,
            }))
            const { error: legacyErr } = await db.from('PORTFOLIO_MEDIA').insert(legacyRows)
            if (legacyErr) throw legacyErr
          } else {
            throw insErr
          }
        }
      }

      // Refresh and exit
      await fetchPortfolio(artistId)
      activeEditingSection.value = null
    } catch (err: any) {
      console.error('Failed to save milestones:', err)
      portfolioError.value = err.message || 'Failed to save milestones.'
      throw err
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Save Promotional Posters Section (Max 4 posters).
   */
  const savePostersSection = async (artistId: string) => {
    if (!artistId) return
    isSaving.value = true
    portfolioError.value = null

    try {
      const itemsToSave = draftPosters.value.slice(0, 4)
      const currentUrls = posterItems.value.map((p) => p.fileUrl)
      const newUrls = itemsToSave.map((p) => p.fileUrl)

      // Clean up deleted poster files from storage
      const removedUrls = currentUrls.filter((url) => !newUrls.includes(url))
      for (const url of removedUrls) {
        await deleteStorageFile(url)
      }

      // Delete existing poster records
      const { error: delErr } = await db
        .from('PORTFOLIO_MEDIA')
        .delete()
        .eq('ARTIST_ID', artistId)
        .eq('Category', 'poster')

      if (delErr) throw delErr

      // Insert updated posters
      if (itemsToSave.length > 0) {
        const fullRows = itemsToSave.map((item, index) => ({
          ARTIST_ID: artistId,
          Category: 'poster',
          Media_Type: 'image',
          File_URL: item.fileUrl,
          Title: item.title?.trim() || null,
          Display_Order: index,
        }))

        const { error: insErr } = await db.from('PORTFOLIO_MEDIA').insert(fullRows)
        if (insErr) {
          if (insErr.code === 'PGRST204' || insErr.message?.includes('Display_Order') || insErr.message?.includes('Title')) {
            console.warn('PORTFOLIO_MEDIA missing enhanced columns. Falling back to base columns.')
            const legacyRows = itemsToSave.map((item) => ({
              ARTIST_ID: artistId,
              Category: 'poster',
              Media_Type: 'image',
              File_URL: item.fileUrl,
            }))
            const { error: legacyErr } = await db.from('PORTFOLIO_MEDIA').insert(legacyRows)
            if (legacyErr) throw legacyErr
          } else {
            throw insErr
          }
        }
      }

      // Refresh and exit
      await fetchPortfolio(artistId)
      activeEditingSection.value = null
    } catch (err: any) {
      console.error('Failed to save promotional posters:', err)
      portfolioError.value = err.message || 'Failed to save promotional materials.'
      throw err
    } finally {
      isSaving.value = false
    }
  }

  return {
    activeEditingSection,
    isLoading,
    isSaving,
    portfolioError,
    mediaItems,
    audioItems,
    milestoneItems,
    posterItems,
    draftMediaItems,
    draftAudioItems,
    draftMilestones,
    draftPosters,
    fetchPortfolio,
    startEditing,
    cancelEditing,
    uploadPortfolioImage,
    saveMediaSection,
    saveAudioSection,
    saveMilestonesSection,
    savePostersSection,
  }
}
