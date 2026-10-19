<script setup lang="ts">
definePageMeta({
  layout: 'artist',
  middleware: 'auth'
})

import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useTonoEvents } from '~/composables/useTonoEvents'

const supabase = useSupabaseClient()
const db = supabase as any
const { fetchCurrentUserProfile } = useTonoAuth()
const { isEventHappeningNow, isEventFinished } = useTonoEvents()

const currentAccountId = ref('')
const artistId = ref('')
const artistName = ref('')
const eventsLoading = ref(true)

const yourEvents = ref<any[]>([])
const pendingOffers = ref<any[]>([])
const allArtistContracts = ref<any[]>([])
const allPublicJobEvents = ref<any[]>([])

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
    if (profile?.account) {
      currentAccountId.value = profile.account.ACCOUNT_ID
    }
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

async function fetchArtistEvents() {
  if (!artistId.value) return
  eventsLoading.value = true
  try {
    // 1. Fetch Confirmed & Completed Events (Section 1)
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
        Provider_Business_ID,
        Requester_Account_ID,
        BUSINESS_PROFILE:Provider_Business_ID (
          BUSINESS_ID,
          Business_Name
        ),
        USER_ACCOUNT:Requester_Account_ID (
          ACCOUNT_ID,
          Username
        ),
        JOB_LISTING (
          Job_ID,
          Job_Code,
          Event_Title,
          Location,
          Compensation_Fee,
          Description,
          Is_Public,
          Posted_By_BUSINESS_ID,
          BUSINESS_PROFILE:Posted_By_BUSINESS_ID (
            BUSINESS_ID,
            Business_Name
          )
        )
      `)
      .eq('Provider_Artist_ID', artistId.value)
      .in('Status', ['Confirmed', 'Active', 'Completed'])
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

    // 6. Fetch All Public Job Listing Events (Live & Upcoming across TONO)
    try {
      // A. Query from JOB_LISTING (Open, Closed, Active public job listings)
      const { data: publicJobsData, error: publicJobsErr } = await db
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
          Status,
          Is_Public,
          Compensation_Fee,
          Description,
          Posted_By_BUSINESS_ID,
          BUSINESS_PROFILE:Posted_By_BUSINESS_ID (
            BUSINESS_ID,
            Business_Name,
            Business_Address
          ),
          BOOKING_CONTRACT (
            Booking_ID,
            Status,
            Provider_Artist_ID
          )
        `)
        .neq('Status', 'Cancelled')
        .neq('Status', 'Draft')

      if (publicJobsErr) {
        console.error('[ArtistNavEvents] Error fetching public job listings:', publicJobsErr)
      }

      // B. Query confirmed/active public contracts tied to job listings
      const { data: publicContractsData, error: publicContractsErr } = await db
        .from('BOOKING_CONTRACT')
        .select(`
          Booking_ID,
          Contract_Code,
          Job_ID,
          Start_Date,
          End_Date,
          Event_Date,
          Start_Time,
          End_Time,
          Venue_Location,
          Status,
          Provider_Artist_ID,
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
            Location,
            Is_Public
          ),
          BUSINESS_PROFILE:Provider_Business_ID (
            Business_Name,
            Business_Address
          )
        `)
        .in('Status', ['Confirmed', 'Active'])
        .not('Job_ID', 'is', null)

      if (publicContractsErr) {
        console.error('[ArtistNavEvents] Error fetching public contracts:', publicContractsErr)
      }

      // C. Resolve artist names for job listings that have assigned Provider_Artist_ID
      const artistIds = [...new Set(
        (publicJobsData || [])
          .flatMap((j: any) => j.BOOKING_CONTRACT || [])
          .map((c: any) => c.Provider_Artist_ID)
          .filter(Boolean)
      )]

      let artistLookup: Record<string, string> = {}
      if (artistIds.length > 0) {
        try {
          const { data: artistsData } = await db
            .from('ARTIST')
            .select(`
              ARTIST_ID,
              StageName:SOLO_ARTIST(Artist_Name),
              BandName:BAND(Band_Name),
              USER_ACCOUNT(Username)
            `)
            .in('ARTIST_ID', artistIds)

          if (artistsData) {
            for (const a of artistsData) {
              artistLookup[a.ARTIST_ID] = a.BandName?.Band_Name || a.StageName?.Artist_Name || a.USER_ACCOUNT?.Username || ''
            }
          }
        } catch (errArt) {
          console.warn('[ArtistNavEvents] Could not resolve artist names:', errArt)
        }
      }

      // D. Combine both sources deduplicated by Job_ID
      const combinedEvents: any[] = []
      const processedJobIds = new Set<string>()

      // First add confirmed contracts tied to job listings (richer performer data)
      if (publicContractsData) {
        for (const contract of publicContractsData) {
          if (contract.JOB_LISTING && contract.JOB_LISTING.Is_Public === false) continue
          if (contract.Job_ID) processedJobIds.add(contract.Job_ID)
          combinedEvents.push(contract)
        }
      }

      // Then add any open or published job listings not already covered
      if (publicJobsData) {
        for (const job of publicJobsData) {
          if (job.Is_Public === false) continue
          if (processedJobIds.has(job.Job_ID)) continue
          processedJobIds.add(job.Job_ID)

          const activeContract = Array.isArray(job.BOOKING_CONTRACT)
            ? job.BOOKING_CONTRACT.find((c: any) => ['Confirmed', 'Active', 'Completed'].includes(c.Status) && c.Provider_Artist_ID)
            : null
          const resolvedArtist = activeContract ? (artistLookup[activeContract.Provider_Artist_ID] || '') : ''

          combinedEvents.push({
            ...job,
            _resolvedArtistName: resolvedArtist
          })
        }
      }

      allPublicJobEvents.value = combinedEvents
    } catch (errPublic) {
      console.error('[ArtistNavEvents] Error combining public events:', errPublic)
    }
  } catch (e) {
    console.error('Failed to load artist events:', e)
  } finally {
    eventsLoading.value = false
  }
}

