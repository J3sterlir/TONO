<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    artistId?: string
    artistName?: string
    artistAvatar?: string | null
    artistType?: string
  }>(),
  {
    artistId: '',
    artistName: 'Featured Artist',
    artistAvatar: null,
    artistType: 'Solo Artist'
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: any): void
}>()

const supabase = useSupabaseClient()
const db = supabase as any
const { fetchCurrentUserProfile } = useTonoAuth()

const { getNextContractCode } = useCodeGenerator()

// Fallback Contract Code Generation
const generateFallbackContractCode = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const year = now.getFullYear()
  return `BK-${month}${day}01-${year}`
}

const contractCode = ref(generateFallbackContractCode())

const refreshContractCode = async () => {
  try {
    contractCode.value = await getNextContractCode()
  } catch (e) {
    console.warn('Failed to refresh contract code:', e)
  }
}

// Requester Context
const currentAccountId = ref('')
const currentUsername = ref('')
const businessName = ref('Individual Client')
const businessId = ref<string | null>(null)
const isProfileLoaded = ref(false)

// Form States
const bookingType = ref('Direct')
const venueLocation = ref('')
const startDate = ref('')
const endDate = ref('')
const startTime = ref('19:00')
const endTime = ref('22:00')
const agreedFee = ref<number | null>(null)
const description = ref('')
const requiredEquipment = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Auto-Save Draft State
const isDraftSaving = ref(false)
const lastSavedTime = ref('')
const DRAFT_KEY = computed(() => `tono_draft_direct_booking_${props.artistId || 'default'}`)

interface SongItem {
  id: string
  title: string
  duration: string
  source?: 'business' | 'artist' | 'requester'
}

const songLineupList = ref<SongItem[]>([])

