<script setup lang="ts">
definePageMeta({
  layout: 'user',
  middleware: ['auth', 'user']
})

import { ref, computed, onMounted } from 'vue'
import { validateImageFile } from '~/utils/imageOptimizer'

const supabase = useSupabaseClient()
const { fetchCurrentUserProfile, resolveUserType } = useTonoAuth()
const { uploadAvatar, uploadCover, isUploadingAvatar, isUploadingCover, uploadError } = useMediaUpload()

const username = ref('')
const usertype = ref('')
const userTags = ref<string[]>([])
const profilePicture = ref<string | null>(null)
const coverPicture = ref<string | null>(null)
const globalAvatarUrl = useState<string | null>('tono_user_avatar', () => null)
const isLoading = ref(true)
const activeTab = ref<'active' | 'requests'>('active')

const avatarInputRef = ref<HTMLInputElement | null>(null)
const coverInputRef = ref<HTMLInputElement | null>(null)

// Media Cropper Modal State
const isCropperOpen = ref(false)
const cropperMode = ref<'avatar' | 'cover'>('avatar')
const cropperImageSource = ref<string | File | Blob | null>(null)

const tagsDisplay = computed(() => {
  if (userTags.value.length === 0) return 'No tags selected'
  return userTags.value.join(', ')
})

