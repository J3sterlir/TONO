<script setup lang="ts">
definePageMeta({
  layout: 'user',
  middleware: ['auth', 'user']
})

import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { validateImageFile } from '~/utils/imageOptimizer'

const supabase = useSupabaseClient()
const db = supabase as any
const { fetchCurrentUserProfile, resolveUserType } = useTonoAuth()
const { uploadAvatar, uploadCover, isUploadingAvatar, isUploadingCover, uploadError } = useMediaUpload()

const username = ref('')
const currentAccountId = ref('')
const usertype = ref('')
const userTags = ref<string[]>([])
const profilePicture = ref<string | null>(null)
const coverPicture = ref<string | null>(null)
const globalAvatarUrl = useState<string | null>('tono_user_avatar', () => null)
const isLoading = ref(true)

// Navigation Tabs
const activeTab = ref<'active' | 'requests'>('active')

// User Events & Requests State
const activeBookings = ref<any[]>([])
const pendingRequests = ref<any[]>([])
const liveTodayEvents = ref<any[]>([])
const isBookingsLoading = ref(true)

// Cancellation & 5-Day Proximity Warning
const isWarningModalOpen = ref(false)
const selectedContractForCancel = ref<any>(null)
const userToast = ref('')

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

const route = useRoute()

// Realtime User Booking Contract Sync
let userContractsRealtimeChannel: any = null

