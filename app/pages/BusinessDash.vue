<script setup lang="ts">
definePageMeta({
  layout: 'business',
  middleware: ['auth', 'business'],
})

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { validateImageFile } from '~/utils/imageOptimizer'
import { formatPostTimestamp, formatCount } from '~/utils/postHelpers'
import { resolveSocialLink, getBusinessInitials } from '~/utils/linkResolver'
import type { PostItem } from '~/composables/useArtistPosts'

const supabase = useSupabaseClient()
const db = supabase as any
const { fetchCurrentUserProfile } = useTonoAuth()
const {
  uploadBusinessAvatar,
  uploadBusinessCover,
  isUploadingAvatar,
  isUploadingCover,
  uploadError,
} = useMediaUpload()

const {
  posts,
  isLoading: isPostsLoading,
  fetchBusinessPosts,
  deletePost,
  toggleLike,
} = useArtistPosts()

const isLoading = ref(true)
const profilePicture = ref<string | null>(null)
const coverPicture = ref<string | null>(null)
const businessProfile = ref<any>(null)
const businessId = ref<string>('')

// Tab State
const activeTab = ref<'overview' | 'posts'>('overview')

// Dashboard Metrics
const activeListingsCount = ref(0)
const applicationsCount = ref(0)
const openContractsCount = ref(0)

// Media Cropper Modal State
const avatarInputRef = ref<HTMLInputElement | null>(null)
const coverInputRef = ref<HTMLInputElement | null>(null)
const isCropperOpen = ref(false)
const cropperMode = ref<'avatar' | 'cover'>('avatar')
const cropperImageSource = ref<string | File | Blob | null>(null)

// Edit Details Modal State
const isEditDetailsOpen = ref(false)

// Posts State
const isCreatePostOpen = ref(false)
const isEditPostOpen = ref(false)
const postToEdit = ref<PostItem | null>(null)
const activeMenuPostId = ref<string | null>(null)
const isDeletingPost = ref(false)
const isPostDetailOpen = ref(false)
const selectedPost = ref<PostItem | null>(null)

// Toast Notifications
const toastMessage = ref('')
let toastTimer: any = null

const showToast = (msg: string) => {
  toastMessage.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
  }, 4000)
}

onMounted(async () => {
  try {
    const profile = await fetchCurrentUserProfile()
    if (profile) {
      businessProfile.value = profile.businessProfile || null
      businessId.value = profile.businessProfile?.BUSINESS_ID || ''
      profilePicture.value =
        profile.businessProfile?.Profile_Picture ||
        profile.account?.Profile_Picture ||
        null
      coverPicture.value =
        profile.businessProfile?.Cover_Picture ||
        profile.account?.Cover_Picture ||
        null
    }

    if (businessId.value) {
      await Promise.all([
        fetchMetrics(),
        fetchBusinessPosts(businessId.value),
      ])
    }
  } catch (err) {
    console.error('Error loading business dashboard data:', err)
  } finally {
    isLoading.value = false
  }

  // Close three dots dropdown on outside click
  window.addEventListener('click', closePostMenu)
})

onUnmounted(() => {
  window.removeEventListener('click', closePostMenu)
  if (toastTimer) clearTimeout(toastTimer)
})

const fetchMetrics = async () => {
  try {
    // 1. Count active job listings
    const { data: listings } = await db
      .from('JOB_LISTING')
      .select('Job_ID, Status')
      .eq('Posted_By_BUSINESS_ID', businessId.value)

    const allListings = listings || []
    activeListingsCount.value = allListings.filter((l: any) => l.Status === 'Open').length

    // 2. Count pending applications for this business's jobs
    const jobIds = allListings.map((l: any) => l.Job_ID)
    if (jobIds.length > 0) {
      const { data: apps } = await db
        .from('APPLICATION')
        .select('Application_ID')
        .in('Job_ID', jobIds)
        .eq('Status', 'Pending')

      applicationsCount.value = apps?.length || 0
    }

    // 3. Count active / pending contracts for this business
    const { data: contracts } = await db
      .from('BOOKING_CONTRACT')
      .select('Booking_ID, Status')
      .eq('Provider_Business_ID', businessId.value)
      .in('Status', ['Pending_Artist_Approval', 'Pending', 'Active', 'Confirmed'])

    openContractsCount.value = contracts?.length || 0
  } catch (e) {
    console.error('Failed to fetch dashboard metrics:', e)
  }
}