const addSong = () => {
  songLineupList.value.push({
    id: `song_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: '',
    duration: '',
    source: 'requester'
  })
}

const removeSong = (index: number) => {
  songLineupList.value.splice(index, 1)
}

// Formatted as comma-separated string for sending to the database
const formattedSongLineup = computed(() => {
  return songLineupList.value
    .map(song => {
      const title = song.title.trim()
      if (!title) return ''
      const duration = song.duration?.trim()
      return duration ? `${title} (${duration})` : title
    })
    .filter(Boolean)
    .join(', ')
})

// 5-Day Rush Booking Proximity Rule
const isRushBooking = computed(() => {
  if (!startDate.value) return false
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const targetDate = new Date(startDate.value)
  targetDate.setHours(0, 0, 0, 0)
  const diffTime = targetDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays >= 0 && diffDays <= 5
})

// Load user context
const loadUserContext = async () => {
  try {
    const profile = await fetchCurrentUserProfile()
    if (profile?.account) {
      currentAccountId.value = profile.account.ACCOUNT_ID
      currentUsername.value = profile.account.Username || ''
    }
    if (profile?.businessProfile) {
      businessName.value = profile.businessProfile.Business_Name || 'Business Client'
      businessId.value = profile.businessProfile.BUSINESS_ID || null
    } else {
      businessName.value = 'Individual Client'
      businessId.value = null
    }
    isProfileLoaded.value = true
  } catch (e) {
    console.error('Failed to load user context for booking modal:', e)
  }
}

// Auto-Save Draft with Debounce (600ms)
let saveTimeout: ReturnType<typeof setTimeout> | null = null

const triggerAutoSave = (immediate = false) => {
  isDraftSaving.value = true
  if (saveTimeout) clearTimeout(saveTimeout)

  const performSave = () => {
    try {
      if (typeof window !== 'undefined') {
        const draft = {
          contractCode: contractCode.value,
          bookingType: bookingType.value,
          venueLocation: venueLocation.value,
          startDate: startDate.value,
          endDate: endDate.value,
          startTime: startTime.value,
          endTime: endTime.value,
          agreedFee: agreedFee.value,
          description: description.value,
          requiredEquipment: requiredEquipment.value,
          songLineupList: songLineupList.value,
          savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
        localStorage.setItem(DRAFT_KEY.value, JSON.stringify(draft))
        lastSavedTime.value = draft.savedAt
      }
    } catch (e) {
      console.error('Failed to save draft:', e)
    } finally {
      isDraftSaving.value = false
    }
  }

  if (immediate) {
    performSave()
  } else {
    saveTimeout = setTimeout(performSave, 600)
  }
}

const handleSaveDraftManual = () => {
  triggerAutoSave(true)
}

// Watch all fields for automatic saving
watch(
  [bookingType, venueLocation, startDate, endDate, startTime, endTime, agreedFee, description, requiredEquipment, songLineupList],
  () => {
    triggerAutoSave()
  },
  { deep: true }
)

// Restore draft on mount or open
const loadDraft = () => {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(DRAFT_KEY.value)
    if (raw) {
      const data = JSON.parse(raw)
      if (data.contractCode) contractCode.value = data.contractCode
      if (data.bookingType) bookingType.value = data.bookingType
      if (data.venueLocation) venueLocation.value = data.venueLocation
      if (data.startDate) startDate.value = data.startDate
      if (data.endDate) endDate.value = data.endDate
      if (data.startTime) startTime.value = data.startTime
      if (data.endTime) endTime.value = data.endTime
      if (data.agreedFee !== undefined) agreedFee.value = data.agreedFee
      if (data.description) description.value = data.description
      if (data.requiredEquipment) requiredEquipment.value = data.requiredEquipment
      if (Array.isArray(data.songLineupList)) songLineupList.value = data.songLineupList
      if (data.savedAt) lastSavedTime.value = data.savedAt
    } else {
      // Default dates
      if (!startDate.value) {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 2)
        const y = tomorrow.getFullYear()
        const m = String(tomorrow.getMonth() + 1).padStart(2, '0')
        const d = String(tomorrow.getDate()).padStart(2, '0')
        startDate.value = `${y}-${m}-${d}`
      }
      if (!endDate.value) endDate.value = startDate.value
    }
  } catch (e) {
    console.error('Failed to load draft:', e)
  }
}

const clearDraft = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(DRAFT_KEY.value)
  }
  lastSavedTime.value = ''
  venueLocation.value = ''
  startDate.value = ''
  endDate.value = ''
  agreedFee.value = null
  description.value = ''
  requiredEquipment.value = ''
  songLineupList.value = []
  refreshContractCode()
}

// Reset form and load draft when modal opens
watch(
  () => props.isOpen,
  async (open) => {
    if (open) {
      errorMessage.value = ''
      successMessage.value = ''
      isSubmitting.value = false
      await loadUserContext()
      loadDraft()
      await refreshContractCode()
    }
  },
  { immediate: true }
)

const handleCancelBooking = () => {
  clearDraft()
  emit('close')
}

const handleSaveContract = async () => {
  if (!currentAccountId.value) {
    errorMessage.value = 'Please log in to your TONO account to send a booking contract.'
    return
  }

  if (!venueLocation.value.trim()) {
    errorMessage.value = 'Please enter a Venue Location.'
    return
  }

  if (!startDate.value) {
    errorMessage.value = 'Please select an Event Start Date.'
    return
  }

  if (!props.artistId) {
    errorMessage.value = 'Target artist could not be identified.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    const songs = songLineupList.value.map(s => ({
      ...s,
      source: businessId.value ? 'business' : 'requester'
    }))

    const payload = {
      Contract_Code: contractCode.value,
      Job_ID: null,
      Provider_Artist_ID: props.artistId,
      Requester_Account_ID: currentAccountId.value,
      Provider_Business_ID: businessId.value || null,
      Booking_Type: bookingType.value || 'Direct',
      Start_Date: startDate.value,
      End_Date: endDate.value || startDate.value,
      Event_Date: startDate.value,
      Start_Time: startTime.value,
      End_Time: endTime.value,
      Venue_Location: venueLocation.value.trim(),
      Agreed_Fee: agreedFee.value ? Number(agreedFee.value) : null,
      Song_Lineup: formattedSongLineup.value,
      Song_Lineup_JSON: songs,
      Required_Equipment: requiredEquipment.value.trim(),
      Status: 'Pending_Artist_Approval',
      Is_Rush_Booking: isRushBooking.value
    }

    let insertRes = await db.from('BOOKING_CONTRACT').insert(payload)

    // Collision retry: if duplicate Contract_Code key, re-fetch latest sequence and retry once
    if (insertRes.error && (insertRes.error.message?.includes('Contract_Code') || insertRes.error.code === '23505')) {
      await refreshContractCode()
      payload.Contract_Code = contractCode.value
      insertRes = await db.from('BOOKING_CONTRACT').insert(payload)
    }

    if (insertRes.error) throw insertRes.error

    successMessage.value = `Booking contract ${contractCode.value} submitted! Sent to ${props.artistName} for review.`
    clearDraft()

    emit('submit', payload)

    setTimeout(() => {
      isSubmitting.value = false
      emit('close')
    }, 1500)
  } catch (err: any) {
    console.error('Booking submission error:', err)
    errorMessage.value = err.message || 'Failed to submit booking contract. Please try again.'
    isSubmitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
      <div class="relative w-full max-w-5xl bg-[#131315] border border-[#2A2A2E]/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white">
        
        <!-- Modal Top Bar -->
        <div class="flex items-center justify-between px-6 sm:px-8 pt-5 mb-2">
          <!-- Automatic Draft Status Indicator -->
          <div class="flex items-center gap-2">
            <div v-if="isDraftSaving" class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">
              <Icon name="ic:baseline-sync" class="animate-spin text-sm" />
              <span>Saving draft...</span>
            </div>
            <div v-else-if="lastSavedTime" class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono" title="Draft saved automatically to local storage">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Draft saved {{ lastSavedTime }}</span>
            </div>

            <!-- Rush Booking Tag -->
            <div v-if="isRushBooking" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
              <Icon name="ic:baseline-bolt" class="text-sm" />
              <span>Rush Booking (&le; 5 Days)</span>
            </div>
          </div>

          <button
            @click="$emit('close')"
            class="flex p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Close">
            <Icon name="ic:round-close" class="text-xl" />
          </button>
        </div>

        <!-- Header with Contract Code and Action Buttons -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-Sora px-6 sm:px-8 pb-5 border-[#46464D]/50 border-b">
          <div class="flex flex-col gap-1">
            <h1 class="text-2xl sm:text-3xl lg:text-[38px] font-bold text-white tracking-tight leading-none">
              {{ contractCode }}
            </h1>
            <h2 class="text-xs sm:text-sm text-[#D0D4F7] font-medium tracking-wide uppercase">
              Direct Artist Booking Contract Creation
            </h2>
          </div>

          <div class="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <!-- Manual Save Draft Button -->
            <button
              type="button"
              @click="handleSaveDraftManual"
              class="text-xs sm:text-sm font-medium text-[#E5E1E4] px-4 py-2 rounded-full border border-[#46464D] hover:bg-white/5 hover:border-gray-400 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5">
              <Icon v-if="isDraftSaving" name="ic:baseline-sync" class="animate-spin text-sm text-[#D0D4F7]" />
              <span>Save Draft</span>
            </button>
            <button
              type="button"
              @click="handleCancelBooking"
              class="text-xs sm:text-sm font-medium text-[#E5E1E4] px-4 py-2 rounded-full border border-[#46464D] hover:border-red-500/50 hover:text-red-300 hover:bg-red-500/10 transition-all cursor-pointer whitespace-nowrap">
              Cancel
            </button>
            <button
              type="button"
              @click="handleSaveContract"
              :disabled="isSubmitting"
              class="text-xs sm:text-sm font-bold text-[#131315] bg-[#D0D4F7] hover:bg-white px-5 sm:px-6 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap shadow-sm disabled:opacity-50 flex items-center gap-2">
              <Icon v-if="isSubmitting" name="ic:baseline-sync" class="animate-spin text-base" />
              <span>{{ isSubmitting ? 'Submitting...' : 'Send Contract Offer' }}</span>
            </button>
          </div>
        </div>

        <!-- Alert messages -->
        <div v-if="errorMessage" class="mx-6 sm:mx-8 mt-4 p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-xs sm:text-sm flex items-center gap-2 font-Sora">
          <Icon name="ic:round-error-outline" class="text-lg text-red-400 shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>

        <div v-if="successMessage" class="mx-6 sm:mx-8 mt-4 p-3.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs sm:text-sm flex items-center gap-2 font-Sora">
          <Icon name="ic:round-check-circle" class="text-lg text-emerald-400 shrink-0" />
          <span>{{ successMessage }}</span>
        </div>

        <!-- Scrollable Form Body -->
        <div class="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 scrollbar-thin scrollbar-hide">
          <!-- Rush Booking Warning Banner -->
          <div v-if="isRushBooking" class="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-amber-200 font-Sora text-xs sm:text-sm">
            <Icon name="ic:baseline-priority-high" class="text-xl text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p class="font-semibold text-amber-300">Notice: 5-Day Rush Booking Proximity Policy</p>
              <p class="text-amber-200/80 mt-0.5">
                This gig is scheduled within 5 days of today. Responses, setlist additions, and approvals should be confirmed promptly. Any subsequent late modifications or cancellations will be subject to TONO reliability sanctions.
              </p>
            </div>
          </div>

          <!-- Participants Card -->
          <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 flex flex-col gap-5">
            <div class="flex items-center gap-3">
              <Icon name="ic:baseline-supervisor-account" class="text-xl text-[#D0D4F7]" />
              <h2 class="text-lg sm:text-xl font-Sora font-semibold text-white">Participants</h2>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">CLIENT / ENTITY</span>
                <p class="text-sm sm:text-base font-medium text-[#E5E1E4] truncate">{{ businessName }}</p>
              </div>
              <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">REQUESTER ACCOUNT</span>
                <p class="text-sm sm:text-base font-medium text-[#E5E1E4] truncate">{{ currentUsername || 'Active User' }}</p>
              </div>
              <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">ARTIST ACCOUNT</span>
                <p class="text-sm sm:text-base font-medium text-[#E5E1E4] truncate">{{ artistName }}</p>
              </div>
              <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">JOB ID / ORIGIN</span>
                <p class="text-sm sm:text-base font-medium text-[#D0D4F7] truncate">Direct Booking</p>
              </div>
            </div>
          </div>

          <!-- Event Details Card -->
          <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 flex flex-col gap-6">
            <div class="flex items-center gap-3">
              <Icon name="ic:baseline-calendar-today" class="text-xl text-[#D0D4F7]" />
              <h2 class="text-lg sm:text-xl font-Sora font-semibold text-white">Event Details</h2>
            </div>

            <!-- Row 1: Booking Type, Venue & Proposed Fee -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 font-Sora">
              <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">BOOKING TYPE</span>
                <input
                  type="text"
                  v-model="bookingType"
                  class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-sm sm:text-base font-medium w-full"
                  placeholder="e.g. Private Gig, Acoustic, Wedding" />
              </div>
              <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">VENUE LOCATION *</span>
                <input
                  type="text"
                  v-model="venueLocation"
                  class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-sm sm:text-base font-medium w-full"
                  placeholder="Venue name & complete address" />
              </div>
              <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">PROPOSED FEE (PHP ₱)</span>
                <div class="flex items-center gap-1.5">
                  <span class="text-gray-400 font-mono text-sm">₱</span>
                  <input
                    type="number"
                    v-model.number="agreedFee"
                    min="0"
                    step="500"
                    class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-sm sm:text-base font-medium w-full font-mono"
                    placeholder="e.g. 15000" />
                </div>
              </div>
            </div>

            <!-- Row 2: Timing & Venue -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 font-Sora">
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                  <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">START DATE *</span>
                  <div class="relative flex items-center">
                    <input
                      type="date"
                      v-model="startDate"
                      class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-sm sm:text-base font-medium cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                    <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                      <Icon name="ic:baseline-calendar-month" class="text-lg" />
                    </div>
                  </div>
                </div>
                <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                  <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">END DATE</span>
                  <div class="relative flex items-center">
                    <input
                      type="date"
                      v-model="endDate"
                      class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-sm sm:text-base font-medium cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                    <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                      <Icon name="ic:baseline-calendar-month" class="text-lg" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3 sm:gap-4">
                <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">START TIME</span>
                    <span v-if="startTime" class="text-[11px] font-mono text-[#D0D4F7] font-semibold">
                      {{ formatTime12(startTime) }}
                    </span>
                  </div>
                  <div class="relative flex items-center">
                    <input
                      type="time"
                      v-model="startTime"
                      class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-sm sm:text-base font-medium cursor-pointer [&::-webkit-datetime-edit]:pr-6 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                    <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                      <Icon name="ic:outline-access-time" class="text-lg" />
                    </div>
                  </div>
                </div>

                <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">END TIME</span>
                    <span v-if="endTime" class="text-[11px] font-mono text-[#D0D4F7] font-semibold">
                      {{ formatTime12(endTime) }}
                    </span>
                  </div>
                  <div class="relative flex items-center">
                    <input
                      type="time"
                      v-model="endTime"
                      class="bg-transparent border-0 outline-none text-[#E5E1E4] block w-full text-sm sm:text-base font-medium cursor-pointer [&::-webkit-datetime-edit]:pr-6 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                    <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                      <Icon name="ic:outline-access-time" class="text-lg" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Divider -->
            <hr class="border-[#2A2A2E]/70 my-1" />

            <!-- Row 3: Description, Technical Setup & Requested Setlist -->
            <div class="flex flex-col gap-4 font-Sora">
              <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl w-full">
                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">BOOKING DESCRIPTION & EXPECTATIONS</span>
                <textarea
                  v-model="description"
                  rows="3"
                  class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-sm sm:text-base font-medium w-full resize-none"
                  placeholder="Detail the event type, audience vibe, special announcements, or key moments."></textarea>
              </div>

              <div class="flex flex-col gap-1 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl w-full">
                <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">EQUIPMENT &amp; TECHNICAL SETUP</span>
                <textarea
                  v-model="requiredEquipment"
                  rows="3"
                  class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-sm sm:text-base font-medium w-full resize-none"
                  placeholder="Detail provided venue PA sound systems, microphones, instruments required, or artist gear to bring."></textarea>
              </div>

              <!-- Song Lineup Card -->
              <div class="flex flex-col gap-2.5 p-4 bg-[#141416] border border-[#46464D]/60 rounded-xl w-full">
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-[11px] font-mono tracking-wider text-[#C7C5CE] uppercase">REQUESTED SONG LINEUP</span>
                    <p class="text-xs text-gray-400">Songs requested by you are locked in the contract. The artist can append additional songs.</p>
                  </div>
                  <span v-if="songLineupList.length" class="text-[11px] font-mono text-[#D0D4F7]">
                    {{ songLineupList.length }} {{ songLineupList.length === 1 ? 'song' : 'songs' }}
                  </span>
                </div>

                <!-- Song Lineup Items -->
                <div class="space-y-2 font-Sora mt-2">
                  <div
                    v-for="(song, index) in songLineupList"
                    :key="song.id"
                    class="group flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#1B1B1E] border border-[#2D2D32]/80 hover:border-[#46464D] rounded-xl transition-all">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                      <!-- Vertical Accent Bar -->
                      <div class="w-1 h-5 rounded-full bg-[#D0D4F7] shrink-0"></div>

                      <!-- Song Title Input -->
                      <input
                        type="text"
                        v-model="song.title"
                        placeholder="Enter requested song title"
                        class="bg-transparent border-0 outline-none text-[#E5E1E4] placeholder-gray-500 text-sm font-medium w-full" />
                    </div>

                    <!-- Duration & Remove Button -->
                    <div class="flex items-center gap-2 shrink-0">
                      <input
                        type="text"
                        v-model="song.duration"
                        placeholder="00:00"
                        class="bg-transparent border-0 outline-none text-gray-400 hover:text-white focus:text-white placeholder-gray-600 text-xs font-mono text-right w-14" />
                      <button
                        type="button"
                        @click="removeSong(index)"
                        class="flex text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
                        title="Remove song">
                        <Icon name="ic:round-close" class="text-base" />
                      </button>
                    </div>
                  </div>

                  <!-- Add song to setlist button -->
                  <button
                    type="button"
                    @click="addSong"
                    class="group flex items-center justify-between w-full px-3.5 py-2.5 bg-[#1B1B1E]/60 hover:bg-[#1B1B1E] border border-[#2D2D32]/60 hover:border-[#46464D] rounded-xl text-gray-400 hover:text-white text-xs sm:text-sm font-medium transition-all cursor-pointer">
                    <span class="flex items-center gap-1.5">
                      <span>+</span>
                      <span>Add requested song to setlist</span>
                    </span>
                    <span class="text-base font-light text-gray-400 group-hover:text-white">+</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
