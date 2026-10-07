<script setup lang="ts">
definePageMeta({
  layout: 'artist',
  middleware: 'auth'
})

import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'

const supabase = useSupabaseClient()
const db = supabase as any
const { fetchCurrentUserProfile } = useTonoAuth()

const artistId = ref('')
const artistName = ref('')
const eventsLoading = ref(true)

const yourEvents = ref<any[]>([])
const pendingOffers = ref<any[]>([])
const allArtistContracts = ref<any[]>([])

const openJobs = ref<any[]>([])
const appliedJobIds = ref<Set<string>>(new Set())
const myApplications = ref<any[]>([])

// Modals
const isForm2ModalOpen = ref(false)
const selectedContractForForm2 = ref<any>(null)

const isJobDetailsModalOpen = ref(false)
const selectedJobForDetails = ref<any>(null)

onMounted(async () => {
  try {
    const profile = await fetchCurrentUserProfile()
    if (profile?.artistProfile) {
      artistId.value = profile.artistProfile.ARTIST_ID
      artistName.value = profile.artistProfile.StageName || profile.account?.Username || 'Artist'
      await fetchArtistEvents()
    }
  } catch (error) {
    console.error('Error loading artist events page:', error)
  } finally {
    eventsLoading.value = false
  }
})

const fetchArtistEvents = async () => {
  if (!artistId.value) return
  eventsLoading.value = true
  try {
    // 1. Fetch Confirmed Events (Section 1)
    const { data: confirmedData, error: confirmedErr } = await db
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
        Status,
        Is_Rush_Booking,
        BUSINESS_PROFILE:Provider_Business_ID (
          Business_Name
        ),
        USER_ACCOUNT:Requester_Account_ID (
          Username
        ),
        JOB_LISTING (
          Job_ID,
          Job_Code,
          Event_Title,
          Location,
          Compensation_Fee,
          Description
        )
      `)
      .eq('Provider_Artist_ID', artistId.value)
      .in('Status', ['Confirmed', 'Active'])
      .order('Start_Date', { ascending: true })

    if (!confirmedErr && confirmedData) {
      yourEvents.value = confirmedData
    }

    // 2. Fetch Pending Contract Offers (Form 2 Trigger)
    const { data: offersData } = await db
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
        Requester_Account_ID,
        BUSINESS_PROFILE:Provider_Business_ID (
          Business_Name
        ),
        JOB_LISTING (
          Job_ID,
          Job_Code,
          Event_Title,
          Location
        )
      `)
      .eq('Provider_Artist_ID', artistId.value)
      .in('Status', ['Pending_Artist_Approval', 'Pending', 'Draft'])

    if (offersData) {
      pendingOffers.value = offersData
    }

    // 3. Fetch Open Jobs for Casting Call (Section 2)
    const { data: jobsData } = await db
      .from('JOB_LISTING')
      .select(`
        Job_ID,
        Job_Code,
        Event_Title,
        Location,
        Start_Date,
        End_Date,
        Date,
        Start_Time,
        End_Time,
        Time,
        Compensation_Fee,
        Description,
        Requested_Song_Lineup,
        Status,
        Is_Rush_Booking,
        Posted_By_BUSINESS_ID,
        BUSINESS_PROFILE:Posted_By_BUSINESS_ID (
          Business_Name,
          ACCOUNT_ID
        ),
        BOOKING_CONTRACT (
          Booking_ID,
          Status
        )
      `)
      .eq('Status', 'Open')
      .order('Start_Date', { ascending: true })

    if (jobsData) {
      // Condition: if there is an active contract tied with that job listing, it is closed
      openJobs.value = jobsData.filter((j: any) => {
        const hasActiveContract = j.BOOKING_CONTRACT?.some((c: any) =>
          !['Cancelled', 'Declined'].includes(c.Status)
        )
        return !hasActiveContract
      })
    }

    // 4. Fetch Applications made by this artist
    const { data: appData } = await db
      .from('APPLICATION')
      .select(`
        Application_ID,
        Job_ID,
        Artist_ID,
        Status,
        Pitch_Message,
        Proposed_Fee,
        Notes,
        Applied_at,
        JOB_LISTING (
          Job_ID,
          Job_Code,
          Event_Title,
          Location,
          Start_Date,
          End_Date,
          Start_Time,
          End_Time,
          Compensation_Fee,
          Description,
          Requested_Song_Lineup,
          Status,
          Posted_By_BUSINESS_ID,
          BUSINESS_PROFILE:Posted_By_BUSINESS_ID (
            Business_Name,
            ACCOUNT_ID
          )
        )
      `)
      .eq('Artist_ID', artistId.value)
      .order('Applied_at', { ascending: false })

    if (appData) {
      appliedJobIds.value = new Set(appData.map((a: any) => a.Job_ID))
      myApplications.value = appData
    }

    // 5. Fetch All Contracts for this artist
    const { data: allContractsData } = await db
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
        Requester_Account_ID,
        USER_ACCOUNT:Requester_Account_ID (
          Username,
          Profile_Picture
        ),
        BUSINESS_PROFILE:Provider_Business_ID (
          Business_Name
        ),
        JOB_LISTING (
          Job_ID,
          Job_Code,
          Event_Title,
          Location
        )
      `)
      .eq('Provider_Artist_ID', artistId.value)
      .order('Created_at', { ascending: false })

    if (allContractsData) {
      allArtistContracts.value = allContractsData
    }
  } catch (e) {
    console.error('Failed to load artist events:', e)
  } finally {
    eventsLoading.value = false
  }
}

// Compute live events happening today
const liveEvents = computed(() => {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return yourEvents.value.filter(e => {
    const start = e.Start_Date || e.Event_Date
    const end = e.End_Date || start
    if (!start) return false
    return todayStr >= start && todayStr <= end
  })
})

const openForm2Modal = (contract: any) => {
  selectedContractForForm2.value = contract
  isForm2ModalOpen.value = true
}

const openJobDetails = (job: any) => {
  selectedJobForDetails.value = job
  isJobDetailsModalOpen.value = true
}

// Deep Linking: Auto-open modal if navigated from notification
const route = useRoute()
const checkQueryTriggers = () => {
  const contractId = route.query.contractId as string
  if (contractId) {
    const found = pendingOffers.value.find(c => c.Booking_ID === contractId) ||
                  allArtistContracts.value.find(c => c.Booking_ID === contractId)
    if (found) {
      openForm2Modal(found)
    }
  }

  const jobId = route.query.jobId as string
  if (jobId) {
    const foundJob = openJobs.value.find(j => j.Job_ID === jobId)
    if (foundJob) {
      openJobDetails(foundJob)
    }
  }
}

watch(() => route.query.contractId, (newId) => {
  if (newId) checkQueryTriggers()
})

watch(() => route.query.jobId, (newId) => {
  if (newId) checkQueryTriggers()
})

// Realtime Zero-Refresh: Sync booking contract status changes live
let contractSyncChannel: any = null
const setupRealtimeContractSync = () => {
  if (!artistId.value || contractSyncChannel) return

  contractSyncChannel = supabase
    .channel(`artist-events-sync:${artistId.value}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'BOOKING_CONTRACT',
        filter: `Provider_Artist_ID=eq.${artistId.value}`
      },
      async () => {
        // Refresh events in background without full reload
        await fetchArtistEvents()
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'BOOKING_CONTRACT',
        filter: `Provider_Artist_ID=eq.${artistId.value}`
      },
      async () => {
        await fetchArtistEvents()
      }
    )
    .subscribe()
}