// Robust date string normalizer (handles ISO dates, YYYY-MM-DD, slashes)
const normalizeDateStr = (dateVal?: any): string => {
  if (!dateVal) return ''
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return ''
    const y = dateVal.getFullYear()
    const m = String(dateVal.getMonth() + 1).padStart(2, '0')
    const day = String(dateVal.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const s = String(dateVal).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.substring(0, 10)
  }
  try {
    const d = new Date(s)
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
  } catch {}
  return s
}

// Time formatting helper for tour dates (e.g. "18:00:00" -> "6:00 PM")
const formatGigTime = (timeStr?: string | null) => {
  if (!timeStr) return 'TBA'
  try {
    const clean = timeStr.trim()
    if (!clean) return 'TBA'
    if (clean.includes('AM') || clean.includes('PM')) return clean
    const [hh, mm] = clean.split(':')
    if (!hh) return timeStr
    const h = parseInt(hh, 10)
    if (isNaN(h)) return timeStr
    const ampm = h >= 12 ? 'PM' : 'AM'
    const displayH = h % 12 || 12
    return `${displayH}:${mm || '00'} ${ampm}`
  } catch {
    return timeStr || 'TBA'
  }
}

// Format a job listing or contract record into the Tour Date display structure
const formatJobListingEvent = (item: any) => {
  const rawDate = item.Start_Date || item.Event_Date || item.Date || item.JOB_LISTING?.Start_Date || item.JOB_LISTING?.Event_Date || item.JOB_LISTING?.Date || ''
  let day = '--'
  let month = 'TBD'

  const normalized = normalizeDateStr(rawDate)
  if (normalized) {
    const parts = normalized.split('-')
    const y = Number(parts[0])
    const m = Number(parts[1])
    const d = Number(parts[2])
    if (y && m && d) {
      const dateObj = new Date(y, m - 1, d)
      day = String(dateObj.getDate())
      month = dateObj.toLocaleString('en-US', { month: 'short' })
    }
  }

  const venueOrCity =
    item.Location ||
    item.Venue_Location ||
    item.JOB_LISTING?.Location ||
    item.BUSINESS_PROFILE?.Business_Address ||
    item.BUSINESS_PROFILE?.Business_Name ||
    'Venue TBA'

  const artistName = item.ARTIST
    ? (item.ARTIST.BandName?.Band_Name || item.ARTIST.StageName?.Artist_Name || item.ARTIST.USER_ACCOUNT?.Username || '')
    : (item._resolvedArtistName || '')

  const title = item.Event_Title || item.JOB_LISTING?.Event_Title || 'Live Music Gig'
  let eventTitle = title
  if (artistName) {
    if (!title.toLowerCase().includes(artistName.toLowerCase())) {
      eventTitle = `${title} • ${artistName}`
    } else {
      eventTitle = title
    }
  }

  const time = formatGigTime(item.Start_Time || item.Time || item.JOB_LISTING?.Start_Time || item.JOB_LISTING?.Time)

  return {
    id: item.Booking_ID || item.Job_ID || Math.random().toString(),
    month,
    day,
    venueOrCity,
    eventTitle,
    time: time || 'TBA',
    rawJob: item.JOB_LISTING ? { ...item.JOB_LISTING, ...item } : (item.Job_ID ? item : null),
    rawContract: item.Booking_ID ? item : null
  }
}