// -----------------------------------------------------------------------------
// Profile Picture & Cover Photo Handlers
// -----------------------------------------------------------------------------
const triggerAvatarUpload = () => {
  avatarInputRef.value?.click()
}

const triggerCoverUpload = () => {
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
    showToast(validation.error || 'Invalid image file.')
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
    showToast(validation.error || 'Invalid image file.')
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
  if (!businessId.value) return

  try {
    if (cropperMode.value === 'avatar') {
      const result = await uploadBusinessAvatar(
        croppedBlob,
        businessId.value,
        profilePicture.value
      )
      if (result?.url) {
        profilePicture.value = result.url
        if (businessProfile.value) {
          businessProfile.value.Profile_Picture = result.url
        }
        showToast('Business profile picture updated!')
      }
    } else {
      const result = await uploadBusinessCover(
        croppedBlob,
        businessId.value,
        coverPicture.value
      )
      if (result?.url) {
        coverPicture.value = result.url
        if (businessProfile.value) {
          businessProfile.value.Cover_Picture = result.url
        }
        showToast('Business cover banner updated!')
      }
    }
  } catch (err: any) {
    console.error('Failed to upload business image:', err)
    showToast(err?.message || 'Failed to upload image.')
  }
}

// -----------------------------------------------------------------------------
// Public Details Update Handler
// -----------------------------------------------------------------------------
const onDetailsSaved = (data: {
  name: string
  service: string
  address: string
  contact: string
  links: any[]
}) => {
  if (businessProfile.value) {
    businessProfile.value.Business_Name = data.name
    businessProfile.value.Business_Service = data.service
    businessProfile.value.Business_Address = data.address
    businessProfile.value.Contact_Information = data.contact
    businessProfile.value.Links = data.links
  }
  showToast('Public business details updated successfully!')
}

// Formatted social links for display
const resolvedSocialLinks = computed(() => {
  const rawLinks = businessProfile.value?.Links
  if (!rawLinks || !Array.isArray(rawLinks)) return []
  return rawLinks
    .map((l: any) => {
      const url = typeof l === 'string' ? l : l.url
      const label = typeof l === 'string' ? '' : l.label
      return resolveSocialLink(url, label)
    })
    .filter((l) => Boolean(l.url))
})

// -----------------------------------------------------------------------------
// Posts Handlers
// -----------------------------------------------------------------------------
const togglePostMenu = (postId: string) => {
  activeMenuPostId.value = activeMenuPostId.value === postId ? null : postId
}

const closePostMenu = () => {
  activeMenuPostId.value = null
}

const openEditModal = (post: PostItem) => {
  activeMenuPostId.value = null
  postToEdit.value = post
  isEditPostOpen.value = true
}

const handleDeletePost = async (postId: string) => {
  activeMenuPostId.value = null
  if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) {
    return
  }

  isDeletingPost.value = true
  try {
    const success = await deletePost(postId)
    if (success) {
      showToast('Post deleted.')
    } else {
      showToast('Failed to delete post.')
    }
  } catch (err) {
    showToast('Failed to delete post.')
  } finally {
    isDeletingPost.value = false
  }
}

const openPostDetail = (post: PostItem) => {
  selectedPost.value = post
  isPostDetailOpen.value = true
}

const closePostDetail = () => {
  isPostDetailOpen.value = false
  selectedPost.value = null
}

const handleSharePost = async (post: PostItem) => {
  const url = `${window.location.origin}/business/${businessId.value}?postId=${post.POST_ID}`
  try {
    await navigator.clipboard.writeText(url)
    showToast('Post link copied to clipboard!')
  } catch {
    showToast('Could not copy link.')
  }
}

const handleShareProfile = async () => {
  if (!businessId.value) return
  const url = `${window.location.origin}/business/${businessId.value}`
  try {
    await navigator.clipboard.writeText(url)
    showToast('Public profile link copied to clipboard!')
  } catch {
    showToast('Could not copy link.')
  }
}
</script>

