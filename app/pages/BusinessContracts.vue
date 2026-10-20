<script setup lang="ts">
definePageMeta({
  layout: 'business',
  middleware: ['auth', 'business']
})

import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useTonoReviews } from '~/composables/useTonoReviews'

const supabase = useSupabaseClient()
const db = supabase as any
const { fetchCurrentUserProfile } = useTonoAuth()
const { openReportModal } = useModerationReport()

const activeTab = ref<'all' | 'active' | 'pending' | 'completed' | 'cancelled'>('active')
const isLoading = ref(true)

// Search & Filter Popover State
const contractSearchQuery = ref('')
const contractStatusFilter = ref<'all' | 'active' | 'pending' | 'completed' | 'cancelled'>('all')
const contractTypeFilter = ref<'all' | 'job' | 'direct'>('all')
const contractDateFilter = ref<'all' | 'upcoming' | 'past'>('all')
const isFilterDropdownOpen = ref(false)

// Business Profile Context
const businessProfile = ref<any>(null)
const currentAccountId = ref('')
const businessName = ref('Business Account')
const businessId = ref('')

// Review & Feedback
const { hasUserReviewed } = useTonoReviews()
const isReviewModalOpen = ref(false)
const selectedReviewBooking = ref<any>(null)
const reviewedBookingIds = ref<Set<string>>(new Set())

const openReviewForContract = (contract: any) => {
  selectedReviewBooking.value = contract
  isReviewModalOpen.value = true
}

const handleReviewSubmitted = () => {
  if (selectedReviewBooking.value) {
    reviewedBookingIds.value.add(selectedReviewBooking.value.Booking_ID)
  }
  isReviewModalOpen.value = false
  feedbackMessage.value = {
    status: 'success',
    message: 'Review submitted successfully! Thank you for rating the performer.'
  }
}

// Contracts from Supabase
const contracts = ref<any[]>([])

// Contract Details Modal
const isDetailsModalOpen = ref(false)
const selectedContractForDetails = ref<any>(null)

const openContractDetails = (contract: any) => {
  selectedContractForDetails.value = contract
  isDetailsModalOpen.value = true
}

// Booking Completion
const completingBookingId = ref<string | null>(null)
const currentTime = ref(Date.now())
let completionClock: ReturnType<typeof setInterval> | null = null

// Check whether the booking's scheduled end time has passed.
// Booking schedules are interpreted in Philippine time (UTC+08:00).
const canCompleteContract = (contract: any): boolean => {
  if (!['Confirmed', 'Active'].includes(contract.Status)) {
    return false
  }

  const endDate = contract.End_Date || contract.Start_Date || contract.Event_Date
  const endTime = contract.End_Time

  if (!endDate || !endTime) return false

  const scheduledEnd = new Date(`${endDate}T${endTime}+08:00`)

  // Add a 30-minute allowance for possible performance delays.
  const completionAvailableAt = scheduledEnd.getTime() + 30 * 60 * 1000

  return (
    !Number.isNaN(scheduledEnd.getTime()) &&
    currentTime.value >= completionAvailableAt
  )
}

// 5-Day Proximity Warning Modal
const isWarningModalOpen = ref(false)
const targetContractForCancellation = ref<any>(null)
const feedbackMessage = ref<{ status: 'success' | 'error'; message: string } | null>(null)