// Compute live events happening today
const liveEvents = computed(() => {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Aggregate candidate events from both allPublicJobEvents AND yourEvents
  const candidates: any[] = []
  const seenIds = new Set<string>()

  for (const ev of (allPublicJobEvents.value || [])) {
    const id = ev.Booking_ID || ev.Job_ID
    if (id && !seenIds.has(id)) {
      seenIds.add(id)
      candidates.push(ev)
    }
  }

  for (const ev of (yourEvents.value || [])) {
    const id = ev.Booking_ID || ev.Job_ID
    if (id && !seenIds.has(id)) {
      seenIds.add(id)
      candidates.push(ev)
    }
  }

  return candidates
    .filter((ev: any) => {
      if (['Cancelled', 'Declined', 'Draft', 'Completed'].includes(ev.Status)) return false
      // If it's private and not the artist's own confirmed contract, skip
      if (ev.Is_Public === false && !yourEvents.value?.some((y: any) => y.Booking_ID === ev.Booking_ID)) {
        return false
      }
      const start = normalizeDateStr(ev.Start_Date || ev.Event_Date || ev.Date || ev.JOB_LISTING?.Start_Date || ev.JOB_LISTING?.Date)
      const end = normalizeDateStr(ev.End_Date || ev.JOB_LISTING?.End_Date) || start
      if (!start) return false
      return todayStr >= start && todayStr <= end
    })
    .sort((a: any, b: any) => {
      const ta = a.Start_Time || a.Time || a.JOB_LISTING?.Start_Time || ''
      const tb = b.Start_Time || b.Time || b.JOB_LISTING?.Start_Time || ''
      return ta.localeCompare(tb)
    })
    .map(formatJobListingEvent)
})