<template>
  <head>
    <title>{{ businessProfile?.Business_Name || 'Business Dashboard' }} | TONO</title>
  </head>

  <!-- Media Cropper Modal -->
  <MediaCropperModal
    :is-open="isCropperOpen"
    :image-source="cropperImageSource"
    :mode="cropperMode"
    @close="isCropperOpen = false"
    @apply="onCropperApply"
  />

  <!-- Edit Business Details Modal -->
  <BusinessEditDetailsModal
    :is-open="isEditDetailsOpen"
    :business-id="businessId"
    :initial-name="businessProfile?.Business_Name || ''"
    :initial-service="businessProfile?.Business_Service || ''"
    :initial-address="businessProfile?.Business_Address || ''"
    :initial-contact="businessProfile?.Contact_Information || ''"
    :initial-links="businessProfile?.Links || []"
    @close="isEditDetailsOpen = false"
    @saved="onDetailsSaved"
  />

  <!-- Create Post Modal -->
  <ArtistCreatePostModal
    :is-open="isCreatePostOpen"
    :owner-id="businessId"
    owner-type="business"
    :artist-name="businessProfile?.Business_Name || 'Business'"
    :artist-avatar="profilePicture"
    @close="isCreatePostOpen = false"
    @created="showToast('Post published successfully!')"
  />

  <!-- Edit Post Modal -->
  <ArtistEditPostModal
    :is-open="isEditPostOpen"
    :post="postToEdit"
    :artist-name="businessProfile?.Business_Name || 'Business'"
    :artist-avatar="profilePicture"
    @close="isEditPostOpen = false"
    @updated="showToast('Post updated successfully!')"
  />

  <!-- Post Detail Comments Modal -->
  <PostDetailModal
    :is-open="isPostDetailOpen"
    :post="selectedPost"
    :artist-name="businessProfile?.Business_Name || 'Business'"
    :artist-avatar="profilePicture"
    @close="closePostDetail"
  />

  <!-- Hidden File Inputs -->
  <input
    ref="avatarInputRef"
    type="file"
    accept="image/jpeg,image/png,image/webp,image/gif"
    class="hidden"
    @change="onAvatarChange"
  />
  <input
    ref="coverInputRef"
    type="file"
    accept="image/jpeg,image/png,image/webp,image/gif"
    class="hidden"
    @change="onCoverChange"
  />

  <!-- Toast Notification -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform translate-y-4 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform translate-y-4 opacity-0"
    >
      <div
        v-if="toastMessage"
        class="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3.5 bg-[#18181B] border border-[#D0D4F7]/50 rounded-2xl shadow-2xl text-[#D0D4F7] font-Sora text-xs sm:text-sm font-medium"
      >
        <Icon name="ic:round-info" class="text-lg text-[#D0D4F7] shrink-0" />
        <span>{{ toastMessage }}</span>
      </div>
    </Transition>
  </Teleport>

  <div class="h-full bg-[#0E0E10] text-white flex flex-col min-h-full pb-16 overflow-x-hidden font-Sora">
    <!-- Header Banner & Profile Info -->
    <div class="relative w-full overflow-hidden bg-[#131315] border-b border-[#46464D]/20 group/banner">
      <!-- Background Banner Image -->
      <div class="absolute inset-0 z-0 bg-[#1E1E24]">
        <div v-if="isLoading" class="w-full h-full bg-[#1E1E24] animate-pulse"></div>
        <img
          v-else-if="coverPicture"
          :src="coverPicture"
          alt="Business Cover"
          class="w-full h-full object-cover object-center opacity-75 mask-x-from-70% mask-x-to-90%"
        />
        <div v-else class="w-full h-full bg-linear-to-b from-[#1E1E24]/80 to-[#131315]"></div>

        <!-- Gradient overlays -->
        <div
          class="absolute inset-0 bg-linear-to-t from-[#0E0E10] via-[#0E0E10]/40 to-transparent md:bg-linear-to-r md:from-[#0E0E10]/95 md:via-[#0E0E10]/60 md:to-transparent"
        ></div>
      </div>

      <!-- Action Toolbar (Top Right: Change Cover, View Public Profile, Share) -->
      <div class="absolute top-4 right-4 sm:top-6 sm:right-8 md:right-16 z-20 flex items-center gap-2.5 flex-wrap justify-end">
        <!-- Change Cover Button -->
        <div class="relative group/coverbtn">
          <button
            type="button"
            @click="triggerCoverUpload"
            class="flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/10 text-xs sm:text-sm text-gray-200 hover:text-white transition-all cursor-pointer shadow-lg"
            title="Upload new cover image"
          >
            <Icon name="ic:outline-camera-alt" class="text-base text-[#D0D4F7]" />
            <span class="hidden sm:inline">Change Cover</span>
          </button>
          <!-- Reposition option if cover exists -->
          <button
            v-if="coverPicture"
            type="button"
            @click.stop="repositionCover"
            class="hidden group-hover/coverbtn:flex absolute top-full mt-1 right-0 items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F1F24] border border-[#3A3A3E] text-[11px] text-gray-300 hover:text-white whitespace-nowrap shadow-xl cursor-pointer"
          >
            <Icon name="mdi:crop" class="text-xs text-[#D0D4F7]" />
            <span>Reposition</span>
          </button>
        </div>

        <!-- View Public Profile Link -->
        <NuxtLink
          v-if="businessId"
          :to="'/business/' + businessId"
          target="_blank"
          class="flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-[#D0D4F7] hover:bg-white text-[#0E0E10] text-xs sm:text-sm font-bold transition-all shadow-lg cursor-pointer"
          title="Open public profile in new tab"
        >
          <Icon name="lucide:external-link" class="text-sm" />
          <span>View Public View</span>
        </NuxtLink>

        <!-- Share Profile Button -->
        <button
          type="button"
          @click="handleShareProfile"
          class="flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/10 text-xs sm:text-sm text-gray-200 hover:text-white transition-all cursor-pointer shadow-lg"
          title="Share profile link"
        >
          <Icon name="ic:round-share" class="text-base text-[#D0D4F7]" />
          <span class="hidden sm:inline">Share</span>
        </button>
      </div>

      <!-- Header Content Container -->
      <div
        class="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-8 sm:py-10 min-h-75 md:min-h-85 flex flex-col-reverse md:flex-row items-center md:items-end justify-between gap-6"
      >
        <!-- Left Details -->
        <div class="flex flex-col items-center md:items-start text-center md:text-left gap-2 min-w-0 max-w-2xl">
          <span class="text-xs font-mono uppercase tracking-widest text-[#D0D4F7]/90 font-medium bg-[#D0D4F7]/10 px-2.5 py-1 rounded-md border border-[#D0D4F7]/20 w-fit">
            {{ businessProfile?.Business_Service || 'Live Music & Entertainment' }}
          </span>
          <h1 class="text-2xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-md">
            {{ businessProfile?.Business_Name || 'Business Suite' }}
          </h1>
          <p v-if="businessProfile?.Business_Address" class="text-xs sm:text-sm font-light text-gray-300 flex items-center gap-1.5">
            <Icon name="ic:baseline-location-on" class="text-sm text-[#D0D4F7]" />
            <span>{{ businessProfile.Business_Address }}</span>
          </p>
        </div>

        <!-- Right: Avatar with Hover Camera Overlay -->
        <div class="flex flex-col justify-center items-center shrink-0">
          <div
            class="relative w-28 h-28 sm:w-34 sm:h-34 rounded-full bg-[#1E1E24] flex items-center justify-center text-gray-300 overflow-hidden shadow-2xl border-4 border-white/80 shrink-0 group/avatar cursor-pointer"
            @click="triggerAvatarUpload"
            title="Click to change profile picture"
          >
            <!-- Avatar Image or Initials Fallback -->
            <img
              v-if="profilePicture"
              :src="profilePicture"
              alt="Business Profile"
              class="w-full h-full object-cover object-center"
            />
            <div
              v-else
              class="w-full h-full bg-[#1E1E24] text-[#D0D4F7] font-bold text-3xl font-Sora flex items-center justify-center uppercase"
            >
              {{ getBusinessInitials(businessProfile?.Business_Name) }}
            </div>

            <!-- Hover Camera Overlay -->
            <div
              class="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center gap-1 text-white transition-opacity duration-200"
            >
              <Icon name="ic:outline-camera-alt" class="text-2xl text-[#D0D4F7]" />
              <span class="text-[10px] font-semibold tracking-wide">CHANGE</span>
            </div>
          </div>
          <!-- Reposition Avatar Button -->
          <button
            v-if="profilePicture"
            type="button"
            @click.stop="repositionAvatar"
            class="mt-1 text-[11px] text-gray-400 hover:text-[#D0D4F7] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Icon name="mdi:crop" class="text-xs" />
            <span>Reposition</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="w-full border-b border-[#46464D]/20 bg-[#0E0E10]">
      <div class="max-w-7xl mx-auto px-4 sm:px-8 md:px-16 overflow-x-auto scrollbar-hide">
        <div class="flex justify-center sm:justify-start gap-8 sm:gap-12 text-[15px] sm:text-[17px] min-w-max">
          <button
            type="button"
            @click="activeTab = 'overview'"
            class="font-Sora cursor-pointer transition-colors"
            :class="activeTab === 'overview' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'"
          >
            <span
              class="inline-block py-4 sm:py-5"
              :class="activeTab === 'overview' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''"
            >
              Overview & Details
            </span>
          </button>

          <button
            type="button"
            @click="activeTab = 'posts'"
            class="font-Sora cursor-pointer transition-colors"
            :class="activeTab === 'posts' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'"
          >
            <span
              class="py-4 sm:py-5 flex items-center gap-2"
              :class="activeTab === 'posts' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''"
            >
              <span>Posts</span>
              <span v-if="posts.length > 0" class="text-xs px-2 py-0.5 rounded-full bg-[#D0D4F7]/10 text-[#D0D4F7] font-mono">
                {{ posts.length }}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <main class="max-w-7xl mx-auto w-full px-4 sm:px-8 md:px-16 mt-6 sm:mt-8">
      <!-- ===================================================================== -->
      <!-- TAB 1: OVERVIEW & PUBLIC DETAILS -->
      <!-- ===================================================================== -->
      <div v-if="activeTab === 'overview'" class="space-y-8">
        <!-- 3 Quick Metric Cards -->
        <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">
          <div v-for="i in 3" :key="i" class="h-28 rounded-2xl bg-[#1c1c1f] border border-[#2a2a2e]/40"></div>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <!-- Card 1: Active job listings -->
          <div
            @click="navigateTo('/BusinessJobList')"
            class="flex flex-col justify-start items-start h-28 relative gap-3 p-5 rounded-2xl bg-[#1c1c1f] border border-[#2a2a2e]/40 hover:border-[#46464D] hover:bg-[#222226] transition-all cursor-pointer shadow-lg group"
          >
            <div class="flex justify-between items-center self-stretch relative">
              <p class="text-[13px] font-medium text-left text-[#c7c5ce] group-hover:text-white transition-colors">
                Active job listings
              </p>
              <div class="flex flex-col justify-center items-center h-8 w-8 relative rounded-lg bg-[#c4c6d2]/20">
                <Icon name="mdi:briefcase-outline" class="text-lg text-[#C4C6D2]" />
              </div>
            </div>
            <p class="text-[28px] font-bold text-left text-[#c4c6d2] font-mono">
              {{ activeListingsCount }}
            </p>
          </div>

          <!-- Card 2: Job applications -->
          <div
            @click="navigateTo('/BusinessJobApp')"
            class="flex flex-col justify-start items-start h-28 relative gap-3 p-5 rounded-2xl bg-[#1c1c1f] border border-[#2a2a2e]/40 hover:border-[#46464D] hover:bg-[#222226] transition-all cursor-pointer shadow-lg group"
          >
            <div class="flex justify-between items-center self-stretch relative">
              <p class="text-[13px] font-medium text-left text-[#c7c5ce] group-hover:text-white transition-colors">
                Job applications
              </p>
              <div class="flex flex-col justify-center items-center h-8 w-8 relative rounded-lg bg-[#c4c6d2]/20">
                <Icon name="mdi:clipboard-file-outline" class="text-lg text-[#C4C6D2]" />
              </div>
            </div>
            <p class="text-[28px] font-bold text-left text-[#c4c6d2] font-mono">
              {{ applicationsCount }}
            </p>
          </div>

          <!-- Card 3: Open contracts -->
          <div
            @click="navigateTo('/BusinessContracts')"
            class="flex flex-col justify-start items-start h-28 relative gap-3 p-5 rounded-2xl bg-[#1c1c1f] border border-[#2a2a2e]/40 hover:border-[#46464D] hover:bg-[#222226] transition-all cursor-pointer shadow-lg group"
          >
            <div class="flex justify-between items-center self-stretch relative">
              <p class="text-[13px] font-medium text-left text-[#c7c5ce] group-hover:text-white transition-colors">
                Open contracts
              </p>
              <div class="flex flex-col justify-center items-center h-8 w-8 relative rounded-lg bg-[#c4c6d2]/20">
                <Icon name="mdi:file-multiple-outline" class="text-lg text-[#C4C6D2]" />
              </div>
            </div>
            <p class="text-[28px] font-bold text-left text-[#c4c6d2] font-mono">
              {{ openContractsCount }}
            </p>
          </div>
        </div>

        <!-- Public Details Management Card -->
        <div class="rounded-3xl bg-[#131315] border border-[#2A2A2E] p-6 sm:p-8 space-y-6 shadow-xl">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#2A2A2E]">
            <div>
              <h2 class="text-lg sm:text-xl font-bold text-white tracking-tight">Public Profile Details</h2>
              <p class="text-xs sm:text-sm text-gray-400 font-Geist">
                This information is shown publicly to all users, artists, and event organizers.
              </p>
            </div>
            <div class="flex items-center gap-3">
              <button
                type="button"
                @click="isEditDetailsOpen = true"
                class="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D0D4F7] hover:bg-white text-[#0E0E10] text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <Icon name="ic:outline-edit" class="text-base" />
                <span>Edit Details</span>
              </button>
            </div>
          </div>

          <!-- Details Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 font-Geist text-sm">
            <!-- Business Name & Service -->
            <div class="space-y-1 p-4 rounded-2xl bg-[#18181B] border border-[#26262B]">
              <span class="text-xs font-mono uppercase tracking-wider text-gray-400 font-medium">Business Name</span>
              <p class="text-base font-semibold text-white font-Sora">
                {{ businessProfile?.Business_Name || 'Not Set' }}
              </p>
              <span class="text-xs text-[#D0D4F7] font-medium block pt-1">
                {{ businessProfile?.Business_Service || 'No primary service defined' }}
              </span>
            </div>

            <!-- Address -->
            <div class="space-y-1 p-4 rounded-2xl bg-[#18181B] border border-[#26262B]">
              <span class="text-xs font-mono uppercase tracking-wider text-gray-400 font-medium">Physical Address</span>
              <p class="text-sm text-gray-200 flex items-center gap-1.5 pt-1">
                <Icon name="ic:baseline-location-on" class="text-base text-[#D0D4F7] shrink-0" />
                <span>{{ businessProfile?.Business_Address || 'No address provided yet' }}</span>
              </p>
            </div>

            <!-- Contact Information -->
            <div class="space-y-1 p-4 rounded-2xl bg-[#18181B] border border-[#26262B] md:col-span-2">
              <span class="text-xs font-mono uppercase tracking-wider text-gray-400 font-medium">Contact & Inquiries</span>
              <p class="text-sm text-gray-200 flex items-center gap-2 pt-1">
                <Icon name="ic:outline-phone" class="text-base text-[#D0D4F7] shrink-0" />
                <span>{{ businessProfile?.Contact_Information || 'No contact details listed' }}</span>
              </p>
            </div>

            <!-- Social Media & Web Links -->
            <div class="space-y-3 p-4 rounded-2xl bg-[#18181B] border border-[#26262B] md:col-span-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-mono uppercase tracking-wider text-gray-400 font-medium">
                  Official Social & Web Links
                </span>
                <span class="text-xs text-gray-500 font-mono">{{ resolvedSocialLinks.length }} links</span>
              </div>

              <!-- Links Pills -->
              <div v-if="resolvedSocialLinks.length > 0" class="flex flex-wrap gap-2.5 pt-1">
                <a
                  v-for="(link, idx) in resolvedSocialLinks"
                  :key="idx"
                  :href="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#222226] hover:bg-[#2A2A30] border border-[#3A3A3E] hover:border-[#D0D4F7]/60 text-white transition-all shadow-sm group cursor-pointer"
                >
                  <Icon :name="link.icon" class="text-base text-[#D0D4F7] shrink-0" />
                  <div class="flex flex-col text-left">
                    <span class="text-[10px] text-gray-400 leading-tight">{{ link.platform }}</span>
                    <span class="text-xs font-semibold text-gray-200 group-hover:text-[#D0D4F7] transition-colors leading-tight">
                      {{ link.label }}
                    </span>
                  </div>
                  <Icon name="lucide:external-link" class="text-xs text-gray-500 group-hover:text-[#D0D4F7] ml-1 transition-colors" />
                </a>
              </div>

              <p v-else class="text-xs text-gray-500 italic">
                No social links added yet. Click "Edit Details" above to connect your Facebook, YouTube, SoundCloud, or website.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- TAB 2: POSTS (IDENTICAL TO ARTIST PROFILE POSTS SECTION) -->
      <!-- ===================================================================== -->
      <div v-else-if="activeTab === 'posts'" class="flex flex-col lg:flex-row gap-6 items-start w-full">
        <!-- Feed Column -->
        <div class="flex-1 w-full min-w-0 flex flex-col gap-6">
          <!-- Create Post Card -->
          <div
            @click="isCreatePostOpen = true"
            class="flex gap-2 flex-col items-center justify-center p-6 sm:p-10 md:p-12 border border-[#46464D] border-dashed rounded-xl min-h-35 sm:h-46.25 transition-all hover:border-[#D0D4F7] hover:bg-[#D0D4F7]/5 group cursor-pointer w-full"
          >
            <div
              class="flex border p-2.5 sm:p-3 rounded-full border-[#46464D] group-hover:border-[#D0D4F7] transition-colors"
            >
              <Icon name="ic:baseline-plus" class="text-xl text-[#C7C5CE] group-hover:text-[#D0D4F7]" />
            </div>
            <h2
              class="font-Geist font-medium text-xs sm:text-[14px] text-[#C7C5CE] group-hover:text-[#D0D4F7] transition-all tracking-wide"
            >
              CREATE A POST
            </h2>
          </div>

          <!-- Loading Skeletons -->
          <div v-if="isPostsLoading" class="space-y-4 animate-pulse">
            <div v-for="i in 2" :key="i" class="h-64 rounded-xl bg-[#1B1B1D] border border-[#2A2A2E]"></div>
          </div>

          <!-- Empty State -->
          <article
            v-else-if="posts.length === 0"
            class="flex justify-center items-center border-[#46464D]/40 border-dashed border rounded-xl overflow-hidden shadow-lg w-full h-100 font-Sora bg-[#131315]/40"
          >
            <div class="flex flex-col items-center gap-3 text-center p-6">
              <Icon name="lucide:megaphone-off" class="text-3xl sm:text-5xl text-[#D0D4F7]" />
              <h3 class="text-base sm:text-lg font-semibold text-white">No Posts Published Yet</h3>
              <p class="text-xs text-gray-400 max-w-sm font-Geist">
                Share business updates, equipment announcements, studio sessions, and promos with the music community.
              </p>
            </div>
          </article>

          <!-- With Posts State -->
          <template v-else>
            <article
              v-for="post in posts"
              :key="post.POST_ID"
              class="bg-[#1B1B1D] border border-[#46464D]/40 rounded-xl overflow-hidden w-full shadow-lg"
            >
              <!-- Uploaded Image: IF NO IMAGE HIDE THE DIV COMPLETELY -->
              <div
                v-if="post.Media"
                class="w-full aspect-video max-h-137.5 overflow-hidden bg-black/40 flex items-center justify-center"
              >
                <img
                  :src="post.Media"
                  alt="Post Media"
                  class="object-cover w-full h-full hover:scale-[1.02] transition-transform duration-500"
                />
              </div>

              <div class="flex flex-col gap-4 p-4 sm:p-6">
                <div>
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <!-- Avatar -->
                      <div class="w-10 h-10 rounded-full overflow-hidden bg-[#24242A] shrink-0 border border-white/20">
                        <img
                          v-if="profilePicture"
                          :src="profilePicture"
                          :alt="businessProfile?.Business_Name"
                          class="w-full h-full object-cover"
                        />
                        <div
                          v-else
                          class="w-full h-full bg-[#1E1E24] text-[#D0D4F7] font-bold text-xs flex items-center justify-center font-Sora uppercase"
                        >
                          {{ getBusinessInitials(businessProfile?.Business_Name) }}
                        </div>
                      </div>
                      <h3 class="font-Sora text-base sm:text-[18px] font-semibold text-white">
                        {{ businessProfile?.Business_Name || 'Business Account' }}
                      </h3>
                    </div>

                    <div class="flex items-center gap-2 sm:gap-3">
                      <span
                        v-if="post.Location"
                        class="text-xs text-gray-400 font-Geist flex items-center gap-1"
                      >
                        <Icon name="ic:outline-location-on" class="text-sm text-[#D0D4F7]" />
                        {{ post.Location }}
                      </span>

                      <!-- Three dots options menu -->
                      <div class="relative">
                        <button
                          type="button"
                          @click.stop="togglePostMenu(post.POST_ID)"
                          class="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                          title="Post options"
                          aria-label="Post options"
                        >
                          <Icon name="ic:round-more-vert" class="text-xl" />
                        </button>

                        <!-- Dropdown Menu -->
                        <div
                          v-if="activeMenuPostId === post.POST_ID"
                          class="absolute right-0 top-full mt-1 w-36 bg-[#222225] border border-[#46464D]/60 rounded-xl shadow-2xl py-1 z-30 flex flex-col font-Geist"
                          @click.stop
                        >
                          <button
                            type="button"
                            @click.stop="openEditModal(post)"
                            class="w-full px-3 py-2 text-left text-xs sm:text-sm text-gray-200 hover:text-white hover:bg-white/10 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Icon name="ic:outline-edit" class="text-base text-[#D0D4F7]" />
                            <span>Edit post</span>
                          </button>
                          <div class="h-px bg-[#46464D]/30 my-0.5"></div>
                          <button
                            type="button"
                            @click.stop="handleDeletePost(post.POST_ID)"
                            class="w-full px-3 py-2 text-left text-xs sm:text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Icon name="ic:round-delete-outline" class="text-base" />
                            <span>Delete post</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <span class="font-HankenGrotesk text-xs text-[#C7C5CE] ml-13 block mt-0.5">
                    {{ formatPostTimestamp(post.Created_at) }}
                  </span>
                </div>

                <div v-if="post.Caption">
                  <p class="text-sm sm:text-base text-gray-300 leading-relaxed font-Geist whitespace-pre-line">
                    {{ post.Caption }}
                  </p>
                </div>

                <div class="flex justify-between items-center pt-2 border-t border-[#46464D]/20 text-sm">
                  <div class="flex gap-4 sm:gap-6 items-center">
                    <!-- Likes Button -->
                    <button
                      type="button"
                      @click="toggleLike(post.POST_ID)"
                      class="flex gap-1.5 items-center cursor-pointer transition-colors"
                      :class="post.userHasLiked ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'"
                    >
                      <Icon
                        :name="post.userHasLiked ? 'ic:baseline-favorite' : 'ic:baseline-favorite-border'"
                        class="text-xl sm:text-2xl text-[#D0D4F7] transition-transform active:scale-125"
                      />
                      <span
                        class="text-xs sm:text-sm font-medium"
                        :class="post.userHasLiked ? 'text-[#D0D4F7]' : 'text-[#C7C5CE]'"
                      >
                        {{ formatCount(post.likeCount) }}
                      </span>
                    </button>

                    <!-- Comments Button -->
                    <button
                      type="button"
                      @click="openPostDetail(post)"
                      class="flex gap-1.5 items-center text-[#C7C5CE] hover:text-[#D0D4F7] transition-colors cursor-pointer"
                    >
                      <Icon name="ic:sharp-chat-bubble-outline" class="text-xl sm:text-2xl text-[#D0D4F7]" />
                      <span class="text-xs sm:text-sm font-medium">
                        {{ formatCount(post.commentCount) }}
                      </span>
                    </button>
                  </div>

                  <button
                    type="button"
                    @click="handleSharePost(post)"
                    class="text-[#C7C5CE] hover:text-[#D0D4F7] transition-colors cursor-pointer"
                    title="Share Post"
                  >
                    <Icon name="ic:round-share" class="text-xl sm:text-2xl" />
                  </button>
                </div>
              </div>
            </article>
          </template>
        </div>
      </div>
    </main>
  </div>
</template>