// -----------------------------------------------------------------------------
// Database Operations (Fetch, Cancel)
// -----------------------------------------------------------------------------
const fetchContracts = async () => {
  isLoading.value = true
  try {
    const profile = await fetchCurrentUserProfile()
    if (profile?.account) {
      currentAccountId.value = profile.account.ACCOUNT_ID
    }
    if (profile?.businessProfile) {
      businessProfile.value = profile.businessProfile
      businessName.value = profile.businessProfile.Business_Name || 'My Business'
      businessId.value = profile.businessProfile.BUSINESS_ID || ''
    }

    if (currentAccountId.value || businessId.value) {
      const { data, error } = await db
        .from('BOOKING_CONTRACT')
        .select(`
          Booking_ID,
          Contract_Code,
          Job_ID,
          Requester_Account_ID,
          Provider_Artist_ID,
          Provider_Business_ID,
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
          Created_at,
          Is_Rush_Booking,
          Is_Late_Cancellation,
          Cancellation_Reason,
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
            Job_ID,
            Job_Code,
            Event_Title,
            Location
          )
        `)
        .or(`Requester_Account_ID.eq.${currentAccountId.value},Provider_Business_ID.eq.${businessId.value || '00000000-0000-0000-0000-000000000000'}`)
        .order('Created_at', { ascending: false })

      if (!error && data) {
        contracts.value = data
        checkQueryTriggers()

        // Check if any completed contracts have already been reviewed
        for (const c of data) {
          if (c.Status === 'Completed' && currentAccountId.value) {
            hasUserReviewed(c.Booking_ID, currentAccountId.value).then((already: boolean) => {
              if (already) {
                reviewedBookingIds.value.add(c.Booking_ID)
              }
            })
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to load contracts:', e)
  } finally {
    isLoading.value = false
  }
}

// Deep Linking from Notifications
const route = useRoute()
const checkQueryTriggers = () => {
  const contractId = route.query.contractId as string
  if (!contractId || contracts.value.length === 0) return

  const target = contracts.value.find(c => c.Booking_ID === contractId)
  if (target) {
    if (['Confirmed', 'Active'].includes(target.Status)) {
      setTab('active')
    } else if (['Pending_Artist_Approval', 'Pending'].includes(target.Status)) {
      setTab('pending')
    } else if (target.Status === 'Completed') {
      setTab('completed')
    } else {
      setTab('cancelled')
    }
    openContractDetails(target)
  }
}

watch(() => route.query.contractId, () => {
  checkQueryTriggers()
})

// Realtime Zero-Refresh: Sync booking contract status changes live
let businessContractChannel: any = null
const setupRealtimeSync = () => {
  if (businessContractChannel) return

  businessContractChannel = supabase
    .channel('business-contracts-live')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'BOOKING_CONTRACT'
      },
      async () => {
        // Refresh contract table in background without page refresh
        await fetchContracts()
      }
    )
    .subscribe()
}

// -----------------------------------------------------------------------------
// Cancellation & 5-Day Proximity Interception
// -----------------------------------------------------------------------------
const initiateCancelContract = (contract: any) => {
  if (canCompleteContract(contract) || contract.Status === 'Completed') {
    feedbackMessage.value = {
      status: 'error',
      message: 'This booking has already concluded and cannot be cancelled. Please mark it as completed.'
    }
    return
  }
  targetContractForCancellation.value = contract
  isWarningModalOpen.value = true
}

const handleConfirmCancellation = async (reason: string, isLateParam?: boolean) => {
  if (!targetContractForCancellation.value) return
  const contract = targetContractForCancellation.value

  if (canCompleteContract(contract) || contract.Status === 'Completed') {
    feedbackMessage.value = {
      status: 'error',
      message: 'This booking has already concluded and cannot be cancelled. Please mark it as completed.'
    }
    isWarningModalOpen.value = false
    targetContractForCancellation.value = null
    return
  }

  const targetDate = contract.Start_Date || contract.Event_Date
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const startDateObj = new Date(targetDate)
  startDateObj.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((startDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const isLate = isLateParam !== undefined ? isLateParam : (diffDays <= 5 && diffDays >= 0)

  try {
    const { error } = await db
      .from('BOOKING_CONTRACT')
      .update({
        Status: 'Cancelled',
        Cancellation_Reason: reason,
        Cancelled_By: currentAccountId.value,
        Is_Late_Cancellation: isLate
      })
      .eq('Booking_ID', contract.Booking_ID)

    if (error) throw error

    // Free slots for Job Listing if tied to one
    if (contract.Job_ID) {
      // Check if any other active or pending contracts remain for this job
      const { data: otherContracts } = await db
        .from('BOOKING_CONTRACT')
        .select('Booking_ID')
        .eq('Job_ID', contract.Job_ID)
        .neq('Booking_ID', contract.Booking_ID)
        .not('Status', 'in', '("Cancelled","Declined")')

      if (!otherContracts || otherContracts.length === 0) {
        // Free slots: revert JOB_LISTING back to Open
        await db
          .from('JOB_LISTING')
          .update({ Status: 'Open' })
          .eq('Job_ID', contract.Job_ID)
      }
    }

    feedbackMessage.value = {
      status: 'success',
      message: `Contract ${contract.Contract_Code} cancelled successfully.${contract.Job_ID ? ' Open slots have been restored for this job listing.' : ''}`
    }

    isWarningModalOpen.value = false
    targetContractForCancellation.value = null
    await fetchContracts()
  } catch (err: any) {
    console.error('Failed to cancel contract:', err)
    feedbackMessage.value = {
      status: 'error',
      message: err.message || 'Failed to cancel contract.'
    }
  }
}

// -----------------------------------------------------------------------------
// Booking Completion
// -----------------------------------------------------------------------------
const handleCompleteContract = async (contract: any) => {
  // Prevent duplicate requests and premature completion.
  if (completingBookingId.value || !canCompleteContract(contract)) return

  // Require explicit confirmation before changing the contract status.
  const confirmed = window.confirm(
    `Mark contract ${contract.Contract_Code || ''} as completed? This will move it to your contract history.`
  )

  if (!confirmed) return

  completingBookingId.value = contract.Booking_ID

  try {
    // Retrieve the current Supabase access token for API authentication.
    const { data, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) throw sessionError

    const accessToken = data.session?.access_token

    if (!accessToken) {
      throw new Error('Your session has expired. Please log in again.')
    }

    // The server validates the participant, booking status, and end time.
    await $fetch('/api/bookings/complete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: {
        bookingId: contract.Booking_ID
      }
    })

    // Display the result and refresh the contract lists.
    feedbackMessage.value = {
      status: 'success',
      message: `Contract ${contract.Contract_Code} marked as completed successfully.`
    }

    await fetchContracts()
  } catch (err: any) {
    console.error('Failed to complete contract:', err)

    feedbackMessage.value = {
      status: 'error',
      message:
        err.data?.statusMessage ||
        err.statusMessage ||
        err.message ||
        'Failed to complete contract.'
    }
  } finally {
    completingBookingId.value = null
  }
}

// -----------------------------------------------------------------------------
// Filtered Views
// -----------------------------------------------------------------------------
const activeContracts = computed(() => {
  return contracts.value.filter(c => ['Confirmed', 'Active'].includes(c.Status))
})

const pendingContracts = computed(() => {
  return contracts.value.filter(c => ['Pending_Artist_Approval', 'Pending'].includes(c.Status))
})

const completedContracts = computed(() => {
  return contracts.value.filter(c => c.Status === 'Completed')
})

const cancelledContracts = computed(() => {
  return contracts.value.filter(c => ['Cancelled', 'Declined'].includes(c.Status))
})

const isContractPast = (contract: any): boolean => {
  if (['Completed', 'Cancelled', 'Declined'].includes(contract.Status)) return true
  const targetDate = contract.End_Date || contract.Start_Date || contract.Event_Date
  if (!targetDate) return false
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return targetDate < todayStr
}

const activeFilterCount = computed(() => {
  let count = 0
  if (contractTypeFilter.value !== 'all') count++
  if (contractStatusFilter.value !== 'all') count++
  if (contractDateFilter.value !== 'all') count++
  return count
})

const hasActiveFilters = computed(() => {
  return (
    contractSearchQuery.value.trim() !== '' ||
    contractTypeFilter.value !== 'all' ||
    contractStatusFilter.value !== 'all' ||
    contractDateFilter.value !== 'all'
  )
})

const resetContractFilters = () => {
  contractSearchQuery.value = ''
  contractTypeFilter.value = 'all'
  contractStatusFilter.value = 'all'
  contractDateFilter.value = 'all'
}

const setTab = (tab: 'all' | 'active' | 'pending' | 'completed' | 'cancelled') => {
  activeTab.value = tab
  contractStatusFilter.value = tab
}

const setStatusFilter = (status: 'all' | 'active' | 'pending' | 'completed' | 'cancelled') => {
  contractStatusFilter.value = status
  activeTab.value = status
}

const filteredContracts = computed(() => {
  return contracts.value.filter((contract: any) => {
    // 1. Tab Status Filter
    if (activeTab.value === 'active' && !['Confirmed', 'Active'].includes(contract.Status)) return false
    if (activeTab.value === 'pending' && !['Pending_Artist_Approval', 'Pending'].includes(contract.Status)) return false
    if (activeTab.value === 'completed' && contract.Status !== 'Completed') return false
    if (activeTab.value === 'cancelled' && !['Cancelled', 'Declined'].includes(contract.Status)) return false

    // 2. Type Filter (Direct Booking vs Job Listing)
    if (contractTypeFilter.value === 'job' && !contract.Job_ID) return false
    if (contractTypeFilter.value === 'direct' && contract.Job_ID) return false

    // 3. Date Filter (Upcoming vs Past)
    if (contractDateFilter.value !== 'all') {
      const past = isContractPast(contract)
      if (contractDateFilter.value === 'upcoming' && past) return false
      if (contractDateFilter.value === 'past' && !past) return false
    }

    // 4. Text Search
    if (contractSearchQuery.value.trim()) {
      const q = contractSearchQuery.value.toLowerCase().trim()
      const code = (contract.Contract_Code || '').toLowerCase()
      const artist = getArtistName(contract).toLowerCase()
      const gig = (contract.JOB_LISTING?.Event_Title || '').toLowerCase()
      const venue = (contract.Venue_Location || '').toLowerCase()
      if (!code.includes(q) && !artist.includes(q) && !gig.includes(q) && !venue.includes(q)) {
        return false
      }
    }

    return true
  })
})

const getArtistName = (contract: any) => {
  const artist = contract.ARTIST
  if (!artist) return 'Performing Artist'
  return artist.StageName?.[0]?.Artist_Name || artist.BandName?.[0]?.Band_Name || artist.USER_ACCOUNT?.Username || 'Artist'
}

onMounted(async () => {
  await fetchContracts()
  setupRealtimeSync()

  // Refresh the current time every 30 seconds for button availability.
  completionClock = setInterval(() => {
    currentTime.value = Date.now()
  }, 30_000)
})

onBeforeUnmount(() => {
  if (businessContractChannel) {
    supabase.removeChannel(businessContractChannel)
    businessContractChannel = null
  }
    // Stop the timer when leaving the page.
  if (completionClock) {
    clearInterval(completionClock)
    completionClock = null
  }
})
</script>

<template>
  <head>
    <title>Business Contracts | TONO</title>
  </head>
  <div class="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-10 space-y-8 font-Sora">

    <!-- Sanction Warning Modal -->
    <SanctionWarningModal
      :is-open="isWarningModalOpen"
      action-type="cancel"
      target-type="contract"
      :item-title="targetContractForCancellation?.Contract_Code || 'Booking Contract'"
      :start-date="targetContractForCancellation?.Start_Date || targetContractForCancellation?.Event_Date || ''"
      @close="isWarningModalOpen = false"
      @confirm="handleConfirmCancellation"
    />

    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A2A2E] pb-6">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Business Contracts</h1>
        <p class="text-xs sm:text-sm text-gray-400 mt-1">
          Monitor active commitments, track pending agreements, and manage verified performance contracts for {{ businessName }}.
        </p>
      </div>
    </div>

    <!-- Alert / Feedback Notification -->
    <div
      v-if="feedbackMessage"
      class="p-4 rounded-xl border flex items-center justify-between text-xs"
      :class="feedbackMessage.status === 'success' ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' : 'bg-red-950/30 border-red-500/40 text-red-200'"
    >
      <div class="flex items-center gap-2">
        <Icon :name="feedbackMessage.status === 'success' ? 'ic:round-check-circle' : 'ic:baseline-error'" class="text-lg shrink-0" />
        <span>{{ feedbackMessage.message }}</span>
      </div>
      <button @click="feedbackMessage = null" class="text-gray-400 hover:text-white cursor-pointer">
        <Icon name="ic:round-close" class="text-base" />
      </button>
    </div>

    <!-- ========================================================================= -->
    <!-- CONTRACTS OVERVIEW: TABS & CARDS -->
    <!-- ========================================================================= -->
    <div class="space-y-6">

      <!-- Search and Filter Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <!-- Search Input -->
        <div class="relative flex-1 max-w-md">
          <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Icon name="ic:baseline-search" class="text-lg" />
          </div>
          <input
            type="text"
            v-model="contractSearchQuery"
            placeholder="Search by artist, contract code, gig title, venue..."
            class="w-full bg-[#1C1C1F] border border-[#2A2A2E] focus:border-[#D0D4F7] rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition-all shadow-inner"
          />
          <button
            v-if="contractSearchQuery"
            type="button"
            @click="contractSearchQuery = ''"
            class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white cursor-pointer"
          >
            <Icon name="ic:round-close" class="text-sm" />
          </button>
        </div>

        <!-- Filter Icon Dropdown Container (Design matching Artistprofile.vue) -->
        <div class="relative shrink-0">
          <button
            type="button"
            @click="isFilterDropdownOpen = !isFilterDropdownOpen"
            class="flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-sm select-none"
            :class="isFilterDropdownOpen || activeFilterCount > 0
              ? 'bg-[#D0D4F7] text-[#131315] border-[#D0D4F7]'
              : 'bg-[#1C1C1F] hover:bg-[#252529] text-gray-300 hover:text-white border-[#2A2A2E]'"
          >
            <Icon name="ic:outline-filter-alt" class="text-base shrink-0" />
            <span>Filter</span>
            <span
              v-if="activeFilterCount > 0"
              class="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0"
              :class="isFilterDropdownOpen || activeFilterCount > 0 ? 'bg-[#131315] text-[#D0D4F7]' : 'bg-[#D0D4F7] text-[#131315]'"
            >
              {{ activeFilterCount }}
            </span>
            <Icon
              name="ic:baseline-keyboard-arrow-down"
              class="text-sm transition-transform duration-200 shrink-0"
              :class="isFilterDropdownOpen ? 'rotate-180' : ''"
            />
          </button>

          <!-- Backdrop to close on click outside -->
          <div
            v-if="isFilterDropdownOpen"
            class="fixed inset-0 z-20"
            @click="isFilterDropdownOpen = false"
          ></div>

          <!-- Dropdown Popover -->
          <div
            v-if="isFilterDropdownOpen"
            @click.stop
            class="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4 shadow-2xl z-30 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-[#2A2A2E] pb-2.5">
              <div class="flex items-center gap-1.5 text-white font-semibold text-xs">
                <Icon name="ic:outline-filter-alt" class="text-sm text-[#D0D4F7]" />
                <span>Filter Contracts</span>
              </div>
              <button
                v-if="hasActiveFilters"
                type="button"
                @click="resetContractFilters"
                class="text-[11px] font-mono text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Reset All
              </button>
            </div>

            <!-- 1. Type Filter -->
            <div class="space-y-1.5">
              <label class="text-[10px] font-mono uppercase tracking-wider text-gray-400 block">
                Type
              </label>
              <div class="grid grid-cols-3 gap-1 bg-[#131315] p-1 rounded-xl border border-[#2A2A2E] text-xs">
                <button
                  type="button"
                  @click="contractTypeFilter = 'all'"
                  class="py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer font-medium"
                  :class="contractTypeFilter === 'all' ? 'bg-[#D0D4F7] text-[#131315] font-bold shadow-sm' : 'text-gray-400 hover:text-white'"
                >
                  All
                </button>
                <button
                  type="button"
                  @click="contractTypeFilter = 'job'"
                  class="py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer font-medium truncate"
                  :class="contractTypeFilter === 'job' ? 'bg-[#D0D4F7] text-[#131315] font-bold shadow-sm' : 'text-gray-400 hover:text-white'"
                >
                  Job Listing
                </button>
                <button
                  type="button"
                  @click="contractTypeFilter = 'direct'"
                  class="py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer font-medium"
                  :class="contractTypeFilter === 'direct' ? 'bg-[#D0D4F7] text-[#131315] font-bold shadow-sm' : 'text-gray-400 hover:text-white'"
                >
                  Direct
                </button>
              </div>
            </div>

            <!-- 2. Status Filter -->
            <div class="space-y-1.5">
              <label class="text-[10px] font-mono uppercase tracking-wider text-gray-400 block">
                Status
              </label>
              <div class="grid grid-cols-2 gap-1.5 bg-[#131315] p-1.5 rounded-xl border border-[#2A2A2E] text-xs">
                <button
                  type="button"
                  @click="setStatusFilter('all')"
                  class="py-1.5 px-2.5 rounded-lg text-left transition-all cursor-pointer flex items-center justify-between col-span-2"
                  :class="contractStatusFilter === 'all' ? 'bg-[#D0D4F7] text-[#131315] font-bold shadow-sm' : 'text-gray-400 hover:text-white'"
                >
                  <span>None (Show All)</span>
                  <span class="text-[10px] font-mono opacity-80">{{ contracts.length }}</span>
                </button>
                <button
                  type="button"
                  @click="setStatusFilter('active')"
                  class="py-1.5 px-2.5 rounded-lg text-left transition-all cursor-pointer flex items-center justify-between"
                  :class="contractStatusFilter === 'active' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30' : 'text-gray-400 hover:text-white'"
                >
                  <span>Active</span>
                  <span class="text-[10px] font-mono opacity-80">{{ activeContracts.length }}</span>
                </button>
                <button
                  type="button"
                  @click="setStatusFilter('pending')"
                  class="py-1.5 px-2.5 rounded-lg text-left transition-all cursor-pointer flex items-center justify-between"
                  :class="contractStatusFilter === 'pending' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : 'text-gray-400 hover:text-white'"
                >
                  <span>Pending</span>
                  <span class="text-[10px] font-mono opacity-80">{{ pendingContracts.length }}</span>
                </button>
                <button
                  type="button"
                  @click="setStatusFilter('completed')"
                  class="py-1.5 px-2.5 rounded-lg text-left transition-all cursor-pointer flex items-center justify-between"
                  :class="contractStatusFilter === 'completed' ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30' : 'text-gray-400 hover:text-white'"
                >
                  <span>Completed</span>
                  <span class="text-[10px] font-mono opacity-80">{{ completedContracts.length }}</span>
                </button>
                <button
                  type="button"
                  @click="setStatusFilter('cancelled')"
                  class="py-1.5 px-2.5 rounded-lg text-left transition-all cursor-pointer flex items-center justify-between"
                  :class="contractStatusFilter === 'cancelled' ? 'bg-red-500/20 text-red-300 font-bold border border-red-500/30' : 'text-gray-400 hover:text-white'"
                >
                  <span>Cancelled</span>
                  <span class="text-[10px] font-mono opacity-80">{{ cancelledContracts.length }}</span>
                </button>
              </div>
            </div>

            <!-- 3. Date Filter -->
            <div class="space-y-1.5">
              <label class="text-[10px] font-mono uppercase tracking-wider text-gray-400 block">
                Date
              </label>
              <div class="grid grid-cols-3 gap-1 bg-[#131315] p-1 rounded-xl border border-[#2A2A2E] text-xs">
                <button
                  type="button"
                  @click="contractDateFilter = 'all'"
                  class="py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer font-medium"
                  :class="contractDateFilter === 'all' ? 'bg-[#D0D4F7] text-[#131315] font-bold shadow-sm' : 'text-gray-400 hover:text-white'"
                >
                  All
                </button>
                <button
                  type="button"
                  @click="contractDateFilter = 'upcoming'"
                  class="py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer font-medium"
                  :class="contractDateFilter === 'upcoming' ? 'bg-[#D0D4F7] text-[#131315] font-bold shadow-sm' : 'text-gray-400 hover:text-white'"
                >
                  Upcoming
                </button>
                <button
                  type="button"
                  @click="contractDateFilter = 'past'"
                  class="py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer font-medium"
                  :class="contractDateFilter === 'past' ? 'bg-[#D0D4F7] text-[#131315] font-bold shadow-sm' : 'text-gray-400 hover:text-white'"
                >
                  Past
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation Filter Tabs -->
      <div class="flex items-center gap-2 border-b border-[#2A2A2E] pb-3 text-xs overflow-x-auto">
        <button
          type="button"
          @click="setTab('all')"
          class="px-4 py-2 rounded-full font-medium transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap"
          :class="activeTab === 'all' ? 'bg-[#D0D4F7] text-[#0E0E10] font-bold shadow' : 'bg-[#1C1C1F] text-gray-300 border border-[#3A3A3C] hover:bg-white/5'"
        >
          <span>All Contracts</span>
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-mono" :class="activeTab === 'all' ? 'bg-[#0E0E10]/20 text-[#0E0E10]' : 'bg-white/10 text-gray-300'">
            {{ contracts.length }}
          </span>
        </button>

        <button
          type="button"
          @click="setTab('active')"
          class="px-4 py-2 rounded-full font-medium transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap"
          :class="activeTab === 'active' ? 'bg-[#D0D4F7] text-[#0E0E10] font-bold shadow' : 'bg-[#1C1C1F] text-gray-300 border border-[#3A3A3C] hover:bg-white/5'"
        >
          <span>Active</span>
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-mono" :class="activeTab === 'active' ? 'bg-[#0E0E10]/20 text-[#0E0E10]' : 'bg-white/10 text-gray-300'">
            {{ activeContracts.length }}
          </span>
        </button>

        <button
          type="button"
          @click="setTab('pending')"
          class="px-4 py-2 rounded-full font-medium transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap"
          :class="activeTab === 'pending' ? 'bg-[#D0D4F7] text-[#0E0E10] font-bold shadow' : 'bg-[#1C1C1F] text-gray-300 border border-[#3A3A3C] hover:bg-white/5'"
        >
          <span>Pending Approval</span>
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-mono" :class="activeTab === 'pending' ? 'bg-[#0E0E10]/20 text-[#0E0E10]' : 'bg-white/10 text-gray-300'">
            {{ pendingContracts.length }}
          </span>
        </button>

        <button
          type="button"
          @click="setTab('completed')"
          class="px-4 py-2 rounded-full font-medium transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap"
          :class="activeTab === 'completed' ? 'bg-[#D0D4F7] text-[#0E0E10] font-bold shadow' : 'bg-[#1C1C1F] text-gray-300 border border-[#3A3A3C] hover:bg-white/5'"
        >
          <span>Completed</span>
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-mono" :class="activeTab === 'completed' ? 'bg-[#0E0E10]/20 text-[#0E0E10]' : 'bg-white/10 text-gray-300'">
            {{ completedContracts.length }}
          </span>
        </button>

        <button
          type="button"
          @click="setTab('cancelled')"
          class="px-4 py-2 rounded-full font-medium transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap"
          :class="activeTab === 'cancelled' ? 'bg-[#D0D4F7] text-[#0E0E10] font-bold shadow' : 'bg-[#1C1C1F] text-gray-300 border border-[#3A3A3C] hover:bg-white/5'"
        >
          <span>Cancelled</span>
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-mono" :class="activeTab === 'cancelled' ? 'bg-[#0E0E10]/20 text-[#0E0E10]' : 'bg-white/10 text-gray-300'">
            {{ cancelledContracts.length }}
          </span>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
        <div v-for="i in 4" :key="i" class="h-44 bg-[#1C1C1F] rounded-2xl border border-[#2A2A2E]"></div>
      </div>

      <!-- Contracts Grid View -->
      <div v-else>
        <!-- Empty State -->
        <div
          v-if="filteredContracts.length === 0"
          class="text-center py-16 bg-[#131315]/50 border border-dashed border-[#2A2A2E] rounded-2xl space-y-3"
        >
          <Icon name="ic:outline-assignment" class="text-4xl text-gray-500 mx-auto" />
          <h3 class="text-base font-semibold text-white">
            <span v-if="activeTab === 'all'">No Contracts Found</span>
            <span v-else-if="activeTab === 'active'">No Active Contracts</span>
            <span v-else-if="activeTab === 'pending'">No Pending Contract Offers</span>
            <span v-else-if="activeTab === 'completed'">No Completed Contracts</span>
            <span v-else>No Cancelled Contracts</span>
          </h3>
          <p v-if="hasActiveFilters" class="text-xs text-gray-400">
            No contracts match your current search or filter criteria.
          </p>
          <button
            v-if="hasActiveFilters"
            type="button"
            @click="resetContractFilters"
            class="mt-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>

        <!-- Populated Cards Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div
            v-for="contract in filteredContracts"
            :key="contract.Booking_ID"
            @click="openContractDetails(contract)"
            class="bg-[#1C1C1F]/80 border rounded-2xl p-5 sm:p-6 space-y-4 transition-all shadow-lg group cursor-pointer"
            :class="{
              'border-[#2A2A2E] hover:border-[#46464D]': ['Confirmed', 'Active'].includes(contract.Status),
              'border-amber-500/20 hover:border-amber-500/50': ['Pending_Artist_Approval', 'Pending'].includes(contract.Status),
              'border-blue-500/20 hover:border-blue-500/50': contract.Status === 'Completed',
              'border-red-500/20 hover:border-red-500/50 bg-[#1C1C1F]/50': ['Cancelled', 'Declined'].includes(contract.Status)
            }"
          >
            <!-- 1. ACTIVE CONTRACT CARD -->
            <template v-if="['Confirmed', 'Active'].includes(contract.Status)">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <span class="text-[10px] font-mono text-[#D0D4F7] uppercase tracking-wider">{{ contract.Contract_Code }}</span>
                  <h3 class="text-lg font-bold text-white group-hover:text-[#D0D4F7] transition-colors mt-0.5">
                    {{ getArtistName(contract) }}
                  </h3>
                  <p v-if="contract.JOB_LISTING?.Event_Title" class="text-xs text-gray-400">
                    Gig: {{ contract.JOB_LISTING.Event_Title }}
                  </p>
                </div>

                <div class="flex items-center gap-1.5">
                  <span v-if="contract.Is_Rush_Booking" class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                    <Icon name="ic:baseline-bolt" class="text-xs" />
                    <span>Rush</span>
                  </span>
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {{ contract.Status }}
                  </span>
                </div>
              </div>

              <!-- Schedule & Location -->
              <div class="space-y-1.5 text-xs text-gray-300">
                <div class="flex items-center gap-2">
                  <Icon name="ic:baseline-calendar-today" class="text-[#D0D4F7] text-sm shrink-0" />
                  <span>
                    {{ contract.Start_Date || contract.Event_Date }}
                    <span v-if="contract.End_Date && contract.End_Date !== contract.Start_Date"> to {{ contract.End_Date }}</span>
                    <span v-if="contract.Start_Time"> • {{ formatTimeRange12(contract.Start_Time, contract.End_Time) }}</span>
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <Icon name="ic:baseline-location-on" class="text-[#D0D4F7] text-sm shrink-0" />
                  <span class="truncate">{{ contract.Venue_Location }}</span>
                </div>
                <div v-if="contract.Agreed_Fee" class="flex items-center gap-2">
                  <Icon name="ic:baseline-payments" class="text-[#D0D4F7] text-sm shrink-0" />
                  <span class="font-mono text-emerald-400 font-semibold">Fee: ₱{{ Number(contract.Agreed_Fee).toLocaleString() }}</span>
                </div>
              </div>

              <!-- Footer Actions -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#2A2A2E] text-xs">
                <span class="text-[10px] font-mono text-gray-400">
                  Type: {{ contract.Booking_Type || 'Direct' }}
                </span>

                <!-- For Direct Bookings: Show completion & cancellation controls -->
                <div v-if="!contract.Job_ID" class="flex items-center gap-2 flex-wrap w-full sm:w-auto sm:justify-end">
                  <button
                    v-if="canCompleteContract(contract)"
                    type="button"
                    :disabled="completingBookingId !== null"
                    @click.stop="handleCompleteContract(contract)"
                    class="w-full sm:w-auto px-4 py-2 sm:py-1.5 rounded-full border border-emerald-500/40 text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-semibold shadow-sm"
                  >
                    <Icon name="ic:round-check-circle" class="text-sm text-emerald-400" />
                    <span>{{ completingBookingId === contract.Booking_ID ? 'Completing...' : 'Mark as Completed' }}</span>
                  </button>

                  <button
                    v-else
                    type="button"
                    @click.stop="initiateCancelContract(contract)"
                    class="w-full sm:w-auto px-3.5 py-1.5 rounded-full border border-red-500/30 text-red-300 hover:bg-red-500/10 hover:border-red-500/60 transition-all cursor-pointer flex items-center justify-center"
                  >
                    Cancel Contract
                  </button>
                </div>

                <!-- For Job-Tied Bookings: Managed centrally via Job Listings -->
                <div v-else class="flex items-center gap-2">
                  <span class="text-[11px] text-gray-400 italic">Managed via Job Listing</span>
                  <NuxtLink
                    to="/businessjoblist"
                    @click.stop
                    class="px-3 py-1 rounded-full text-xs font-medium border border-[#3A3A3C] text-[#D0D4F7] hover:bg-white/5 transition-colors flex items-center gap-1"
                  >
                    <span>View Job</span>
                    <Icon name="ic:round-arrow-forward" class="text-xs" />
                  </NuxtLink>
                </div>
              </div>
            </template>

            <!-- 2. PENDING CONTRACT CARD -->
            <template v-else-if="['Pending_Artist_Approval', 'Pending'].includes(contract.Status)">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <span class="text-[10px] font-mono text-amber-400 uppercase tracking-wider">{{ contract.Contract_Code }}</span>
                  <h3 class="text-base font-bold text-white group-hover:text-[#D0D4F7] transition-colors mt-0.5">{{ getArtistName(contract) }}</h3>
                  <p v-if="contract.JOB_LISTING?.Event_Title" class="text-xs text-gray-400">
                    Gig: {{ contract.JOB_LISTING.Event_Title }}
                  </p>
                </div>

                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Awaiting Artist Review
                </span>
              </div>

              <div class="space-y-1.5 text-xs text-gray-300">
                <p class="flex items-center gap-2">
                  <Icon name="ic:baseline-calendar-today" class="text-[#D0D4F7] text-sm shrink-0" />
                  <span>{{ contract.Start_Date || contract.Event_Date }} <span v-if="contract.Start_Time">• {{ formatTimeRange12(contract.Start_Time, contract.End_Time) }}</span></span>
                </p>
                <p class="flex items-center gap-2">
                  <Icon name="ic:baseline-location-on" class="text-[#D0D4F7] text-sm shrink-0" />
                  <span class="truncate">{{ contract.Venue_Location }}</span>
                </p>
                <p v-if="contract.Agreed_Fee" class="flex items-center gap-2">
                  <Icon name="ic:baseline-payments" class="text-[#D0D4F7] text-sm shrink-0" />
                  <span class="font-mono text-emerald-400">Offered Fee: ₱{{ Number(contract.Agreed_Fee).toLocaleString() }}</span>
                </p>
              </div>

              <div class="flex items-center justify-between pt-3 border-t border-[#2A2A2E] text-xs">
                <span class="text-[10px] text-gray-500 italic">Artist reviewing contract &amp; setlist</span>
                <button
                  v-if="!contract.Job_ID"
                  type="button"
                  @click.stop="initiateCancelContract(contract)"
                  class="px-3.5 py-1.5 rounded-full border border-red-500/30 text-red-300 hover:bg-red-500/10 hover:border-red-500/60 transition-all cursor-pointer"
                >
                  Withdraw Offer
                </button>
                <NuxtLink
                  v-else
                  to="/businessjoblist"
                  @click.stop
                  class="text-[11px] text-[#D0D4F7] hover:underline flex items-center gap-1"
                >
                  <span>Managed in Job Listings</span>
                  <Icon name="ic:round-arrow-forward" class="text-xs" />
                </NuxtLink>
              </div>
            </template>

            <!-- 3. COMPLETED CONTRACT CARD -->
            <template v-else-if="contract.Status === 'Completed'">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <span class="text-[10px] font-mono text-[#D0D4F7] uppercase tracking-wider">{{ contract.Contract_Code }}</span>
                  <h3 class="text-base font-bold text-white group-hover:text-[#D0D4F7] transition-colors mt-0.5">{{ getArtistName(contract) }}</h3>
                  <p v-if="contract.JOB_LISTING?.Event_Title" class="text-xs text-gray-400">
                    Gig: {{ contract.JOB_LISTING.Event_Title }}
                  </p>
                </div>

                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1">
                  <Icon name="ic:round-check-circle" class="text-xs" />
                  <span>Completed</span>
                </span>
              </div>

              <div class="space-y-1.5 text-xs text-gray-300">
                <p class="flex items-center gap-2">
                  <Icon name="ic:baseline-calendar-today" class="text-[#D0D4F7] text-sm shrink-0" />
                  <span>{{ contract.Start_Date || contract.Event_Date }} <span v-if="contract.Start_Time">• {{ formatTimeRange12(contract.Start_Time, contract.End_Time) }}</span></span>
                </p>
                <p class="flex items-center gap-2">
                  <Icon name="ic:baseline-location-on" class="text-[#D0D4F7] text-sm shrink-0" />
                  <span class="truncate">{{ contract.Venue_Location }}</span>
                </p>
                <p v-if="contract.Agreed_Fee" class="flex items-center gap-2">
                  <Icon name="ic:baseline-payments" class="text-[#D0D4F7] text-sm shrink-0" />
                  <span class="font-mono text-emerald-400 font-semibold">Total Fee: ₱{{ Number(contract.Agreed_Fee).toLocaleString() }}</span>
                </p>
              </div>

              <!-- Rating & Feedback Actions -->
              <div class="flex items-center justify-between pt-3 border-t border-[#2A2A2E] text-xs">
                <span class="text-[11px] text-gray-400">Performance completed</span>
                <button
                  type="button"
                  :disabled="reviewedBookingIds.has(contract.Booking_ID)"
                  @click.stop="openReviewForContract(contract)"
                  class="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                  :class="reviewedBookingIds.has(contract.Booking_ID) ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 cursor-default' : 'bg-[#D0D4F7] hover:bg-white text-[#0E0E10] shadow'"
                >
                  <Icon :name="reviewedBookingIds.has(contract.Booking_ID) ? 'ic:round-check' : 'ic:round-star'" class="text-sm" />
                  <span>{{ reviewedBookingIds.has(contract.Booking_ID) ? 'Reviewed' : 'Rate Performer' }}</span>
                </button>
              </div>
            </template>

            <!-- 4. CANCELLED CONTRACT CARD -->
            <template v-else>
              <div class="flex items-start justify-between gap-3">
                <div>
                  <span class="text-[10px] font-mono text-gray-400 uppercase tracking-wider">{{ contract.Contract_Code }}</span>
                  <h3 class="text-base font-bold text-white group-hover:text-[#D0D4F7] transition-colors mt-0.5">{{ getArtistName(contract) }}</h3>
                  <p v-if="contract.JOB_LISTING?.Event_Title" class="text-xs text-gray-400">
                    Gig: {{ contract.JOB_LISTING.Event_Title }}
                  </p>
                </div>

                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-red-500/10 text-red-300 border border-red-500/20">
                  {{ contract.Status }}
                </span>
              </div>

              <div class="space-y-1.5 text-xs text-gray-300">
                <p class="flex items-center gap-2">
                  <Icon name="ic:baseline-calendar-today" class="text-[#D0D4F7] text-sm shrink-0" />
                  <span>{{ contract.Start_Date || contract.Event_Date }}</span>
                </p>
                <p class="flex items-center gap-2">
                  <Icon name="ic:baseline-location-on" class="text-[#D0D4F7] text-sm shrink-0" />
                  <span class="truncate">{{ contract.Venue_Location }}</span>
                </p>
                <p v-if="contract.Cancellation_Reason" class="text-xs text-red-300 font-medium">
                  Reason: {{ contract.Cancellation_Reason }}
                </p>
              </div>

              <!-- Late Cancellation Flag & Report -->
              <div
                v-if="contract.Is_Late_Cancellation"
                class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2"
              >
                <div class="flex items-center gap-1.5 text-xs text-amber-300">
                  <Icon name="ic:baseline-warning" class="text-base text-amber-400 shrink-0" />
                  <span>Last-Minute Cancellation (&le;5 days)</span>
                </div>
                <button
                  type="button"
                  @click.stop="openReportModal({ targetType: 'Contract', targetId: contract.Booking_ID, targetAccountId: contract.ARTIST?.USER_ACCOUNT?.ACCOUNT_ID || contract.ARTIST?.ARTIST_ID, targetName: getArtistName(contract), previewSnippet: `Late cancellation on ${contract.Start_Date || contract.Event_Date}. Reason: ${contract.Cancellation_Reason || 'None provided'}` })"
                  class="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/40 hover:bg-rose-500/25 text-rose-300 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Icon name="ic:round-flag" class="text-xs" />
                  <span>Report</span>
                </button>
              </div>

              <div class="flex items-center justify-between pt-3 border-t border-[#2A2A2E] text-xs text-gray-500">
                <span>Cancelled Performance Agreement</span>
                <span class="text-[#D0D4F7] group-hover:underline text-[11px]">View Details &rarr;</span>
              </div>
            </template>
          </div>
        </div>
      </div>

    </div>

    <!-- Contract Details Modal (Accessible for all statuses: Active, Pending, Completed, Cancelled) -->
    <ContractDetailsModal
      :is-open="isDetailsModalOpen"
      :contract="selectedContractForDetails"
      :can-complete="selectedContractForDetails ? canCompleteContract(selectedContractForDetails) : false"
      :is-completing="completingBookingId === selectedContractForDetails?.Booking_ID"
      :is-reviewed="selectedContractForDetails ? reviewedBookingIds.has(selectedContractForDetails.Booking_ID) : false"
      @close="isDetailsModalOpen = false"
      @complete="(c) => { isDetailsModalOpen = false; handleCompleteContract(c) }"
      @cancel="(c) => { isDetailsModalOpen = false; initiateCancelContract(c) }"
      @rate="(c) => { isDetailsModalOpen = false; openReviewForContract(c) }"
    />

    <!-- Review Modal for Rating Performers -->
    <ReviewModal
      :is-open="isReviewModalOpen"
      :booking="selectedReviewBooking"
      :reviewer-account-id="currentAccountId"
      :booking-id="selectedReviewBooking?.Booking_ID"
      :contract-code="selectedReviewBooking?.Contract_Code"
      :event-title="selectedReviewBooking?.JOB_LISTING?.Event_Title || 'Direct Booking Gig'"
      :event-date="selectedReviewBooking?.Start_Date || selectedReviewBooking?.Event_Date"
      :target-artist-id="selectedReviewBooking?.Provider_Artist_ID || selectedReviewBooking?.ARTIST?.ARTIST_ID"
      :target-business-id="selectedReviewBooking?.Provider_Business_ID"
      :target-account-id="selectedReviewBooking?.Requester_Account_ID"
      target-name="Performing Artist"
      @close="isReviewModalOpen = false"
      @submitted="handleReviewSubmitted"
    />

  </div>
</template>