// Compute upcoming public events (future events from tomorrow onwards)
const upcomingPublicEvents = computed(() => {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return allPublicJobEvents.value
    .filter((ev: any) => {
      if (['Cancelled', 'Declined', 'Draft', 'Completed'].includes(ev.Status)) return false
      const start = normalizeDateStr(ev.Start_Date || ev.Event_Date || ev.Date || ev.JOB_LISTING?.Start_Date || ev.JOB_LISTING?.Date)
      if (!start) return false
      return start > todayStr
    })
    .sort((a: any, b: any) => {
      const da = normalizeDateStr(a.Start_Date || a.Event_Date || a.Date || a.JOB_LISTING?.Start_Date || a.JOB_LISTING?.Date)
      const db = normalizeDateStr(b.Start_Date || b.Event_Date || b.Date || b.JOB_LISTING?.Start_Date || b.JOB_LISTING?.Date)
      return da.localeCompare(db)
    })
    .map(formatJobListingEvent)
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
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- SECTION 1: "LIVE EVENTS" (Happening Today)                        -->
      <!-- ================================================================= -->
      <section class="space-y-4 font-Sora">
        <div class="flex items-center gap-2.5 pb-1">
          <span class="relative flex h-3 w-3 shrink-0">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
          </span>
          <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Live events</h2>
        </div>

        <div v-if="liveEvents.length === 0" class="text-center py-8 bg-[#131315]/40 border border-dashed border-[#2A2A2E] rounded-2xl">
          <p class="text-sm text-gray-400 font-Sora">No events happening now</p>
        </div>

        <div v-else class="divide-y divide-[#2A2A2E]/70 rounded-2xl bg-[#131315]/60 border border-[#2A2A2E]/60 overflow-hidden">
          <div
            v-for="ev in liveEvents"
            :key="ev.id"
            @click="ev.rawJob ? openJobDetails(ev.rawJob) : (ev.rawContract && openForm2Modal(ev.rawContract))"
            class="flex items-center justify-between py-4 sm:py-5 px-4 sm:px-6 hover:bg-white/3 transition-colors gap-4 sm:gap-6 cursor-pointer"
          >
            <!-- Left Column: Date (Month / Day) -->
            <div class="w-12 sm:w-16 shrink-0 flex flex-col leading-tight">
              <span class="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider font-Sora">
                {{ ev.month }}
              </span>
              <span class="text-xl sm:text-2xl font-bold text-white font-Sora mt-0.5">
                {{ ev.day }}
              </span>
            </div>

            <!-- Middle Column: City/Venue (Bold) & Event/Lineup (Lighter) -->
            <div class="flex-1 min-w-0">
              <h4 class="text-base sm:text-lg font-bold text-white truncate font-Sora">
                {{ ev.venueOrCity }}
              </h4>
              <p class="text-xs sm:text-sm text-gray-400 truncate mt-0.5 font-normal">
                {{ ev.eventTitle }}
              </p>
            </div>

            <!-- Right Column: Happening Now Badge & Time -->
            <div class="shrink-0 flex flex-col sm:flex-row items-end sm:items-center gap-1.5 sm:gap-3 text-right">
              <span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 shadow-xs shrink-0">
                <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                <span>Happening Now</span>
              </span>
              <span class="text-xs sm:text-sm text-gray-300 font-medium font-mono">
                {{ ev.time }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- ================================================================= -->
      <!-- SECTION 2: "UPCOMING PUBLIC EVENTS" (Between Live & Open Jobs)     -->
      <!-- ================================================================= -->
      <section class="space-y-4 font-Sora">
        <div class="pb-1">
          <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Upcoming public events</h2>
        </div>

        <div v-if="upcomingPublicEvents.length === 0" class="text-center py-8 bg-[#131315]/40 border border-dashed border-[#2A2A2E] rounded-2xl">
          <p class="text-sm text-gray-400 font-Sora">No upcoming events</p>
        </div>

        <div v-else class="divide-y divide-[#2A2A2E]/70 rounded-2xl bg-[#131315]/60 border border-[#2A2A2E]/60 overflow-hidden">
          <div
            v-for="ev in upcomingPublicEvents"
            :key="ev.id"
            @click="ev.rawJob && openJobDetails(ev.rawJob)"
            class="flex items-center justify-between py-4 sm:py-5 px-4 sm:px-6 hover:bg-white/3 transition-colors gap-4 sm:gap-6 cursor-pointer"
          >
            <!-- Left Column: Date (Month / Day) -->
            <div class="w-12 sm:w-16 shrink-0 flex flex-col leading-tight">
              <span class="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider font-Sora">
                {{ ev.month }}
              </span>
              <span class="text-xl sm:text-2xl font-bold text-white font-Sora mt-0.5">
                {{ ev.day }}
              </span>
            </div>

            <!-- Middle Column: City/Venue (Bold) & Event/Lineup (Lighter) -->
            <div class="flex-1 min-w-0">
              <h4 class="text-base sm:text-lg font-bold text-white truncate font-Sora">
                {{ ev.venueOrCity }}
              </h4>
              <p class="text-xs sm:text-sm text-gray-400 truncate mt-0.5 font-normal">
                {{ ev.eventTitle }}
              </p>
            </div>

            <!-- Right Column: Time -->
            <div class="shrink-0 text-right">
              <span class="text-xs sm:text-sm text-gray-300 font-medium font-mono">
                {{ ev.time }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- ================================================================= -->
      <!-- SECTION 3: "OPEN JOBS / GIGS" (Casting Call with Details Modal) -->
      <!-- ================================================================= -->
      <section class="space-y-4 font-Sora">
        <div class="flex flex-col sm:flex-row sm:items-center items-end sm:gap-0 gap-1 justify-between pb-1">
          <div>
            <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Open Jobs / Gigs</h2>
          </div>
          <span class="text-xs font-mono text-gray-400">
            {{ openJobs.length }} open
          </span>
        </div>

        <div v-if="openJobs.length === 0" class="text-center py-12 bg-[#131315]/50 border border-dashed border-[#2A2A2E] rounded-2xl space-y-2">
          <Icon name="ic:outline-work-outline" class="text-3xl text-gray-500 mx-auto" />
          <p class="text-sm font-semibold text-white">No Open Gigs Available Right Now</p>
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