onMounted(() => {
  setTimeout(() => {
    checkQueryTriggers()
    setupRealtimeContractSync()
  }, 400)
})

onBeforeUnmount(() => {
  if (contractSyncChannel) {
    supabase.removeChannel(contractSyncChannel)
    contractSyncChannel = null
  }
})
</script>

<template>
  <head>
    <title>Events | TONO</title>
  </head>
  <div class="h-full bg-[#0E0E10] text-white flex flex-col min-h-screen pb-16">
    <main class="max-w-7xl mx-auto w-full px-6 sm:px-10 py-10 flex flex-col gap-10">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#2A2A2E]">
        <div>
          <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-[#E5E1E4] font-Sora">
            Events Hub &amp; Gigs
          </h1>
          <p class="text-sm text-gray-400 mt-2">
            Browse casting calls, audition for open gigs, and track your confirmed performances.
          </p>
        </div>
      </div>

      <!-- PENDING OFFERS ALERT BANNER (Triggers Form 2 Artist Approval) -->
      <div
        v-if="pendingOffers.length > 0"
        class="p-5 rounded-2xl bg-amber-950/25 border border-amber-500/40 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in font-Sora"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Icon name="ic:baseline-assignment-late" class="text-2xl text-amber-400 animate-pulse" />
          </div>
          <div>
            <h4 class="text-sm font-bold text-white">
              You have {{ pendingOffers.length }} Booking Contract {{ pendingOffers.length === 1 ? 'Offer' : 'Offers' }} Pending!
            </h4>
            <p class="text-xs text-amber-300/80">
              Review terms, customize your song lineup, and confirm your performance agreement.
            </p>
          </div>
        </div>

        <button
          type="button"
          @click="openForm2Modal(pendingOffers[0])"
          class="px-5 py-2.5 rounded-full text-xs font-bold bg-amber-400 hover:bg-amber-300 text-black transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto shadow-md"
        >
          Review Booking Contract
        </button>
      </div>

      <!-- ================================================================= -->
      <!-- SECTION 1: "YOUR EVENTS" (Deduplicated Job Listings vs Contracts) -->
      <!-- ================================================================= -->
      <section class="space-y-4 font-Sora">
        <div class="flex flex-col sm:flex-row sm:items-center items-end sm:gap-0 gap-1 justify-between border-b border-[#2A2A2E] pb-3">
          <div>
            <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Your Events</h2>
            <p class="text-xs text-gray-400 mt-0.5">
              Confirmed gigs from accepted job listings and direct client bookings.
            </p>
          </div>
          <span class="text-xs font-mono text-[#D0D4F7] px-2.5 py-1 rounded-full bg-[#1C1C1F] border border-[#2A2A2E]">
            {{ yourEvents.length }} {{ yourEvents.length === 1 ? 'event' : 'events' }}
          </span>
        </div>

        <div v-if="eventsLoading" class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          <div v-for="i in 2" :key="i" class="h-36 bg-[#1C1C1F] rounded-2xl border border-[#2A2A2E]"></div>
        </div>

        <div v-else-if="yourEvents.length === 0" class="text-center py-12 bg-[#131315]/50 border border-dashed border-[#2A2A2E] rounded-2xl space-y-2">
          <Icon name="ic:outline-event-busy" class="text-3xl text-gray-500 mx-auto" />
          <p class="text-sm font-semibold text-white">No Confirmed Events Yet</p>
          <p class="text-xs text-gray-400">Apply to open gigs below or accept client booking requests to fill your calendar.</p>
        </div>

        <!-- Deduplicated Event Cards Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div
            v-for="event in yourEvents"
            :key="event.Booking_ID"
            class="bg-[#1C1C1F]/80 border border-[#2A2A2E] hover:border-[#46464D] rounded-2xl p-5 sm:p-6 space-y-3 transition-all shadow-lg"
          >
            <!-- DEDUPLICATION LOGIC: If event has Job_ID, show Job Listing Card. Else show Contract Card -->
            <div class="flex items-start justify-between gap-3">
              <div>
                <span class="text-[10px] font-mono uppercase tracking-wider text-[#D0D4F7]">
                  {{ event.Job_ID ? 'JOB LISTING GIG' : 'DIRECT BOOKING CONTRACT' }}
                </span>
                <h3 class="text-base sm:text-lg font-bold text-white mt-0.5">
                  {{ event.Job_ID ? event.JOB_LISTING?.Event_Title : 'Direct Booking Performance' }}
                </h3>
              </div>

              <div class="flex items-center gap-1.5">
                <span v-if="event.Is_Rush_Booking" class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                  <Icon name="ic:baseline-bolt" class="text-xs" />
                  <span>Rush</span>
                </span>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Confirmed
                </span>
              </div>
            </div>

            <!-- Necessary Details Only -->
            <div class="space-y-1.5 text-xs text-gray-300">
              <div class="flex items-center gap-2">
                <Icon name="ic:baseline-calendar-today" class="text-[#D0D4F7] text-sm shrink-0" />
                <span>
                  {{ event.Start_Date || event.Event_Date }}
                  <span v-if="event.End_Date && event.End_Date !== event.Start_Date"> to {{ event.End_Date }}</span>
                  <span v-if="event.Start_Time"> • {{ formatTimeRange12(event.Start_Time, event.End_Time) }}</span>
                </span>
              </div>

              <div class="flex items-center gap-2">
                <Icon name="ic:baseline-location-on" class="text-[#D0D4F7] text-sm shrink-0" />
                <span class="truncate">{{ event.Job_ID ? (event.JOB_LISTING?.Location || event.Venue_Location) : event.Venue_Location }}</span>
              </div>

              <div v-if="!event.Job_ID && event.USER_ACCOUNT?.Username" class="flex items-center gap-2 text-gray-400">
                <Icon name="ic:baseline-person" class="text-[#D0D4F7] text-sm shrink-0" />
                <span>Booked by: {{ event.USER_ACCOUNT.Username }}</span>
              </div>
              <div v-else-if="event.BUSINESS_PROFILE?.Business_Name" class="flex items-center gap-2 text-gray-400">
                <Icon name="ic:baseline-storefront" class="text-[#D0D4F7] text-sm shrink-0" />
                <span>Host: {{ event.BUSINESS_PROFILE.Business_Name }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ================================================================= -->
      <!-- SECTION 3: "OPEN JOBS / GIGS" (Casting Call with Details Modal) -->
      <!-- ================================================================= -->
      <section class="space-y-4 font-Sora">
        <div class="flex flex-col sm:flex-row sm:items-center items-end sm:gap-0 gap-1 justify-between border-b border-[#2A2A2E] pb-3">
          <div>
            <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Open Jobs / Gigs</h2>
            <p class="text-xs text-gray-400 mt-0.5">
              Browse casting calls and open performance auditions from verified TONO partner venues.
            </p>
          </div>
          <span class="text-xs font-mono text-gray-400">
            {{ openJobs.length }} open
          </span>
        </div>

        <div v-if="openJobs.length === 0" class="text-center py-12 bg-[#131315]/50 border border-dashed border-[#2A2A2E] rounded-2xl space-y-2">
          <Icon name="ic:outline-work-outline" class="text-3xl text-gray-500 mx-auto" />
          <p class="text-sm font-semibold text-white">No Open Gigs Available Right Now</p>
          <p class="text-xs text-gray-400">Check back soon as venue managers post new weekend casting calls.</p>
        </div>

        <!-- Open Jobs Cards Grid (Minimal Details + "Details" Button) -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div
            v-for="job in openJobs"
            :key="job.Job_ID"
            class="bg-[#1C1C1F]/80 border border-[#2A2A2E] hover:border-[#46464D] rounded-2xl p-5 space-y-3.5 transition-all shadow-lg flex flex-col justify-between"
          >
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  Open Listing
                </span>
                <span v-if="appliedJobIds.has(job.Job_ID)" class="text-[10px] font-mono text-[#D0D4F7] bg-[#D0D4F7]/10 px-2 py-0.5 rounded border border-[#D0D4F7]/20">
                  Applied ✓
                </span>
              </div>

              <h3 class="text-base font-bold text-white line-clamp-1">
                {{ job.Event_Title }}
              </h3>

              <div class="space-y-1 text-xs text-gray-400">
                <p class="flex items-center gap-1.5 truncate">
                  <Icon name="ic:baseline-storefront" class="text-[#D0D4F7] text-sm shrink-0" />
                  <span>{{ job.BUSINESS_PROFILE?.Business_Name || 'Venue Host' }}</span>
                </p>
                <p class="flex items-center gap-1.5 truncate">
                  <Icon name="ic:baseline-location-on" class="text-[#D0D4F7] text-sm shrink-0" />
                  <span>{{ job.Location }}</span>
                </p>
                <p class="flex items-center gap-1.5">
                  <Icon name="ic:baseline-calendar-today" class="text-[#D0D4F7] text-sm shrink-0" />
                  <span>{{ job.Start_Date || job.Date }} <span v-if="job.Start_Time || job.Time">• {{ formatTimeRange12(job.Start_Time || job.Time, job.End_Time) }}</span></span>
                </p>
                <p v-if="job.Compensation_Fee" class="flex items-center gap-1.5 font-mono text-emerald-400 font-semibold pt-1">
                  <span>Pay: ₱{{ Number(job.Compensation_Fee).toLocaleString() }}</span>
                </p>
              </div>
            </div>

            <!-- Single Action Button: "Details" (Opens Job Details Application Form Modal) -->
            <button
              type="button"
              @click="openJobDetails(job)"
              class="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border"
              :class="appliedJobIds.has(job.Job_ID)
                ? 'bg-[#1E1E24] border-[#46464D]/60 text-gray-300 hover:border-[#D0D4F7] hover:text-white'
                : 'bg-[#D0D4F7] hover:bg-white text-[#131315] border-transparent shadow-sm'"
            >
              <Icon name="ic:outline-visibility" class="text-base" />
              <span>{{ appliedJobIds.has(job.Job_ID) ? 'View & Edit Application' : 'Details & Apply' }}</span>
            </button>
          </div>
        </div>
      </section>

      <!-- ================================================================= -->
      <!-- SECTION 3: "LIVE EVENTS / GIGS" (Happening Today) -->
      <!-- ================================================================= -->
      <section class="space-y-4 font-Sora">
        <div class="flex flex-col sm:flex-row sm:items-center items-start sm:gap-0 gap-1 justify-between border-b border-[#2A2A2E] pb-3">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
            <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Live Events / Gigs</h2>
          </div>
          <span class="text-xs font-mono text-rose-400 font-semibold uppercase">Happening Today</span>
        </div>

        <div v-if="liveEvents.length === 0" class="text-center py-8 bg-[#131315]/30 border border-dashed border-[#2A2A2E] rounded-2xl">
          <p class="text-xs text-gray-400">No performances scheduled for today.</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="live in liveEvents"
            :key="live.Booking_ID"
            class="p-5 rounded-2xl bg-linear-to-r from-[#1C1C1F] to-[#251F2D] border border-rose-500/30 space-y-2"
          >
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                LIVE NOW
              </span>
              <span class="text-xs text-gray-300 font-mono">{{ formatTimeRange12(live.Start_Time, live.End_Time) }}</span>
            </div>
            <h3 class="text-lg font-bold text-white">
              {{ live.Job_ID ? live.JOB_LISTING?.Event_Title : 'Live Direct Performance' }}
            </h3>
            <p class="text-xs text-gray-300">
              📍 {{ live.Job_ID ? live.JOB_LISTING?.Location : live.Venue_Location }}
            </p>
          </div>
        </div>
      </section>
    </main>

    <!-- Artist Form 2 Contract Modal -->
    <ArtistContractModal
      :is-open="isForm2ModalOpen"
      :contract="selectedContractForForm2"
      @close="isForm2ModalOpen = false"
      @accepted="fetchArtistEvents"
      @rejected="fetchArtistEvents"
    />

    <!-- Job Details / Application Form Modal -->
    <JobDetailsModal
      :is-open="isJobDetailsModalOpen"
      :job="selectedJobForDetails"
      :current-artist-id="artistId"
      :has-already-applied="appliedJobIds.has(selectedJobForDetails?.Job_ID)"
      @close="isJobDetailsModalOpen = false"
      @applied="fetchArtistEvents"
    />
  </div>
</template>