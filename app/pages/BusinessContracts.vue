<script setup lang="ts">
definePageMeta({
  layout: 'business',
  middleware: ['auth', 'business']
})

import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'

const supabase = useSupabaseClient()
const db = supabase as any
const { fetchCurrentUserProfile } = useTonoAuth()

const activeTab = ref<'active' | 'pending' | 'history'>('active')
const isLoading = ref(true)

// Business Profile Context
const businessProfile = ref<any>(null)
const currentAccountId = ref('')
const businessName = ref('Business Account')
const businessId = ref('')

// Contracts from Supabase
const contracts = ref<any[]>([])

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
      activeTab.value = 'active'
    } else if (['Pending_Artist_Approval', 'Pending'].includes(target.Status)) {
      activeTab.value = 'pending'
    } else {
      activeTab.value = 'history'
    }
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
  targetContractForCancellation.value = contract
  isWarningModalOpen.value = true
}

const handleConfirmCancellation = async (reason: string, isLateParam?: boolean) => {
  if (!targetContractForCancellation.value) return
  const contract = targetContractForCancellation.value

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
// Filtered Views
// -----------------------------------------------------------------------------
const activeContracts = computed(() => {
  return contracts.value.filter(c => c.Status === 'Confirmed' || c.Status === 'Active')
})

const pendingContracts = computed(() => {
  return contracts.value.filter(c => c.Status === 'Pending_Artist_Approval' || c.Status === 'Pending')
})

const historyContracts = computed(() => {
  return contracts.value.filter(c => c.Status === 'Completed' || c.Status === 'Cancelled' || c.Status === 'Declined')
})

const getArtistName = (contract: any) => {
  const artist = contract.ARTIST
  if (!artist) return 'Performing Artist'
  return artist.StageName?.[0]?.Artist_Name || artist.BandName?.[0]?.Band_Name || artist.USER_ACCOUNT?.Username || 'Artist'
}

onMounted(async () => {
  await fetchContracts()
  setupRealtimeSync()
})

onBeforeUnmount(() => {
  if (businessContractChannel) {
    supabase.removeChannel(businessContractChannel)
    businessContractChannel = null
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

      <!-- Navigation Filter Tabs -->
      <div class="flex items-center gap-2 border-b border-[#2A2A2E] pb-3 text-xs overflow-x-auto">
        <button
          type="button"
          @click="activeTab = 'active'"
          class="px-4 py-2 rounded-full font-medium transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap"
          :class="activeTab === 'active' ? 'bg-[#D0D4F7] text-[#0E0E10] font-bold shadow' : 'bg-[#1C1C1F] text-gray-300 border border-[#3A3A3C] hover:bg-white/5'"
        >
          <span>Active Contracts</span>
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-mono" :class="activeTab === 'active' ? 'bg-[#0E0E10]/20 text-[#0E0E10]' : 'bg-white/10 text-gray-300'">
            {{ activeContracts.length }}
          </span>
        </button>

        <button
          type="button"
          @click="activeTab = 'pending'"
          class="px-4 py-2 rounded-full font-medium transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap"
          :class="activeTab === 'pending' ? 'bg-[#D0D4F7] text-[#0E0E10] font-bold shadow' : 'bg-[#1C1C1F] text-gray-300 border border-[#3A3A3C] hover:bg-white/5'"
        >
          <span>Pending Artist Approval</span>
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-mono" :class="activeTab === 'pending' ? 'bg-[#0E0E10]/20 text-[#0E0E10]' : 'bg-white/10 text-gray-300'">
            {{ pendingContracts.length }}
          </span>
        </button>

        <button
          type="button"
          @click="activeTab = 'history'"
          class="px-4 py-2 rounded-full font-medium transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap"
          :class="activeTab === 'history' ? 'bg-[#D0D4F7] text-[#0E0E10] font-bold shadow' : 'bg-[#1C1C1F] text-gray-300 border border-[#3A3A3C] hover:bg-white/5'"
        >
          <span>History &amp; Cancelled</span>
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-mono" :class="activeTab === 'history' ? 'bg-[#0E0E10]/20 text-[#0E0E10]' : 'bg-white/10 text-gray-300'">
            {{ historyContracts.length }}
          </span>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
        <div v-for="i in 4" :key="i" class="h-44 bg-[#1C1C1F] rounded-2xl border border-[#2A2A2E]"></div>
      </div>

      <!-- TAB 1: ACTIVE CONTRACTS -->
      <div v-else-if="activeTab === 'active'">
        <div v-if="activeContracts.length === 0" class="text-center py-16 bg-[#131315]/50 border border-dashed border-[#2A2A2E] rounded-2xl space-y-3">
          <Icon name="ic:outline-assignment" class="text-4xl text-gray-500 mx-auto" />
          <h3 class="text-base font-semibold text-white">No Active Contracts</h3>
          <p class="text-xs text-gray-400 max-w-sm mx-auto">
            When you accept applicants from your job listings or book performers directly, active agreements will appear here.
          </p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div
            v-for="contract in activeContracts"
            :key="contract.Booking_ID"
            class="bg-[#1C1C1F]/80 border border-[#2A2A2E] hover:border-[#46464D] rounded-2xl p-5 sm:p-6 space-y-4 transition-all shadow-lg group"
          >
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
            <div class="flex items-center justify-between pt-3 border-t border-[#2A2A2E] text-xs">
              <span class="text-[10px] font-mono text-gray-400">
                Type: {{ contract.Booking_Type || 'Direct' }}
              </span>

              <button
                type="button"
                @click="initiateCancelContract(contract)"
                class="px-3.5 py-1.5 rounded-full border border-red-500/30 text-red-300 hover:bg-red-500/10 hover:border-red-500/60 transition-all cursor-pointer"
              >
                Cancel Contract
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: PENDING ARTIST APPROVAL -->
      <div v-else-if="activeTab === 'pending'">
        <div v-if="pendingContracts.length === 0" class="text-center py-16 bg-[#131315]/50 border border-dashed border-[#2A2A2E] rounded-2xl space-y-3">
          <Icon name="ic:outline-pending-actions" class="text-4xl text-gray-500 mx-auto" />
          <h3 class="text-base font-semibold text-white">No Pending Contract Offers</h3>
          <p class="text-xs text-gray-400 max-w-sm mx-auto">
            When you accept an applicant, an official contract offer is sent to the artist for setlist additions and agreement confirmation.
          </p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div
            v-for="contract in pendingContracts"
            :key="contract.Booking_ID"
            class="bg-[#1C1C1F]/80 border border-[#2A2A2E] rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg hover:border-[#46464D] transition-all"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <span class="text-[10px] font-mono text-amber-400 uppercase tracking-wider">{{ contract.Contract_Code }}</span>
                <h3 class="text-base font-bold text-white mt-0.5">{{ getArtistName(contract) }}</h3>
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
                type="button"
                @click="initiateCancelContract(contract)"
                class="px-3.5 py-1.5 rounded-full border border-red-500/30 text-red-300 hover:bg-red-500/10 hover:border-red-500/60 transition-all cursor-pointer"
              >
                Withdraw Offer
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: HISTORY & CANCELLED -->
      <div v-else-if="activeTab === 'history'">
        <div v-if="historyContracts.length === 0" class="text-center py-16 bg-[#131315]/50 border border-dashed border-[#2A2A2E] rounded-2xl space-y-3">
          <Icon name="ic:outline-history" class="text-4xl text-gray-500 mx-auto" />
          <h3 class="text-base font-semibold text-white">No Past or Cancelled Contracts</h3>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div
            v-for="contract in historyContracts"
            :key="contract.Booking_ID"
            class="bg-[#1C1C1F]/40 border border-[#2A2A2E]/50 rounded-2xl p-5 sm:p-6 space-y-3 opacity-80"
          >
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-mono text-gray-400 uppercase">{{ contract.Contract_Code }}</span>
              <span
                class="px-2.5 py-0.5 rounded-full text-[10px] font-mono"
                :class="contract.Status === 'Completed' ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'"
              >
                {{ contract.Status }}
              </span>
            </div>
            <h3 class="text-base font-bold text-white">{{ getArtistName(contract) }}</h3>
            <p class="text-xs text-gray-400">📅 {{ contract.Start_Date || contract.Event_Date }} • 📍 {{ contract.Venue_Location }}</p>
            <p v-if="contract.Cancellation_Reason" class="text-xs text-red-300">
              Reason: {{ contract.Cancellation_Reason }}
            </p>
          </div>
        </div>
      </div>

    </div>

  </div>
</template>