<script setup lang="ts">
definePageMeta({
  layout: 'artist',
  middleware: ['auth', 'artist']
})

import { ref, computed, onMounted } from 'vue'
import { validateImageFile } from '~/utils/imageOptimizer'
import { getMilestoneInitials } from '~/utils/milestoneHelper'

const supabase = useSupabaseClient()
const { fetchCurrentUserProfile, resolveUserType } = useTonoAuth()
const { uploadAvatar, uploadCover, isUploadingAvatar, isUploadingCover, uploadError } = useMediaUpload()

const artistName = ref('Artist')
const artistBio = ref('')
const usertype = ref('')
const artistTags = ref<string[]>([])
const profilePicture = ref<string | null>(null)
const coverPicture = ref<string | null>(null)
const globalAvatarUrl = useState<string | null>('tono_user_avatar', () => null)
const isLoading = ref(true)

// Artist Details & Tags State
const artistId = ref('')
const artistType = ref<'Solo' | 'Band'>('Solo')
const artistGenres = ref<string[]>([])
const artistInstruments = ref<string[]>([])
const isEditDetailsOpen = ref(false)

// Multipage Tab State
const activeTab = ref<'posts' | 'calendar' | 'portfolio' | 'contact'>('posts')

// Portfolio Composable and State
const isOwner = ref(true)
const {
  activeEditingSection,
  isLoading: isPortfolioLoading,
  isSaving: isPortfolioSaving,
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
  startEditing: startPortfolioEditing,
  cancelEditing: cancelPortfolioEditing,
  uploadPortfolioImage,
  saveMediaSection,
  saveAudioSection,
  saveMilestonesSection,
  savePostersSection,
} = useArtistPortfolio()

// Modals State & Editing Tracking
const isAddMediaOpen = ref(false)
const isAddAudioOpen = ref(false)
const isAddMilestoneOpen = ref(false)
const isAddPosterOpen = ref(false)

const editingMediaIndex = ref<number | null>(null)
const editingAudioIndex = ref<number | null>(null)
const editingMilestoneIndex = ref<number | null>(null)
const editingPosterIndex = ref<number | null>(null)

const activeEditingMediaItem = computed(() =>
  editingMediaIndex.value !== null ? draftMediaItems.value[editingMediaIndex.value] : null
)
const activeEditingAudioItem = computed(() =>
  editingAudioIndex.value !== null ? draftAudioItems.value[editingAudioIndex.value] : null
)
const activeEditingMilestoneItem = computed(() =>
  editingMilestoneIndex.value !== null ? draftMilestones.value[editingMilestoneIndex.value] : null
)
const activeEditingPosterItem = computed(() =>
  editingPosterIndex.value !== null ? draftPosters.value[editingPosterIndex.value] : null
)

const handleCancelEditing = () => {
  cancelPortfolioEditing()
  closeMediaModal()
  closeAudioModal()
  closeMilestoneModal()
  closePosterModal()
}

const openAddMedia = () => {
  editingMediaIndex.value = null
  isAddMediaOpen.value = true
}

const openEditMedia = (index: number) => {
  editingMediaIndex.value = index
  isAddMediaOpen.value = true
}

const closeMediaModal = () => {
  isAddMediaOpen.value = false
  editingMediaIndex.value = null
}

const openAddAudio = () => {
  editingAudioIndex.value = null
  isAddAudioOpen.value = true
}

const openEditAudio = (index: number) => {
  editingAudioIndex.value = index
  isAddAudioOpen.value = true
}

const closeAudioModal = () => {
  isAddAudioOpen.value = false
  editingAudioIndex.value = null
}

const openAddMilestone = () => {
  editingMilestoneIndex.value = null
  isAddMilestoneOpen.value = true
}

const openEditMilestone = (index: number) => {
  editingMilestoneIndex.value = index
  isAddMilestoneOpen.value = true
}

const closeMilestoneModal = () => {
  isAddMilestoneOpen.value = false
  editingMilestoneIndex.value = null
}

const openAddPoster = () => {
  editingPosterIndex.value = null
  isAddPosterOpen.value = true
}

const openEditPoster = (index: number) => {
  editingPosterIndex.value = index
  isAddPosterOpen.value = true
}

const closePosterModal = () => {
  isAddPosterOpen.value = false
  editingPosterIndex.value = null
}

const sectionTitleMap: Record<string, string> = {
  media: 'FEATURED MEDIA',
  songs: 'RELEASED SONGS',
  milestones: 'MILESTONES & ACHIEVEMENTS',
  posters: 'PROMOTIONAL MATERIALS',
}

const handleSaveActiveSection = async () => {
  if (!artistId.value) return
  try {
    if (activeEditingSection.value === 'media') {
      await saveMediaSection(artistId.value)
    } else if (activeEditingSection.value === 'songs') {
      await saveAudioSection(artistId.value)
    } else if (activeEditingSection.value === 'milestones') {
      await saveMilestonesSection(artistId.value)
    } else if (activeEditingSection.value === 'posters') {
      await savePostersSection(artistId.value)
    }
  } catch (err: any) {
    console.error('Failed to save portfolio section:', err)
  }
}

const removeDraftMedia = (index: number) => {
  draftMediaItems.value.splice(index, 1)
}

const removeDraftAudio = (index: number) => {
  draftAudioItems.value.splice(index, 1)
}

const removeDraftMilestone = (index: number) => {
  draftMilestones.value.splice(index, 1)
}

const removeDraftPoster = (index: number) => {
  draftPosters.value.splice(index, 1)
}

const onMediaModalSaved = (payload: { url: string; title: string; caption: string }) => {
  const item = editingMediaIndex.value !== null ? draftMediaItems.value[editingMediaIndex.value] : null
  if (item) {
    item.url = payload.url
    item.title = payload.title
    item.displayText = payload.caption
  } else {
    draftMediaItems.value.push({
      id: `draft_${Date.now()}`,
      artistId: artistId.value,
      category: 'media_embed',
      platform: 'youtube',
      title: payload.title,
      displayText: payload.caption,
      url: payload.url,
      displayOrder: draftMediaItems.value.length,
    })
  }
  closeMediaModal()
}

const onAudioModalSaved = (payload: { url: string; title: string; displayText: string; platform: string }) => {
  const item = editingAudioIndex.value !== null ? draftAudioItems.value[editingAudioIndex.value] : null
  if (item) {
    item.url = payload.url
    item.title = payload.title
    item.displayText = payload.displayText
    item.platform = payload.platform
  } else {
    draftAudioItems.value.push({
      id: `draft_${Date.now()}`,
      artistId: artistId.value,
      category: 'audio_embed',
      platform: payload.platform,
      title: payload.title,
      displayText: payload.displayText,
      url: payload.url,
      displayOrder: draftAudioItems.value.length,
    })
  }
  closeAudioModal()
}

const onMilestoneModalSaved = (payload: { fileUrl: string; title: string; eventDate: string; description: string }) => {
  const item = editingMilestoneIndex.value !== null ? draftMilestones.value[editingMilestoneIndex.value] : null
  if (item) {
    item.fileUrl = payload.fileUrl
    item.title = payload.title
    item.eventDate = payload.eventDate
    item.description = payload.description
  } else {
    draftMilestones.value.push({
      id: `draft_${Date.now()}`,
      artistId: artistId.value,
      category: 'milestone',
      title: payload.title,
      eventDate: payload.eventDate,
      description: payload.description,
      mediaType: 'image',
      fileUrl: payload.fileUrl,
      displayOrder: draftMilestones.value.length,
    })
  }
  closeMilestoneModal()
}