onMounted(async () => {
  try {
    const profile = await fetchCurrentUserProfile()
    if (profile?.account) {
      username.value = profile.account.Username
      profilePicture.value = profile.account.Profile_Picture || null
      coverPicture.value = profile.account.Cover_Picture || null
      if (profile.account.Profile_Picture) {
        globalAvatarUrl.value = profile.account.Profile_Picture
      }
      usertype.value = resolveUserType(profile)
      userTags.value = [...(profile.genres || []), ...(profile.instruments || [])]
    }
  } catch (error) {
    console.error('Error fetching profile:', error)
  } finally {
    isLoading.value = false
  }
})

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
    <MediaCropperModal
      :is-open="isCropperOpen"
      :image-source="cropperImageSource"
      :mode="cropperMode"
      @close="isCropperOpen = false"
      @apply="onCropperApply" />

    <!-- Hidden File Inputs -->
    <input
      ref="avatarInputRef"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      class="hidden"
      @change="onAvatarChange" />
    <input
      ref="coverInputRef"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      class="hidden"
      @change="onCoverChange" />

    <!-- Header & Profile Info -->
    <div class="relative w-full overflow-hidden bg-[#131315] border-b border-[#46464D]/20">
      <!-- Background Banner Image & Overlay -->
      <div class="absolute inset-0 z-0">
        <div v-if="isLoading" class="w-full h-full bg-[#1E1E24] animate-pulse"></div>
        <img
          v-else-if="coverPicture"
          :src="coverPicture"
          alt="Profile Cover"
          class="w-full h-full object-cover object-center opacity-70 mask-x-from-70% mask-x-to-90%" />
        <div v-else class="w-full h-full bg-linear-to-b from-[#1E1E24]/60 to-[#131315]"></div>
        <!-- Soft gradient overlay for contrast on both mobile and desktop -->
        <div class="absolute inset-0 bg-linear-to-t from-[#0E0E10] via-[#0E0E10]/40 to-transparent md:bg-linear-to-r md:from-[#0E0E10]/90 md:via-[#0E0E10]/60 md:to-transparent"></div>
      </div>

      <!-- Update / Reposition Cover Action Buttons -->
      <div
        v-if="!isLoading"
        class="absolute top-4 right-4 sm:top-6 sm:right-8 md:right-16 z-20 flex items-center gap-2">
        <button
          v-if="coverPicture"
          @click="repositionCover"
          :disabled="isUploadingCover"
          class="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/10 text-xs sm:text-sm text-gray-200 hover:text-white transition-all cursor-pointer shadow-lg group"
          title="Adjust cover framing">
          <Icon name="ic:round-crop" class="text-base text-[#C7C5CE] group-hover:text-[#D0D4F7] transition-colors" />
          <span class="hidden xs:inline">Reposition</span>
        </button>

        <button
          @click="triggerCoverSelect"
          :disabled="isUploadingCover"
          class="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/10 text-xs sm:text-sm text-gray-200 hover:text-white transition-all cursor-pointer shadow-lg group">
          <Icon v-if="isUploadingCover" name="ic:baseline-sync" class="animate-spin text-base text-[#D0D4F7]" />
          <Icon v-else name="ic:outline-photo-camera" class="text-base text-[#C7C5CE] group-hover:text-[#D0D4F7] transition-colors" />
          <span>{{ isUploadingCover ? 'Uploading...' : (coverPicture ? 'Change Cover' : 'Add Cover') }}</span>
        </button>
      </div>

      <!-- Loading Skeleton for Header -->
      <div
        v-if="isLoading"
        class="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-8 sm:py-10 min-h-75 md:min-h-85 flex flex-col-reverse md:flex-row items-center md:items-end justify-between gap-6 animate-pulse">
        <div class="flex flex-col items-center md:items-start gap-3 w-full md:w-auto">
          <div class="h-4 w-24 bg-[#1E1E24] rounded-md"></div>
          <div class="h-12 sm:h-16 w-64 sm:w-80 max-w-full bg-[#1E1E24] rounded-xl"></div>
          <div class="h-5 w-48 sm:w-60 max-w-full bg-[#1E1E24] rounded-md"></div>
        </div>
        <div class="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full bg-[#1E1E24] border border-[#46464D]/30 shrink-0"></div>
      </div>

      <!-- Loaded Header Info -->
      <div
        v-else
        class="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-8 sm:py-10 min-h-75 md:min-h-85 flex flex-col-reverse md:flex-row items-center md:items-end justify-between gap-6">
        <!-- Left: Details -->
        <div class="flex flex-col items-center md:items-start text-center md:text-left gap-1.5 min-w-0 max-w-full">
          <span class="font-Geist font-medium text-xs sm:text-[14px] text-[#D0D4F7]/90 tracking-wider uppercase">
            {{ usertype || 'User' }}
          </span>
          <h1 class="font-Sora font-bold text-3xl sm:text-5xl lg:text-[64px] tracking-tight text-white leading-tight wrap-break-word max-w-full">
            {{ username || 'User' }}
          </h1>
          <div class="flex flex-wrap items-center justify-center md:justify-start gap-2 bg-black/50 backdrop-blur-xs px-3 py-1.5 rounded-lg max-w-full border border-white/5 mt-1">
            <span class="font-HankenGrotesk text-xs sm:text-[15px] text-gray-400 font-bold shrink-0">
              User Tags:
            </span>
            <span class="text-xs sm:text-[15px] text-[#D0D4F7] font-medium wrap-break-word">
              {{ tagsDisplay }}
            </span>
          </div>

          <!-- Error Alert if Upload Fails -->
          <p v-if="uploadError" class="text-xs sm:text-sm text-red-400 mt-2 bg-red-950/40 border border-red-800/40 px-3 py-1 rounded-md">
            {{ uploadError }}
          </p>
        </div>

        <!-- Right: Avatar -->
        <div class="flex flex-col justify-center items-center shrink-0">
          <div
            @click="triggerAvatarSelect"
            class="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 bg-[#353437] rounded-full flex items-center justify-center text-gray-500 overflow-hidden shadow-2xl border-2 border-[#46464D]/50 relative group cursor-pointer"
            title="Click to change profile picture">
            <!-- Avatar Image or Fallback Icon -->
            <img
              v-if="profilePicture"
              :src="profilePicture"
              alt="Profile Avatar"
              class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" />
            <Icon
              v-else
              name="ic:outline-account-circle"
              class="w-full h-full text-[#46464D]" />

            <!-- Hover / Upload Overlay -->
            <div
              class="absolute inset-0 bg-black/55 backdrop-blur-xs flex flex-col items-center justify-center transition-opacity"
              :class="isUploadingAvatar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'">
              <Icon
                v-if="isUploadingAvatar"
                name="ic:baseline-sync"
                class="text-2xl sm:text-3xl text-[#D0D4F7] animate-spin" />
              <template v-else>
                <Icon
                  name="ic:outline-photo-camera"
                  class="text-xl sm:text-2xl text-white mb-0.5" />
                <span class="text-[10px] sm:text-xs text-[#D0D4F7] font-medium tracking-wide">
                  {{ profilePicture ? 'Change' : 'Upload' }}
                </span>
              </template>
            </div>
          </div>

          <div class="flex items-center gap-3 mt-3">
            <button
              @click="triggerAvatarSelect"
              :disabled="isUploadingAvatar"
              class="flex gap-1.5 justify-center items-center text-xs sm:text-sm text-[#C7C5CE] hover:text-[#D0D4F7] transition-colors cursor-pointer group">
              <span>{{ isUploadingAvatar ? 'Uploading...' : 'Update Avatar' }}</span>
              <Icon name="ic:outline-edit" class="text-base group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              v-if="profilePicture"
              @click="repositionAvatar"
              :disabled="isUploadingAvatar"
              class="flex items-center gap-1 text-xs sm:text-sm text-gray-400 hover:text-[#D0D4F7] transition-colors cursor-pointer border-l border-[#46464D]/60 pl-3"
              title="Reposition profile picture">
              <Icon name="ic:round-crop" class="text-base" />
              <span>Reposition</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="w-full border-b border-[#46464D]/20 bg-[#0E0E10]">
      <!-- Loading Skeleton for Tabs -->
      <div v-if="isLoading" class="max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-4 sm:py-5 flex gap-8 sm:gap-12 animate-pulse">
        <div class="h-6 w-36 bg-[#1E1E24] rounded-md"></div>
        <div class="h-6 w-40 bg-[#1E1E24] rounded-md"></div>
      </div>

      <div v-else class="max-w-7xl mx-auto px-4 sm:px-8 md:px-16 overflow-x-auto scrollbar-hide">
        <div class="flex gap-8 sm:gap-12 text-[15px] sm:text-[17px] min-w-max">
          <button
            @click="activeTab = 'active'"
            class="font-Sora cursor-pointer transition-colors"
            :class="activeTab === 'active' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
            <span
              class="inline-block py-4 sm:py-5"
              :class="activeTab === 'active' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
              Active Bookings
            </span>
          </button>
          <button
            @click="activeTab = 'requests'"
            class="font-Sora cursor-pointer transition-colors"
            :class="activeTab === 'requests' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
            <span
              class="inline-block py-4 sm:py-5"
              :class="activeTab === 'requests' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
              Booking Requests
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <main class="max-w-7xl mx-auto w-full px-4 sm:px-8 md:px-16 mt-6 sm:mt-8 flex-1">
      <!-- Your custom content will go here -->
    </main>

  </div>
</template>