const setupRealtimeUserContracts = () => {
  if (userContractsRealtimeChannel) {
    supabase.removeChannel(userContractsRealtimeChannel)
    userContractsRealtimeChannel = null
  }
  if (!currentAccountId.value) return

  userContractsRealtimeChannel = supabase
    .channel(`user-profile-contracts-${currentAccountId.value}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'BOOKING_CONTRACT',
        filter: `Requester_Account_ID=eq.${currentAccountId.value}`
      },
      () => {
        fetchUserBookings()
      }
    )
    .subscribe()
}

onBeforeUnmount(() => {
  if (userContractsRealtimeChannel) {
    supabase.removeChannel(userContractsRealtimeChannel)
    userContractsRealtimeChannel = null
  }
})

const handleDeepLinkContract = (contractId?: string) => {
  if (!contractId) return
  const isPending = pendingRequests.value.some(
    (c: any) => c.Booking_ID === contractId || c.Contract_Code === contractId
  )
  if (isPending) {
    activeTab.value = 'requests'
  } else {
    activeTab.value = 'active'
  }
}

watch(
  () => route.query.contractId,
  (newContractId) => {
    if (newContractId) {
      handleDeepLinkContract(newContractId as string)
    }
  }
)

onMounted(async () => {
  try {
    const profile = await fetchCurrentUserProfile()
    if (profile?.account) {
      currentAccountId.value = profile.account.ACCOUNT_ID
      username.value = profile.account.Username
      profilePicture.value = profile.account.Profile_Picture || null
      coverPicture.value = profile.account.Cover_Picture || null
      if (profile.account.Profile_Picture) {
        globalAvatarUrl.value = profile.account.Profile_Picture
      }
      usertype.value = resolveUserType(profile)
      userTags.value = [...(profile.genres || []), ...(profile.instruments || [])]

      await fetchUserBookings()
      setupRealtimeUserContracts()

      if (route.query.contractId) {
        handleDeepLinkContract(route.query.contractId as string)
      }
    }
  } catch (error) {
    console.error('Error fetching profile:', error)
  } finally {
    isLoading.value = false
  }
})

// Fetch User Bookings (Confirmed vs Requests) + Today's Live Gigs
const fetchUserBookings = async () => {
  if (!currentAccountId.value) return
  isBookingsLoading.value = true
  try {
    // 1. Fetch user booking contracts (both direct bookings and job listing contracts)
    const { data: contractsData, error: contractsErr } = await db
      .from('BOOKING_CONTRACT')
      .select(`
        Booking_ID,
        Contract_Code,
        Job_ID,
        Booking_Type,
        Start_Date,
        End_Date,
        Event_Date,
        Start_Time,
        End_Time,
        Venue_Location,
        Agreed_Fee,
        Song_Lineup,
        Song_Lineup_JSON,
        Required_Equipment,
        Status,
        Is_Rush_Booking,
        Created_at,
        ARTIST:Provider_Artist_ID (
          ARTIST_ID,
          Artist_Type,
          StageName:SOLO_ARTIST(Artist_Name),
          BandName:BAND(Band_Name),
          USER_ACCOUNT (
            Username,
            Profile_Picture
          )
        ),
        JOB_LISTING (
          Job_Code,
          Event_Title,
          Location,
          Description
        ),
        BUSINESS_PROFILE:Provider_Business_ID (
          Business_Name
        )
      `)
      .eq('Requester_Account_ID', currentAccountId.value)
      .order('Created_at', { ascending: false })

    if (!contractsErr && contractsData) {
      activeBookings.value = contractsData.filter((c: any) => ['Confirmed', 'Active', 'Completed'].includes(c.Status))
      pendingRequests.value = contractsData.filter((c: any) => ['Pending_Artist_Approval', 'Pending'].includes(c.Status))
    }

    // 2. Fetch live events happening today
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const { data: liveData } = await db
      .from('BOOKING_CONTRACT')
      .select(`
        Booking_ID,
        Contract_Code,
        Job_ID,
        Start_Date,
        End_Date,
        Start_Time,
        End_Time,
        Venue_Location,
        ARTIST:Provider_Artist_ID (
          ARTIST_ID,
          Artist_Type,
          StageName:SOLO_ARTIST(Artist_Name),
          BandName:BAND(Band_Name)
        ),
        JOB_LISTING (
          Event_Title,
          Location
        )
      `)
      .in('Status', ['Confirmed', 'Active'])
      .lte('Start_Date', today)
      .gte('End_Date', today)
      .limit(6)

    liveTodayEvents.value = liveData || []
  } catch (err) {
    console.error('Failed to load user bookings:', err)
  } finally {
    isBookingsLoading.value = false
  }
}

const getArtistDisplayName = (artist: any) => {
  if (!artist) return 'Performing Artist'
  return artist.BandName?.Band_Name || artist.StageName?.Artist_Name || artist.USER_ACCOUNT?.Username || 'Artist'
}

const getArtistAvatar = (artist: any) => {
  return artist?.USER_ACCOUNT?.Profile_Picture || null
}

// 5-Day Cancellation Logic & Sanction Warning Modal Check
const initiateCancelBooking = (contract: any) => {
  selectedContractForCancel.value = contract
  const targetDateStr = contract.Start_Date || contract.Event_Date
  if (targetDateStr) {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const targetDate = new Date(targetDateStr)
    targetDate.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 5) {
      // Triggers sanction warning dialog
      isWarningModalOpen.value = true
      return
    }
  }

  // Not within 5 days - prompt direct cancellation
  if (confirm(`Are you sure you want to cancel booking contract ${contract.Contract_Code}?`)) {
    executeCancellation('Cancelled by client', false)
  }
}

const handleConfirmWarningCancellation = async (reason: string) => {
  isWarningModalOpen.value = false
  await executeCancellation(reason, true)
}

const executeCancellation = async (reason: string, isLate = false) => {
  if (!selectedContractForCancel.value) return
  const contractId = selectedContractForCancel.value.Booking_ID
  const code = selectedContractForCancel.value.Contract_Code

  try {
    const { error } = await db
      .from('BOOKING_CONTRACT')
      .update({
        Status: 'Cancelled',
        Cancellation_Reason: reason,
        Cancelled_By: currentAccountId.value,
        Is_Late_Cancellation: isLate
      })
      .eq('Booking_ID', contractId)

    if (error) throw error

    userToast.value = `Booking ${code || ''} has been cancelled.`
    setTimeout(() => { userToast.value = '' }, 4000)
    await fetchUserBookings()
  } catch (err: any) {
    alert(err.message || 'Failed to cancel booking')
  } finally {
    selectedContractForCancel.value = null
  }
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
  <title>User Profile | TONO</title>
  <div class="h-full bg-[#0E0E10] text-white flex flex-col min-h-screen pb-16 overflow-x-hidden">
    <!-- Media Cropper Modal -->
    <MediaCropperModal
      :is-open="isCropperOpen"
      :image-source="cropperImageSource"
      :mode="cropperMode"
      @close="isCropperOpen = false"
      @apply="onCropperApply" />

    <!-- 5-Day Late Cancellation Sanctions Warning Modal -->
    <SanctionWarningModal
      :is-open="isWarningModalOpen"
      action-type="cancel"
      target-type="contract"
      :item-title="selectedContractForCancel?.Contract_Code || 'Booking Contract'"
      :start-date="selectedContractForCancel?.Start_Date || selectedContractForCancel?.Event_Date || ''"
      @close="isWarningModalOpen = false"
      @confirm="handleConfirmWarningCancellation" />

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
            class="font-Sora cursor-pointer transition-colors flex items-center gap-2"
            :class="activeTab === 'active' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
            <span
              class="inline-block py-4 sm:py-5"
              :class="activeTab === 'active' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
              Confirmed Events
            </span>
            <span v-if="activeBookings.length" class="text-xs px-2 py-0.5 rounded-full bg-[#1C1C1F] border border-[#2A2A2E] text-[#D0D4F7] font-mono">
              {{ activeBookings.length }}
            </span>
          </button>
          <button
            @click="activeTab = 'requests'"
            class="font-Sora cursor-pointer transition-colors flex items-center gap-2"
            :class="activeTab === 'requests' ? 'text-[#D0D4F7]' : 'text-[#C7C5CE] hover:text-[#D0D4F7]'">
            <span
              class="inline-block py-4 sm:py-5"
              :class="activeTab === 'requests' ? 'border-b-2 border-[#D0D4F7] font-semibold' : ''">
              Sent Booking Requests
            </span>
            <span v-if="pendingRequests.length" class="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono">
              {{ pendingRequests.length }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <main class="max-w-7xl mx-auto w-full px-4 sm:px-8 md:px-16 mt-6 sm:mt-8 flex-1">
      <!-- Loading State -->
      <div v-if="isBookingsLoading" class="grid grid-cols-1 md:grid-cols-2 gap-5 animate-pulse">
        <div v-for="i in 4" :key="i" class="h-44 bg-[#141416] border border-[#2A2A2E] rounded-2xl"></div>
      </div>

      <!-- TAB 1: YOUR EVENTS & LIVE GIGS -->
      <div v-else-if="activeTab === 'active'" class="space-y-12">
        <!-- ================================================================= -->
        <!-- SECTION 1: "YOUR EVENTS" (Deduplicated Job Listings vs Contracts) -->
        <!-- ================================================================= -->
        <section class="space-y-5 font-Sora">
          <div class="flex items-center justify-between border-b border-[#2A2A2E] pb-3">
            <div>
              <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Your Confirmed Events</h2>
              <p class="text-xs text-gray-400 mt-0.5">
                Confirmed gig bookings with TONO artists and accepted performance contracts.
              </p>
            </div>
            <span class="text-xs font-mono text-[#D0D4F7] px-2.5 py-1 rounded-full bg-[#1C1C1F] border border-[#2A2A2E]">
              {{ activeBookings.length }} {{ activeBookings.length === 1 ? 'event' : 'events' }}
            </span>
          </div>

          <div v-if="activeBookings.length === 0" class="text-center py-12 bg-[#131315]/50 border border-dashed border-[#2A2A2E] rounded-2xl space-y-2">
            <Icon name="ic:outline-event-busy" class="text-3xl text-gray-500 mx-auto" />
            <p class="text-sm font-semibold text-white">No Confirmed Events Yet</p>
            <p class="text-xs text-gray-400">Discover local talent on TONO and book your first live performance.</p>
          </div>

          <!-- Deduplicated Event Cards Grid -->
          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div
              v-for="booking in activeBookings"
              :key="booking.Booking_ID"
              class="bg-[#1C1C1F]/80 border border-[#2A2A2E] hover:border-[#46464D] rounded-2xl p-5 sm:p-6 space-y-4 transition-all shadow-lg flex flex-col justify-between"
            >
              <div class="space-y-3">
                <!-- Header with Origin Type and Status Badge -->
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <span class="text-[10px] font-mono uppercase tracking-wider text-[#D0D4F7]">
                      {{ booking.Job_ID ? 'JOB LISTING GIG' : 'DIRECT ARTIST BOOKING' }}
                    </span>
                    <h3 class="text-base sm:text-lg font-bold text-white mt-0.5">
                      {{ booking.Job_ID ? booking.JOB_LISTING?.Event_Title : (booking.Booking_Type || 'Direct Performance') }}
                    </h3>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <span v-if="booking.Is_Rush_Booking" class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                      <Icon name="ic:baseline-bolt" class="text-xs" />
                      <span>Rush</span>
                    </span>
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {{ booking.Status }}
                    </span>
                  </div>
                </div>

                <!-- Artist Details -->
                <div class="flex items-center gap-3 p-3 rounded-xl bg-[#141416] border border-[#2A2A2E]/70">
                  <div class="w-10 h-10 rounded-full bg-[#1E1E24] overflow-hidden border border-[#46464D]/50 shrink-0 flex items-center justify-center">
                    <img
                      v-if="getArtistAvatar(booking.ARTIST)"
                      :src="getArtistAvatar(booking.ARTIST)"
                      :alt="getArtistDisplayName(booking.ARTIST)"
                      class="w-full h-full object-cover" />
                    <Icon v-else name="ic:outline-music-note" class="text-lg text-[#D0D4F7]" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <h4 class="text-sm font-semibold text-white truncate">{{ getArtistDisplayName(booking.ARTIST) }}</h4>
                    <span class="text-[11px] text-gray-400 font-mono">{{ booking.ARTIST?.Artist_Type || 'Artist' }}</span>
                  </div>
                  <div v-if="booking.Agreed_Fee" class="text-right shrink-0 font-mono">
                    <span class="text-xs text-emerald-400 font-bold">₱{{ Number(booking.Agreed_Fee).toLocaleString() }}</span>
                  </div>
                </div>

                <!-- Schedule & Venue Details -->
                <div class="space-y-1.5 text-xs text-gray-300 font-Sora">
                  <div class="flex items-center gap-2">
                    <Icon name="ic:baseline-calendar-today" class="text-[#D0D4F7] text-sm shrink-0" />
                    <span>
                      {{ booking.Start_Date || booking.Event_Date }}
                      <span v-if="booking.End_Date && booking.End_Date !== booking.Start_Date"> to {{ booking.End_Date }}</span>
                      <span v-if="booking.Start_Time"> • {{ formatTimeRange12(booking.Start_Time, booking.End_Time) }}</span>
                    </span>
                  </div>

                  <div class="flex items-center gap-2">
                    <Icon name="ic:baseline-location-on" class="text-[#D0D4F7] text-sm shrink-0" />
                    <span class="truncate">{{ booking.Job_ID ? (booking.JOB_LISTING?.Location || booking.Venue_Location) : booking.Venue_Location }}</span>
                  </div>

                  <div class="flex items-center gap-2 text-gray-400 font-mono text-[11px]">
                    <Icon name="ic:outline-receipt-long" class="text-[#D0D4F7] text-sm shrink-0" />
                    <span>Code: {{ booking.Contract_Code || booking.Booking_ID }}</span>
                  </div>
                </div>
              </div>

              <!-- Action Footer -->
              <div class="pt-3 border-t border-[#2A2A2E]/70 flex items-center justify-between">
                <span class="text-[11px] text-gray-500 font-mono">Protected by TONO Guarantee</span>
                <button
                  type="button"
                  @click="initiateCancelBooking(booking)"
                  class="px-3.5 py-1.5 rounded-full border border-red-500/30 hover:border-red-500/60 hover:bg-red-500/10 text-red-300 text-xs font-medium transition-all cursor-pointer">
                  Cancel Booking
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- TAB 2: SENT BOOKING REQUESTS -->
      <div v-else-if="activeTab === 'requests'" class="space-y-6 font-Sora">
        <div class="flex items-center justify-between border-b border-[#2A2A2E] pb-3">
          <div>
            <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Sent Booking Requests</h2>
            <p class="text-xs text-gray-400 mt-0.5">
              Proposals and contract offers sent to artists currently awaiting artist review and setlist additions.
            </p>
          </div>
          <span class="text-xs font-mono text-amber-300 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
            {{ pendingRequests.length }} pending
          </span>
        </div>

        <div v-if="pendingRequests.length === 0" class="text-center py-12 bg-[#131315]/50 border border-dashed border-[#2A2A2E] rounded-2xl space-y-2">
          <Icon name="ic:outline-mark-email-read" class="text-3xl text-gray-500 mx-auto" />
          <p class="text-sm font-semibold text-white">No Pending Booking Requests</p>
          <p class="text-xs text-gray-400">All submitted contract offers have been addressed or finalized.</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div
            v-for="request in pendingRequests"
            :key="request.Booking_ID"
            class="bg-[#1C1C1F]/80 border border-amber-500/20 rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg flex flex-col justify-between">
            <div class="space-y-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <span class="text-[10px] font-mono uppercase tracking-wider text-amber-300">AWAITING ARTIST REVIEW</span>
                  <h3 class="text-base font-bold text-white mt-0.5">{{ request.Contract_Code }}</h3>
                </div>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Pending Review
                </span>
              </div>

              <!-- Artist Info -->
              <div class="flex items-center gap-3 p-3 rounded-xl bg-[#141416] border border-[#2A2A2E]">
                <div class="w-10 h-10 rounded-full bg-[#1E1E24] overflow-hidden border border-[#46464D]/50 shrink-0 flex items-center justify-center">
                  <img
                    v-if="getArtistAvatar(request.ARTIST)"
                    :src="getArtistAvatar(request.ARTIST)"
                    :alt="getArtistDisplayName(request.ARTIST)"
                    class="w-full h-full object-cover" />
                  <Icon v-else name="ic:outline-music-note" class="text-lg text-[#D0D4F7]" />
                </div>
                <div class="min-w-0 flex-1">
                  <h4 class="text-sm font-semibold text-white truncate">{{ getArtistDisplayName(request.ARTIST) }}</h4>
                  <span class="text-[11px] text-gray-400 font-mono">{{ request.ARTIST?.Artist_Type || 'Artist' }}</span>
                </div>
                <div v-if="request.Agreed_Fee" class="text-right shrink-0 font-mono">
                  <span class="text-xs text-emerald-400 font-bold">₱{{ Number(request.Agreed_Fee).toLocaleString() }}</span>
                </div>
              </div>

              <!-- Schedule & Venue Details -->
              <div class="space-y-1.5 text-xs text-gray-300">
                <div class="flex items-center gap-2">
                  <Icon name="ic:baseline-calendar-today" class="text-[#D0D4F7] text-sm shrink-0" />
                  <span>{{ request.Start_Date }} <span v-if="request.Start_Time">• {{ formatTimeRange12(request.Start_Time, request.End_Time) }}</span></span>
                </div>
                <div class="flex items-center gap-2">
                  <Icon name="ic:baseline-location-on" class="text-[#D0D4F7] text-sm shrink-0" />
                  <span class="truncate">{{ request.Venue_Location }}</span>
                </div>
              </div>
            </div>

            <!-- Action Footer -->
            <div class="pt-3 border-t border-[#2A2A2E]/70 flex items-center justify-between">
              <span class="text-[11px] text-gray-400">Offer sent to artist</span>
              <button
                type="button"
                @click="initiateCancelBooking(request)"
                class="px-3.5 py-1.5 rounded-full border border-red-500/30 hover:border-red-500/60 hover:bg-red-500/10 text-red-300 text-xs font-medium transition-all cursor-pointer">
                Withdraw Request
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Toast Notification -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform translate-y-4 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform translate-y-4 opacity-0">
        <div
          v-if="userToast"
          class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-[#161619] border border-[#46464D] rounded-2xl shadow-2xl text-white font-Sora text-sm">
          <Icon name="ic:round-info" class="text-lg text-[#D0D4F7] shrink-0" />
          <p class="font-medium">{{ userToast }}</p>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>