const onPosterModalSaved = (payload: { fileUrl: string; title: string }) => {
  const item = editingPosterIndex.value !== null ? draftPosters.value[editingPosterIndex.value] : null
  if (item) {
    item.fileUrl = payload.fileUrl
    item.title = payload.title
  } else {
    draftPosters.value.push({
      id: `draft_${Date.now()}`,
      artistId: artistId.value,
      category: 'poster',
      title: payload.title,
      mediaType: 'image',
      fileUrl: payload.fileUrl,
      displayOrder: draftPosters.value.length,
    })
  }
  closePosterModal()
}

const avatarInputRef = ref<HTMLInputElement | null>(null)
const coverInputRef = ref<HTMLInputElement | null>(null)

// Media Cropper Modal State
const isCropperOpen = ref(false)
const cropperMode = ref<'avatar' | 'cover'>('avatar')
const cropperImageSource = ref<string | File | Blob | null>(null)

const tagsDisplay = computed(() => {
  if (artistTags.value.length === 0) return 'No tags selected'
  return artistTags.value.join(', ')
})

onMounted(async () => {
  try {
    const profile = await fetchCurrentUserProfile()

    if (profile) {
      if (profile.account) {
        profilePicture.value = profile.account.Profile_Picture || null
        coverPicture.value = profile.account.Cover_Picture || null
        if (profile.account.Profile_Picture) {
          globalAvatarUrl.value = profile.account.Profile_Picture
        }
      }

      if (profile.artistProfile) {
        artistId.value = profile.artistProfile.ARTIST_ID
        artistType.value = profile.artistProfile.Artist_Type === 'Band' ? 'Band' : 'Solo'
        fetchPortfolio(profile.artistProfile.ARTIST_ID)
      }

      // If artist is Band, fetch Band_Name from BAND table
      if (profile.artistProfile?.Artist_Type === 'Band') {
        const { data: bandData } = await supabase
          .from('BAND')
          .select('Band_Name')
          .eq('ARTIST_ID', profile.artistProfile.ARTIST_ID)
          .maybeSingle()

        if (bandData?.Band_Name) {
          artistName.value = bandData.Band_Name
        } else if (profile.artistProfile?.StageName) {
          artistName.value = profile.artistProfile.StageName
        } else if (profile.account?.Username) {
          artistName.value = profile.account.Username
        }
      } else if (profile.artistProfile?.Artist_Type === 'Solo') {
        const { data: soloData } = await supabase
          .from('SOLO_ARTIST')
          .select('Artist_Name')
          .eq('ARTIST_ID', profile.artistProfile.ARTIST_ID)
          .maybeSingle()

        if (soloData?.Artist_Name) {
          artistName.value = soloData.Artist_Name
        } else if (profile.artistProfile?.StageName) {
          artistName.value = profile.artistProfile.StageName
        } else if (profile.account?.Username) {
          artistName.value = profile.account.Username
        }
      } else if (profile.artistProfile?.StageName) {
        artistName.value = profile.artistProfile.StageName
      } else if (profile.account?.Username) {
        artistName.value = profile.account.Username
      }

      if (profile.artistProfile?.Bio) {
        artistBio.value = profile.artistProfile.Bio
      }

      usertype.value = resolveUserType(profile)
      artistGenres.value = profile.genres || []
      artistInstruments.value = profile.instruments || []
      artistTags.value = [...artistGenres.value, ...artistInstruments.value]
    }
  } catch (error) {
    console.error('Error fetching profile:', error)
  } finally {
    isLoading.value = false
  }
})

const openEditDetails = () => {
  isEditDetailsOpen.value = true
}

const onProfileDetailsSaved = (data: {
  name: string
  bio: string
  genres: string[]
  instruments: string[]
}) => {
  artistName.value = data.name
  artistBio.value = data.bio
  artistGenres.value = data.genres
  artistInstruments.value = data.instruments
  artistTags.value = [...data.genres, ...data.instruments]
}

const triggerAvatarSelect = () => {
  avatarInputRef.value?.click()
}

const triggerCoverSelect = () => {
  coverInputRef.value?.click()
}

const repositionAvatar = () => {
  if (!profilePicture.value) return
  cropperMode.value = 'avatar'
  cropperImageSource.value = profilePicture.value
  isCropperOpen.value = true
}

const repositionCover = () => {
  if (!coverPicture.value) return
  cropperMode.value = 'cover'
  cropperImageSource.value = coverPicture.value
  isCropperOpen.value = true
}

const onAvatarChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const validation = validateImageFile(file, 15)
  if (!validation.valid) {
    uploadError.value = validation.error || 'Invalid image file.'
    target.value = ''
    return
  }

  cropperMode.value = 'avatar'
  cropperImageSource.value = file
  isCropperOpen.value = true
  target.value = ''
}

const onCoverChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const validation = validateImageFile(file, 20)
  if (!validation.valid) {
    uploadError.value = validation.error || 'Invalid image file.'
    target.value = ''
    return
  }

  cropperMode.value = 'cover'
  cropperImageSource.value = file
  isCropperOpen.value = true
  target.value = ''
}

const onCropperApply = async (croppedBlob: Blob) => {
  isCropperOpen.value = false
  try {
    if (cropperMode.value === 'avatar') {
      const result = await uploadAvatar(croppedBlob, profilePicture.value)
      if (result?.url) {
        profilePicture.value = result.url
        globalAvatarUrl.value = result.url
      }
    } else {
      const result = await uploadCover(croppedBlob, coverPicture.value)
      if (result?.url) {
        coverPicture.value = result.url
      }
    }
  } catch (err) {
    console.error('Failed to upload cropped image:', err)
  }
}

const handleLogout = async () => {
  await supabase.auth.signOut()
  await navigateTo('/Login')
}
</script>

<template>
  <div class="h-full bg-[#0E0E10] text-white flex flex-col min-h-screen pb-16 overflow-x-hidden">
    <!-- Media Cropper Modal -->
    <MediaCropperModal :is-open="isCropperOpen" :image-source="cropperImageSource" :mode="cropperMode"
      @close="isCropperOpen = false" @apply="onCropperApply" />

    <!-- Edit Profile Details Modal -->
    <ArtistEditDetailsModal :is-open="isEditDetailsOpen" :artist-id="artistId" :artist-type="artistType"
      :initial-name="artistName" :initial-bio="artistBio" :initial-genres="artistGenres"
      :initial-instruments="artistInstruments" @close="isEditDetailsOpen = false" @saved="onProfileDetailsSaved" />

    <!-- Hidden File Inputs -->
    <input ref="avatarInputRef" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden"
      @change="onAvatarChange" />
    <input ref="coverInputRef" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden"
      @change="onCoverChange" />

    <!-- Header Banner & Profile Info -->
    <div class="relative w-full overflow-hidden bg-[#131315] border-b border-[#46464D]/20">
      <!-- Background Banner Image -->
      <div class="absolute inset-0 z-0">
        <div v-if="isLoading" class="w-full h-full bg-[#1E1E24] animate-pulse"></div>
        <img v-else :src="coverPicture || ''" alt="Profile Banner"
          class="w-full h-full object-cover object-center opacity-70 mask-x-from-70% mask-x-to-90%" />
        <!-- Soft gradient overlay for contrast on both mobile and desktop -->
        <div
          class="absolute inset-0 bg-linear-to-t from-[#0E0E10] via-[#0E0E10]/40 to-transparent md:bg-linear-to-r md:from-[#0E0E10]/90 md:via-[#0E0E10]/60 md:to-transparent">
        </div>
      </div>

      <!-- Update / Reposition Cover Action Buttons -->
      <div v-if="!isLoading"
        class="absolute top-4 right-4 sm:top-6 sm:right-8 md:right-16 z-20 flex items-center gap-2">
        <button v-if="coverPicture" @click="repositionCover" :disabled="isUploadingCover"
          class="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/10 text-xs sm:text-sm text-gray-200 hover:text-white transition-all cursor-pointer shadow-lg group"
          title="Adjust cover framing">
          <Icon name="ic:round-crop" class="text-base text-[#C7C5CE] group-hover:text-[#D0D4F7] transition-colors" />
          <span class="hidden xs:inline">Reposition</span>
        </button>

        <button @click="triggerCoverSelect" :disabled="isUploadingCover"
          class="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/10 text-xs sm:text-sm text-gray-200 hover:text-white transition-all cursor-pointer shadow-lg group">
          <Icon v-if="isUploadingCover" name="ic:baseline-sync" class="animate-spin text-base text-[#D0D4F7]" />
          <Icon v-else name="ic:outline-photo-camera"
            class="text-base text-[#C7C5CE] group-hover:text-[#D0D4F7] transition-colors" />
          <span>{{ isUploadingCover ? 'Uploading...' : (coverPicture ? 'Change Cover' : 'Add Cover') }}</span>
        </button>
      </div>

      <!-- Loading Skeleton for Header -->
      <div v-if="isLoading"
        class="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-8 sm:py-10 min-h-75 md:min-h-85 flex flex-col-reverse md:flex-row items-center md:items-end justify-between gap-6 animate-pulse">
        <div class="flex flex-col items-center md:items-start gap-3 w-full md:w-auto">
          <div class="h-4 w-24 bg-[#1E1E24] rounded-md"></div>
          <div class="h-12 sm:h-16 w-64 sm:w-80 max-w-full bg-[#1E1E24] rounded-xl"></div>
          <div class="h-4 w-48 sm:w-64 max-w-full bg-[#1E1E24] rounded-md"></div>
          <div class="h-5 w-48 sm:w-60 max-w-full bg-[#1E1E24] rounded-md"></div>
        </div>
        <div
          class="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full bg-[#1E1E24] border border-[#46464D]/30 shrink-0">
        </div>
      </div>

      <!-- Loaded Header Info -->
      <div v-else
        class="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-8 sm:py-10 min-h-75 md:min-h-85 flex flex-col-reverse md:flex-row items-center md:items-end justify-between gap-6">
        <!-- Left: Details -->
        <div class="flex flex-col items-center md:items-start text-center md:text-left gap-1.5 min-w-0 max-w-full">
          <span class="font-Geist font-medium text-xs sm:text-[14px] text-[#D0D4F7]/90 tracking-wider uppercase">
            {{ usertype || 'Artist' }}
          </span>
          <h1
            class="font-Sora font-bold text-3xl sm:text-5xl lg:text-[64px] tracking-tight text-white leading-tight wrap-break-word max-w-full">
            {{ artistName || 'Artist' }}
          </h1>
          <div class="max-w-xl my-1">
            <p v-if="artistBio"
              class="text-xs sm:text-sm md:text-[15px] text-gray-200/90 leading-relaxed line-clamp-3 md:line-clamp-4">
              {{ artistBio }}
            </p>
            <p v-else class="text-xs sm:text-sm text-gray-400/70 italic">
              No bio yet. Click Update Profile Details to add your story.
            </p>
          </div>
          <div
            class="flex flex-wrap items-center justify-center md:justify-start gap-2 bg-black/50 backdrop-blur-xs px-3 py-1.5 rounded-lg max-w-full border border-white/5">
            <span class="font-HankenGrotesk text-xs sm:text-[15px] text-gray-400 font-bold shrink-0">
              Artist Tags:
            </span>
            <span class="text-xs sm:text-[15px] text-[#D0D4F7] font-medium wrap-break-word">
              {{ tagsDisplay }}
            </span>
          </div>

          <!-- Update Profile Details Button -->
          <button @click="openEditDetails"
            class="mt-2.5 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1E1E24] hover:bg-[#2A2A32] border border-[#46464D]/60 hover:border-[#D0D4F7]/60 text-xs sm:text-sm font-medium text-gray-200 hover:text-white transition-all cursor-pointer shadow-md group">
            <Icon name="ic:outline-edit"
              class="text-base text-[#C7C5CE] group-hover:text-[#D0D4F7] transition-colors" />
            <span>Update Profile Details</span>
          </button>

          <!-- Error Alert if Upload Fails -->
          <p v-if="uploadError"
            class="text-xs sm:text-sm text-red-400 mt-2 bg-red-950/40 border border-red-800/40 px-3 py-1 rounded-md">
            {{ uploadError }}
          </p>
        </div>

        <!-- Right: Avatar & Edit button -->
        <div class="flex flex-col justify-center items-center shrink-0">
          <div @click="triggerAvatarSelect"
            class="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 bg-[#353437] rounded-full flex items-center justify-center text-gray-500 overflow-hidden shadow-2xl border-2 border-[#46464D]/50 relative group cursor-pointer"
            title="Click to change profile picture">
            <!-- Dynamic Avatar or Fallback Icon -->
            <img v-if="profilePicture" :src="profilePicture" alt="Profile Avatar"
              class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" />
            <Icon v-else name="ic:outline-account-circle" class="w-full h-full text-[#46464D]" />

            <!-- Hover / Upload Overlay -->
            <div
              class="absolute inset-0 bg-black/55 backdrop-blur-xs flex flex-col items-center justify-center transition-opacity"
              :class="isUploadingAvatar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'">
              <Icon v-if="isUploadingAvatar" name="ic:baseline-sync"
                class="text-2xl sm:text-3xl text-[#D0D4F7] animate-spin" />
              <template v-else>
                <Icon name="ic:outline-photo-camera" class="text-xl sm:text-2xl text-white mb-0.5" />
                <span class="text-[10px] sm:text-xs text-[#D0D4F7] font-medium tracking-wide">
                  {{ profilePicture ? 'Change' : 'Upload' }}
                </span>
              </template>
            </div>
          </div>
          <div v-if="profilePicture" class="flex items-center gap-2 mt-3">
            <button @click="repositionAvatar" :disabled="isUploadingAvatar"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/70 border border-white/10 text-xs text-gray-300 hover:text-[#D0D4F7] transition-all cursor-pointer shadow-sm group"
              title="Reposition profile picture">
              <Icon name="ic:round-crop" class="text-sm text-[#C7C5CE] group-hover:text-[#D0D4F7] transition-colors" />
              <span>Reposition Photo</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="w-full border-b border-[#46464D]/20 bg-[#0E0E10]">
      <div class="max-w-7xl mx-auto px-4 sm:px-8 md:px-16 overflow-x-auto scrollbar-hide">
        <div class="flex gap-8 sm:gap-12 text-[15px] sm:text-[17px] min-w-max">
          <button @click="activeTab = 'posts'" class="font-Sora cursor-pointer transition-colors"
            :class="activeTab === 'posts' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
            <span class="inline-block py-4 sm:py-5"
              :class="activeTab === 'posts' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
              Posts
            </span>
          </button>

          <button @click="activeTab = 'calendar'" class="font-Sora cursor-pointer transition-colors"
            :class="activeTab === 'calendar' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
            <span class="inline-block py-4 sm:py-5 "
              :class="activeTab === 'calendar' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
              Calendar
            </span>
          </button>

          <button @click="activeTab = 'portfolio'" class="font-Sora cursor-pointer transition-colors"
            :class="activeTab === 'portfolio' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
            <span class="inline-block py-4 sm:py-5"
              :class="activeTab === 'portfolio' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
              Portfolio
            </span>
          </button>

          <button @click="activeTab = 'contact'" class="font-Sora cursor-pointer transition-colors"
            :class="activeTab === 'contact' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
            <span class="inline-block py-4 sm:py-5"
              :class="activeTab === 'contact' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
              Contact
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <main class="max-w-7xl mx-auto w-full px-4 sm:px-8 md:px-16 mt-6 sm:mt-8">
      <!-- Loading Skeleton for Feed & Sidebar -->
      <div v-if="isLoading" class="flex flex-col lg:flex-row gap-6 items-start w-full animate-pulse">
        <div class="flex-1 w-full min-w-0 flex flex-col gap-6">
          <div class="h-32 sm:h-40 rounded-xl bg-[#1E1E24]"></div>
          <div class="h-96 rounded-xl bg-[#1E1E24]"></div>
        </div>
        <div class="w-full lg:w-80 xl:w-92 h-80 rounded-xl bg-[#1E1E24] shrink-0"></div>
      </div>

      <!-- Loaded Content -->
      <div v-else>
        <!-- Posts Tab Content -->
        <div v-if="activeTab === 'posts'" class="flex flex-col lg:flex-row gap-6 items-start w-full">
          <!-- Left: Feed Column -->
          <div class="flex-1 w-full min-w-0 flex flex-col gap-6">
            <!-- Create Post Card -->
            <div
              class="flex gap-2 flex-col items-center justify-center p-6 sm:p-10 md:p-12 border border-[#46464D] border-dashed rounded-xl min-h-35 sm:h-46.25 transition-all hover:border-[#D0D4F7] hover:bg-[#D0D4F7]/5 group cursor-pointer w-full">
              <div
                class="flex border p-2.5 sm:p-3 rounded-full border-[#46464D] group-hover:border-[#D0D4F7] transition-colors">
                <Icon name="ic:baseline-plus" class="text-xl text-[#C7C5CE] group-hover:text-[#D0D4F7]" />
              </div>
              <h2
                class="font-Geist font-medium text-xs sm:text-[14px] text-[#C7C5CE] group-hover:text-[#D0D4F7] transition-all tracking-wide">
                CREATE A POST
              </h2>
            </div>

            <!-- Post Card -->
            <article class="bg-[#1B1B1D] border border-[#46464D]/40 rounded-xl overflow-hidden w-full shadow-lg">
              <div class="w-full aspect-video sm:aspect-21/9 md:aspect-video max-h-137.5 overflow-hidden bg-black/40">
                <img src="https://images.unsplash.com/photo-1468392788711-903a924761a6" alt="Post Media"
                  class="object-cover w-full h-full hover:scale-[1.02] transition-transform duration-500" />
              </div>

              <div class="flex flex-col gap-4 p-4 sm:p-6">
                <div>
                  <h3 class="font-Sora text-base sm:text-[18px] font-semibold text-white">
                    {{ artistName || 'Artist' }}
                  </h3>
                  <span class="font-HankenGrotesk text-xs text-[#C7C5CE]">2 hours ago</span>
                </div>

                <div>
                  <p class="text-sm sm:text-base text-gray-300 leading-relaxed">
                    Post Caption goes here. "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
                    tempor
                    incididunt ut labore et dolore magna aliqua. We've been experimenting with these new textures
                    lately."
                  </p>
                </div>

                <div class="flex justify-between items-center pt-2 border-t border-[#46464D]/20 text-sm">
                  <div class="flex gap-4 sm:gap-6 items-center">
                    <button
                      class="flex gap-1.5 items-center text-[#C7C5CE] hover:text-[#D0D4F7] transition-colors cursor-pointer">
                      <Icon name="ic:baseline-favorite-border" class="text-xl sm:text-2xl" />
                      <span class="text-xs sm:text-sm font-medium">1.2k</span>
                    </button>

                    <button
                      class="flex gap-1.5 items-center text-[#C7C5CE] hover:text-[#D0D4F7] transition-colors cursor-pointer">
                      <Icon name="ic:sharp-chat-bubble-outline" class="text-xl sm:text-2xl" />
                      <span class="text-xs sm:text-sm font-medium">1.3k</span>
                    </button>
                  </div>

                  <button class="text-[#C7C5CE] hover:text-[#D0D4F7] transition-colors cursor-pointer"
                    title="Share Post">
                    <Icon name="ic:round-share" class="text-xl sm:text-2xl" />
                  </button>
                </div>
              </div>
            </article>
          </div>

          <!-- Right: Upcoming Events Sidebar -->
          <aside
            class="w-full lg:w-80 xl:w-92 shrink-0 bg-[#1B1B1D] border border-[#46464D]/30 rounded-xl p-5 sm:p-6 flex flex-col justify-between gap-6 shadow-lg">
            <div class="flex flex-col gap-4">
              <h2 class="font-Sora text-lg sm:text-[20px] text-[#D0D4F7] font-semibold">
                Upcoming Events
              </h2>

              <div class="flex flex-col gap-3 sm:gap-4">
                <div
                  class="flex items-center gap-3 sm:gap-4 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                  <div
                    class="flex p-2.5 sm:p-3 border border-[#B4B8DA]/20 rounded-lg bg-[#B4B8DA]/10 items-center justify-center w-12 h-12 sm:w-14 sm:h-14 shrink-0 text-center">
                    <div class="flex flex-col font-HankenGrotesk leading-tight">
                      <span class="text-sm sm:text-base font-bold text-white">24</span>
                      <span class="text-[10px] text-[#D0D4F7] uppercase tracking-wider font-semibold">OCT</span>
                    </div>
                  </div>

                  <div class="flex flex-col min-w-0">
                    <h4 class="font-medium text-sm sm:text-base text-white truncate">Neon Nights Live</h4>
                    <p class="text-xs text-gray-400 truncate">Quezon City, Manila</p>
                  </div>
                </div>

                <div
                  class="flex items-center gap-3 sm:gap-4 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                  <div
                    class="flex p-2.5 sm:p-3 border border-[#B4B8DA]/20 rounded-lg bg-[#B4B8DA]/10 items-center justify-center w-12 h-12 sm:w-14 sm:h-14 shrink-0 text-center">
                    <div class="flex flex-col font-HankenGrotesk leading-tight">
                      <span class="text-sm sm:text-base font-bold text-white">28</span>
                      <span class="text-[10px] text-[#D0D4F7] uppercase tracking-wider font-semibold">OCT</span>
                    </div>
                  </div>

                  <div class="flex flex-col min-w-0">
                    <h4 class="font-medium text-sm sm:text-base text-white truncate">Acoustic Session</h4>
                    <p class="text-xs text-gray-400 truncate">BGC, Taguig</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              class="w-full flex items-center justify-center p-3 border rounded-lg border-[#D0D4F7]/60 hover:border-[#D0D4F7] hover:bg-[#D0D4F7]/10 font-Geist font-medium text-xs sm:text-sm text-[#D0D4F7] transition-all cursor-pointer">
              <span>VIEW ALL EVENTS</span>
            </button>
          </aside>
        </div>

        <!-- Calendar Tab Content Container -->
        <div v-else-if="activeTab === 'calendar'" class="w-full">
          <!-- Add Calendar content here -->
          <div
            class="w-full min-h-100 border border-[#46464D]/40 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-[#131315]/50">
            <div
              class="w-14 h-14 rounded-full bg-[#1E1E24] border border-[#46464D]/50 flex items-center justify-center mb-4">
              <Icon name="ic:outline-calendar-month" class="text-2xl text-[#D0D4F7]" />
            </div>
            <h3 class="font-Sora text-lg font-semibold text-white mb-2">Calendar</h3>
            <p class="text-sm text-gray-400 max-w-md">Schedule, tour dates, and bookings will appear here.</p>
          </div>
        </div>

        <!-- Portfolio Tab Content Container -->
        <div v-else-if="activeTab === 'portfolio'" class="w-full flex flex-col gap-6 sm:gap-8">

          <!-- Sticky Floating Banner for Active Editing Section -->
          <div v-if="activeEditingSection"
            class="sticky top-20 z-40 w-full bg-[#131315]/95 backdrop-blur-md border border-[#46464D]/60 rounded-xl px-4 sm:px-6 py-3 flex items-center justify-between shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div class="flex items-center gap-2.5">
              <span class="w-2.5 h-2.5 rounded-full bg-[#D0D4F7] animate-pulse"></span>
              <span class="text-xs font-mono tracking-wider uppercase text-gray-200 font-semibold">
                EDITING MODE: {{ sectionTitleMap[activeEditingSection] }}
              </span>
            </div>
          </div>

          <!-- Top Row: Media Showcase (8 cols on lg) & Released Songs (4 cols on lg) -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            <!-- Left Column: Media Articles (Accommodates multiple media items, max 5) -->
            <div class="lg:col-span-8 flex flex-col gap-4 transition-all"
              :class="activeEditingSection === 'media' ? 'p-3.5 sm:p-5 rounded-2xl border-2 border-dashed border-[#D0D4F7]/60 bg-[#D0D4F7]/2' : ''">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <h1 class="text-xl font-Sora font-medium text-white">Media</h1>
                  <span v-if="activeEditingSection === 'media'"
                    class="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#1E1E24] border border-[#46464D]/50 text-[#D0D4F7]">
                    {{ draftMediaItems.length }} / 5
                  </span>
                </div>

                <div v-if="isOwner" class="flex items-center gap-1.5">
                  <button v-if="activeEditingSection !== 'media'" @click="startPortfolioEditing('media')"
                    class="flex hover:flex p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    title="Edit Media Section">
                    <Icon name="ic:outline-edit" class="text-lg text-[#D0D4F7]" />
                  </button>
                  <template v-else>
                    <button @click="handleSaveActiveSection" :disabled="isPortfolioSaving"
                      class="flex p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Save Changes">
                      <Icon v-if="isPortfolioSaving" name="ic:baseline-sync" class="animate-spin text-xl" />
                      <Icon v-else name="ic:round-check" class="text-xl" />
                    </button>
                    <button @click="handleCancelEditing" :disabled="isPortfolioSaving"
                      class="flex p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Discard Changes">
                      <Icon name="ic:round-close" class="text-xl" />
                    </button>
                  </template>
                </div>
              </div>

              <!-- Editing Mode: Draft Media Items -->
              <div v-if="activeEditingSection === 'media'" class="flex flex-col gap-5">
                <article v-for="(item, idx) in draftMediaItems" :key="item.id || idx"
                  class="relative bg-[#1C1C1F]/80 border border-[#46464D]/50 rounded-xl overflow-hidden shadow-lg p-3 sm:p-4 space-y-3">
                  <!-- Actions: Edit & Remove -->
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-mono text-gray-400">#{{ idx + 1 }}: {{ item.title || 'Featured Media'
                      }}</span>
                    <div class="flex items-center gap-2">
                      <button @click="openEditMedia(idx)"
                        class="p-1 text-[#D0D4F7] hover:text-white hover:bg-[#D0D4F7]/10 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1"
                        title="Edit Media">
                        <Icon name="ic:outline-edit" class="text-base" />
                        <span>Edit</span>
                      </button>
                      <button @click="removeDraftMedia(idx)"
                        class="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1"
                        title="Remove Media">
                        <Icon name="ic:round-delete-outline" class="text-base" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>

                  <MediaEmbed :url="item.url" :title="item.title" />

                  <div class="space-y-1">
                    <h3 v-if="item.title" class="font-Sora text-sm sm:text-base font-semibold text-white">
                      {{ item.title }}
                    </h3>
                    <p v-if="item.displayText" class="text-xs sm:text-sm text-gray-300 leading-relaxed">
                      {{ item.displayText }}
                    </p>
                  </div>
                </article>

                <!-- Add Media Button (if under 5) -->
                <button v-if="draftMediaItems.length < 5" @click="openAddMedia"
                  class="w-full py-5 border-2 border-dashed border-[#46464D]/60 hover:border-[#D0D4F7] rounded-xl text-xs sm:text-sm font-medium text-gray-300 hover:text-[#D0D4F7] transition-all flex items-center justify-center gap-2 cursor-pointer bg-[#1C1C1F]/40 hover:bg-[#1C1C1F]/70">
                  <Icon name="ic:round-add" class="text-xl text-[#D0D4F7]" />
                  <span>Add Media Article ({{ draftMediaItems.length }} / 5)</span>
                </button>
              </div>

              <!-- Live Mode: Saved Media Items -->
              <div v-else class="flex flex-col gap-6">
                <!-- If items exist in DB -->
                <template v-if="mediaItems.length > 0">
                  <article v-for="item in mediaItems" :key="item.id"
                    class="bg-[#1C1C1F]/60 border border-[#46464D]/40 rounded-xl overflow-hidden w-full shadow-lg">
                    <div class="p-3 sm:p-4">
                      <MediaEmbed :url="item.url" :title="item.title" />
                    </div>

                    <div class="flex flex-col gap-2 p-4 sm:py-4 sm:pt-0">
                      <h3 v-if="item.title" class="font-Sora text-base sm:text-[18px] font-semibold text-white">
                        {{ item.title }}
                      </h3>
                      <p v-if="item.displayText" class="text-sm sm:text-base text-gray-300 leading-relaxed">
                        {{ item.displayText }}
                      </p>
                    </div>
                  </article>
                </template>

                <!-- Sample Default Preview (if no items saved yet) -->
                <article v-else
                  class="bg-[#1C1C1F]/60 border border-[#46464D]/40 rounded-xl overflow-hidden w-full shadow-lg">
                  <div
                    class="w-full aspect-video sm:aspect-21/9 md:aspect-video max-h-137.5 overflow-hidden bg-black/40">
                    <div class="w-full max-w-3xl aspect-video mx-auto">
                      <iframe class="w-full h-full rounded-lg shadow-lg" src="" title="Responsive Video Player"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen>
                      </iframe>
                    </div>
                  </div>

                  <div class="flex flex-col gap-4 p-4 sm:p-6">
                    <div>
                      <h3 class="font-Sora text-base sm:text-[18px] font-semibold text-white">
                        {{ artistName || 'Artist' }}
                      </h3>
                    </div>

                    <div>
                      <p class="text-sm sm:text-base text-gray-300 leading-relaxed">
                        Caption
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            </div>

            <!-- Right Column: Released Songs Audio (Exclusively Spotify & SoundCloud) -->
            <div class="lg:col-span-4 flex flex-col gap-4 transition-all"
              :class="activeEditingSection === 'songs' ? 'p-3.5 sm:p-5 rounded-2xl border-2 border-dashed border-[#D0D4F7]/60 bg-[#D0D4F7]/2' : ''">
              <div class="flex items-center justify-between">
                <h1 class="text-xl font-Sora font-medium text-white">Released Songs</h1>

                <div v-if="isOwner" class="flex items-center gap-1.5">
                  <button v-if="activeEditingSection !== 'songs'" @click="startPortfolioEditing('songs')"
                    class="flex hover:flex p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    title="Edit Released Songs">
                    <Icon name="ic:outline-edit" class="text-lg text-[#D0D4F7]" />
                  </button>
                  <template v-else>
                    <button @click="handleSaveActiveSection" :disabled="isPortfolioSaving"
                      class="flex p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Save Changes">
                      <Icon v-if="isPortfolioSaving" name="ic:baseline-sync" class="animate-spin text-xl" />
                      <Icon v-else name="ic:round-check" class="text-xl" />
                    </button>
                    <button @click="handleCancelEditing" :disabled="isPortfolioSaving"
                      class="flex p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Discard Changes">
                      <Icon name="ic:round-close" class="text-xl" />
                    </button>
                  </template>
                </div>
              </div>

              <!-- Editing Mode: Draft Songs -->
              <div v-if="activeEditingSection === 'songs'" class="flex flex-col gap-4">
                <div v-for="(audio, idx) in draftAudioItems" :key="audio.id || idx"
                  class="bg-[#1C1C1F]/80 border border-[#46464D]/50 rounded-xl p-3.5 shadow-md space-y-2 relative">
                  <div class="flex items-center justify-end">
                    
                    <div class="flex items-center gap-2 shrink-0">
                      <button @click="openEditAudio(idx)"
                        class="p-1 text-[#D0D4F7] hover:text-white hover:bg-[#D0D4F7]/10 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1"
                        title="Edit Song">
                        <Icon name="ic:outline-edit" class="text-base" />
                        <span>Edit</span>
                      </button>
                      <button @click="removeDraftAudio(idx)"
                        class="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-0.5"
                        title="Remove Song">
                        <Icon name="ic:round-delete-outline" class="text-base" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                  <span class="text-xs font-semibold text-white font-Sora truncate">{{ audio.title || 'Song' }}</span>
                  <div class="flex gap-1">
                    <p v-if="audio.displayText" class="text-xs text-gray-400 flex font-bold">
                      Release Notes / Details:
                    </p>
                    <p v-if="audio.displayText" class="text-xs text-gray-400 flex">
                      {{ audio.displayText }}
                    </p>
                  </div>
                 
                  <MediaEmbed :url="audio.url" :title="audio.title" />
                </div>

                <!-- Add Original Song Dashed Box -->
                <button @click="openAddAudio"
                  class="w-full py-4 border-2 border-dashed border-[#46464D]/60 hover:border-[#D0D4F7] rounded-xl text-xs sm:text-sm font-medium text-gray-300 hover:text-[#D0D4F7] transition-all flex items-center justify-center gap-2 cursor-pointer bg-[#1E1E24]/40 hover:bg-[#1E1E24]/70">
                  <Icon name="ic:baseline-add-circle-outline" class="text-lg text-[#D0D4F7]" />
                  <span>Add Original Song</span>
                </button>
              </div>

              <!-- Live Mode: Saved Audio Cards -->
              <div v-else
                class="bg-[#1C1C1F]/60 border rounded-xl border-[#46464D]/40 p-4 sm:p-6 flex flex-col gap-4 shadow-lg">
                <!-- If audio saved in DB -->
                <template v-if="audioItems.length > 0">
                  <div v-for="audio in audioItems" :key="audio.id" class="space-y-1.5 border border-[#303035] rounded-xl">
                    <div class="flex flex-col gap-2 pl-3 pt-2">
                      <div class="flex items-center gap-1">
                        <h1 class="text-xs">Title:</h1>
                        <p v-if="audio.displayText" class="text-xs text-gray-400 rounded w-fit font-bold">
                        {{ audio.title || 'Song' }}
                      </p>
                      </div>
                      
                      <div class="flex items-center gap-1">
                        <h1 class="text-xs">Notes / Details:</h1>
                        <p v-if="audio.displayText" class="text-xs text-gray-400 rounded w-fit font-bold">
                        {{ audio.displayText }}
                      </p>
                      </div>
                    </div>
                    <MediaEmbed :url="audio.url" :title="audio.title" />
                  </div>
                </template>

                <!-- Empty State Placeholders (if no songs saved yet) -->
                <template v-else>
                  <!-- Primary Track Placeholder Slot -->
                  <div
                    class="w-full h-37 rounded-xl border-2 border-dashed border-[#46464D]/50 bg-[#16161A]/50 flex flex-col items-center justify-center p-4 text-center transition-all group hover:border-[#D0D4F7]/40">
                    <div
                      class="w-10 h-10 rounded-full bg-[#1E1E24] border border-[#46464D]/60 flex items-center justify-center text-[#D0D4F7] mb-2 shadow-inner group-hover:scale-105 transition-transform">
                      <Icon name="ic:outline-music-note" class="text-xl" />
                    </div>
                    <p class="font-Sora text-xs sm:text-sm font-semibold text-gray-200">
                      No Released Songs
                    </p>
                    <p class="text-[11px] text-gray-400 mt-0.5">
                      Spotify or SoundCloud tracks will appear here
                    </p>
                    <button v-if="isOwner" @click="startPortfolioEditing('songs')"
                      class="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[#D0D4F7] hover:text-white transition-colors cursor-pointer">
                      <Icon name="ic:baseline-add" class="text-xs" />
                      <span>Add Song</span>
                    </button>
                  </div>
                </template>
              </div>
            </div>

          </div>

          <!-- Middle Row: Milestones & Achievements -->
          <div
            class="bg-[#1C1C1F]/60 border rounded-xl border-[#46464D]/40 p-5 sm:p-6 flex flex-col gap-5 shadow-lg transition-all"
            :class="activeEditingSection === 'milestones' ? 'border-2 border-dashed border-[#D0D4F7]/60 bg-[#D0D4F7]/2' : ''">
            <div class="flex items-center justify-between">
              <h1 class="text-xl font-Sora font-medium text-white">MILESTONES & ACHIEVEMENTS</h1>

              <div v-if="isOwner" class="flex items-center gap-1.5">
                <button v-if="activeEditingSection !== 'milestones'"
                  @click="startPortfolioEditing('milestones')"
                  class="flex hover:flex p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  title="Edit Milestones">
                  <Icon name="ic:outline-edit" class="text-lg text-[#D0D4F7]" />
                </button>
                <template v-else>
                  <button @click="handleSaveActiveSection" :disabled="isPortfolioSaving"
                    class="flex p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    title="Save Changes">
                    <Icon v-if="isPortfolioSaving" name="ic:baseline-sync" class="animate-spin text-xl" />
                    <Icon v-else name="ic:round-check" class="text-xl" />
                  </button>
                  <button @click="handleCancelEditing" :disabled="isPortfolioSaving"
                    class="flex p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    title="Discard Changes">
                    <Icon name="ic:round-close" class="text-xl" />
                  </button>
                </template>
              </div>
            </div>

            <!-- Editing Mode: Draft Milestones -->
            <div v-if="activeEditingSection === 'milestones'"
              class="flex items-start gap-6 sm:gap-8 md:gap-10 overflow-x-auto scrollbar-thin pt-3 pb-3 px-2">
              <div v-for="(m, idx) in draftMilestones" :key="m.id || idx"
                class="relative flex flex-col gap-2.5 items-center justify-center shrink-0 group hover:z-30">
                <!-- Milestone Circular Avatar Wrapper -->
                <div class="relative w-24 h-24 sm:w-28 sm:h-28 md:w-30 md:h-30 shrink-0">
                  <!-- The Circle Canvas -->
                  <div
                    class="w-full h-full rounded-full overflow-hidden border-2 border-dashed border-[#D0D4F7] shadow-lg flex items-center justify-center bg-linear-to-br from-[#26262E] to-[#151518]">
                    <img v-if="m.fileUrl" :src="m.fileUrl" :alt="m.title || 'Milestone'" class="w-full h-full object-cover" />
                    <div v-else class="flex items-center justify-center w-full h-full select-none">
                      <span class="font-Sora font-bold text-lg sm:text-xl md:text-2xl text-[#D0D4F7] tracking-wider">
                        {{ getMilestoneInitials(m.title) }}
                      </span>
                    </div>
                  </div>

                  <!-- Action Badges: Edit & Delete -->
                  <button
                    type="button"
                    @click.stop="openEditMilestone(idx)"
                    class="absolute -top-1 -left-1 z-30 w-7 h-7 rounded-full bg-[#1E1E24] border border-[#D0D4F7]/80 text-[#D0D4F7] hover:text-white flex items-center justify-center hover:bg-[#282832] transition-all cursor-pointer shadow-lg hover:scale-110"
                    title="Edit Milestone">
                    <Icon name="ic:outline-edit" class="text-xs" />
                  </button>
                  <button
                    type="button"
                    @click.stop="removeDraftMilestone(idx)"
                    class="absolute -top-1 -right-1 z-30 w-7 h-7 rounded-full bg-red-950 border border-red-700 text-red-300 hover:text-white flex items-center justify-center hover:bg-red-800 transition-all cursor-pointer shadow-lg hover:scale-110"
                    title="Remove Milestone">
                    <Icon name="ic:round-delete-outline" class="text-xs" />
                  </button>
                </div>

                <div class="text-center max-w-28 sm:max-w-32">
                  <h2 class="text-xs sm:text-sm font-semibold text-white font-Sora">{{ m.title }}</h2>
                  <span v-if="m.eventDate" class="text-[11px] text-gray-400">{{ m.eventDate }}</span>
                </div>
              </div>

              <!-- Add Milestone Circular Button -->
              <div @click="openAddMilestone"
                class="flex flex-col gap-3 items-center justify-center shrink-0 cursor-pointer group">
                <div
                  class="w-24 h-24 sm:w-28 sm:h-28 md:w-30 md:h-30 bg-[#646464]/20 rounded-full font-Sora flex items-center justify-center border-2 border-dashed border-[#D0D4F7]/60 group-hover:border-[#D0D4F7] transition-all">
                  <Icon name="ic:baseline-plus"
                    class="text-2xl text-[#D0D4F7] group-hover:scale-110 transition-transform" />
                </div>
                <h2 class="text-xs sm:text-sm font-medium text-center text-gray-300 group-hover:text-white">Add
                  Milestone
                </h2>
              </div>
            </div>

            <!-- Live Mode: Saved Milestones -->
            <div v-else class="flex items-start gap-6 sm:gap-8 md:gap-10 overflow-x-auto pb-2 scrollbar-thin">
              <template v-if="milestoneItems.length > 0">
                <div v-for="m in milestoneItems" :key="m.id"
                  class="flex flex-col gap-2.5 items-center justify-center shrink-0">
                  <div
                    class="w-24 h-24 sm:w-28 sm:h-28 md:w-30 md:h-30 rounded-full overflow-hidden border-2 border-[#D0D4F7]/60 shadow-lg bg-[#1E1E24] flex items-center justify-center bg-linear-to-br from-[#26262E] to-[#151518]">
                    <img v-if="m.fileUrl" :src="m.fileUrl" :alt="m.title || 'Milestone'" class="w-full h-full object-cover" />
                    <div v-else class="flex items-center justify-center w-full h-full select-none">
                      <span class="font-Sora font-bold text-lg sm:text-xl md:text-2xl text-[#D0D4F7] tracking-wider">
                        {{ getMilestoneInitials(m.title) }}
                      </span>
                    </div>
                  </div>
                  <div class="text-center max-w-28 sm:max-w-32">
                    <h2 class="text-xs sm:text-sm font-semibold text-white font-Sora">{{ m.title }}</h2>
                    <span v-if="m.eventDate" class="text-[11px] text-gray-400">{{ m.eventDate }}</span>
                  </div>
                </div>
              </template>

              <!-- Sample Milestones (if none saved yet) -->
              <template v-else>
                <div class="flex flex-col gap-3 items-center justify-center shrink-0">
                  <div class="w-24 h-24 sm:w-28 sm:h-28 md:w-30 md:h-30 bg-[#646464] rounded-full font-Sora"></div>
                  <h1 class="text-[1rem] font-medium text-center">Milestone</h1>
                </div>
              </template>
            </div>
          </div>

          <!-- Bottom Row: Promotional Materials (Max 4 Posters, Responsive Grid) -->
          <div
            class="bg-[#1C1C1F]/60 border rounded-xl border-[#46464D]/40 p-5 sm:p-6 flex flex-col gap-5 shadow-lg transition-all"
            :class="activeEditingSection === 'posters' ? 'border-2 border-dashed border-[#D0D4F7]/60 bg-[#D0D4F7]/2' : ''">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h1 class="text-xl font-Sora font-medium text-white">PROMOTIONAL MATERIALS</h1>
                <span class="text-[11px] font-mono text-gray-400">Max 4</span>
              </div>

              <div v-if="isOwner" class="flex items-center gap-1.5">
                <button v-if="activeEditingSection !== 'posters'" @click="startPortfolioEditing('posters')"
                  class="flex hover:flex p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  title="Edit Promotional Posters">
                  <Icon name="ic:outline-edit" class="text-lg text-[#D0D4F7]" />
                </button>
                <template v-else>
                  <button @click="handleSaveActiveSection" :disabled="isPortfolioSaving"
                    class="flex p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    title="Save Changes">
                    <Icon v-if="isPortfolioSaving" name="ic:baseline-sync" class="animate-spin text-xl" />
                    <Icon v-else name="ic:round-check" class="text-xl" />
                  </button>
                  <button @click="handleCancelEditing" :disabled="isPortfolioSaving"
                    class="flex p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    title="Discard Changes">
                    <Icon name="ic:round-close" class="text-xl" />
                  </button>
                </template>
              </div>
            </div>

            <!-- Editing Mode: 4 Poster Slots (Posters or Upload Dropzones) -->
            <div v-if="activeEditingSection === 'posters'" class="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              <!-- Render existing draft posters -->
              <div v-for="(poster, idx) in draftPosters" :key="poster.id || idx"
                class="relative group aspect-3/4 w-full rounded-xl overflow-hidden border-2 border-dashed border-[#D0D4F7] shadow-lg bg-[#1A1A1E]">
                <img :src="poster.fileUrl" :alt="poster.title || 'Poster'" class="w-full h-full object-cover" />
                <div class="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                  <button @click="openEditPoster(idx)"
                    class="w-7 h-7 rounded-full bg-[#1A1A1E]/90 border border-[#D0D4F7]/60 text-[#D0D4F7] flex items-center justify-center hover:bg-[#282832] transition-colors cursor-pointer shadow-lg"
                    title="Edit Poster">
                    <Icon name="ic:outline-edit" class="text-sm" />
                  </button>
                  <button @click="removeDraftPoster(idx)"
                    class="w-7 h-7 rounded-full bg-red-950/90 border border-red-700 text-red-300 flex items-center justify-center hover:bg-red-800 transition-colors cursor-pointer shadow-lg"
                    title="Remove Poster">
                    <Icon name="ic:round-delete-outline" class="text-sm" />
                  </button>
                </div>
                <div v-if="poster.title"
                  class="absolute bottom-0 inset-x-0 bg-black/70 p-2 text-center text-xs font-semibold text-white truncate">
                  {{ poster.title }}
                </div>
              </div>

              <!-- Render upload dropzone slots for remaining spaces up to 4 -->
              <div v-for="emptySlot in Math.max(0, 4 - draftPosters.length)" :key="`slot_${emptySlot}`"
                @click="openAddPoster"
                class="bg-[#646464]/20 hover:bg-[#646464]/30 rounded-xl aspect-3/4 w-full flex flex-col items-center justify-center border-[#D0D4F7]/60 hover:border-[#D0D4F7] border-dashed border-2 cursor-pointer transition-all gap-1.5 group">
                <Icon name="ic:baseline-plus"
                  class="text-3xl text-[#D0D4F7] group-hover:scale-110 transition-transform" />
                <span class="text-xs font-medium text-gray-300">Upload Poster</span>
              </div>
            </div>

            <!-- Live Mode: Saved Posters -->
            <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              <template v-if="posterItems.length > 0">
                <div v-for="poster in posterItems" :key="poster.id"
                  class="relative aspect-3/4 w-full rounded-xl overflow-hidden border border-[#46464D]/40 shadow-lg bg-[#1A1A1E] group">
                  <img :src="poster.fileUrl" :alt="poster.title || 'Poster'"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div v-if="poster.title"
                    class="absolute bottom-0 inset-x-0 bg-black/75 p-2 text-center text-xs font-medium text-white truncate">
                    {{ poster.title }}
                  </div>
                </div>

                <!-- Empty place slots to maintain 4 grid slots -->
                <div v-for="emptySlot in Math.max(0, 4 - posterItems.length)" :key="`live_empty_${emptySlot}`"
                  class="bg-[#1C1C1F]/40 rounded-xl aspect-3/4 w-full flex items-center justify-center border border-[#46464D]/20">
                  <span class="text-xs text-gray-600 font-mono">Available Slot</span>
                </div>
              </template>

              <!-- Sample Placeholders (if none saved yet) -->
              <template v-else>
                <div
                  class="bg-[#646464] rounded-xl aspect-3/4 w-full flex items-center justify-center border-[#b4b4b4] border-2">
                </div>
                <div
                  class="bg-[#646464] rounded-xl aspect-3/4 w-full flex items-center justify-center border-[#b4b4b4] border-2">
                </div>
                <div
                  class="bg-[#646464] rounded-xl aspect-3/4 w-full flex items-center justify-center border-[#b4b4b4] border-2">
                </div>
                <div
                  class="bg-[#646464] rounded-xl aspect-3/4 w-full flex items-center justify-center border-[#b4b4b4] border-2">
                </div>
              </template>
            </div>
          </div>

        </div>

        <!-- Contact Tab Content Container -->
        <div v-else-if="activeTab === 'contact'" class="w-full">
          <!-- Add Contact content here -->
          <div
            class="w-full min-h-100 border border-[#46464D]/40 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-[#131315]/50">
            <div
              class="w-14 h-14 rounded-full bg-[#1E1E24] border border-[#46464D]/50 flex items-center justify-center mb-4">
              <Icon name="ic:outline-alternate-email" class="text-2xl text-[#D0D4F7]" />
            </div>
            <h3 class="font-Sora text-lg font-semibold text-white mb-2">Contact & Inquiries</h3>
            <p class="text-sm text-gray-400 max-w-md">Booking contacts, management details, and social links will appear
              here.</p>
          </div>
        </div>
      </div>
    </main>

    <!-- Portfolio Modals -->
    <ArtistAddMediaModal
      :isOpen="isAddMediaOpen"
      :isEdit="editingMediaIndex !== null"
      :initialUrl="activeEditingMediaItem?.url || ''"
      :initialTitle="activeEditingMediaItem?.title || ''"
      :initialCaption="activeEditingMediaItem?.displayText || ''"
      @close="closeMediaModal"
      @save="onMediaModalSaved"
    />

    <ArtistAddAudioModal
      :isOpen="isAddAudioOpen"
      :isEdit="editingAudioIndex !== null"
      :initialUrl="activeEditingAudioItem?.url || ''"
      :initialTitle="activeEditingAudioItem?.title || ''"
      :initialDisplayText="activeEditingAudioItem?.displayText || ''"
      @close="closeAudioModal"
      @save="onAudioModalSaved"
    />

    <ArtistAddMilestoneModal
      :isOpen="isAddMilestoneOpen"
      :isEdit="editingMilestoneIndex !== null"
      :initialTitle="activeEditingMilestoneItem?.title || ''"
      :initialEventDate="activeEditingMilestoneItem?.eventDate || ''"
      :initialDescription="activeEditingMilestoneItem?.description || ''"
      :initialFileUrl="activeEditingMilestoneItem?.fileUrl || ''"
      :uploadFn="uploadPortfolioImage"
      @close="closeMilestoneModal"
      @save="onMilestoneModalSaved"
    />

    <ArtistAddPosterModal
      :isOpen="isAddPosterOpen"
      :isEdit="editingPosterIndex !== null"
      :initialTitle="activeEditingPosterItem?.title || ''"
      :initialFileUrl="activeEditingPosterItem?.fileUrl || ''"
      :uploadFn="uploadPortfolioImage"
      @close="closePosterModal"
      @save="onPosterModalSaved"
    />

  </div>
</template>