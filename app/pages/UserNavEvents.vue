<script setup lang="ts">
definePageMeta({
  layout: 'user',
  middleware: 'auth'
})

import { ref, computed, onMounted } from 'vue'
import { useTonoEvents } from '~/composables/useTonoEvents'
import { formatTime12, formatTimeRange12 } from '~/utils/formatTime'

const supabase = useSupabaseClient()
const db = supabase as any
const { fetchCurrentUserProfile } = useTonoAuth()
const { isEventHappeningNow, isEventFinished } = useTonoEvents()

const currentAccountId = ref('')
const eventsLoading = ref(true)

const yourEvents = ref<any[]>([])
const allPublicJobEvents = ref<any[]>([])

const getArtistDisplayName = (artist: any) => {
  if (!artist) return 'Performing Artist'
  return artist.BandName?.Band_Name || artist.StageName?.Artist_Name || artist.USER_ACCOUNT?.Username || 'Artist'
}

onMounted(async () => {
  try {
    const profile = await fetchCurrentUserProfile()
    if (profile?.account) {
      currentAccountId.value = profile.account.ACCOUNT_ID
    }
    await fetchUserEvents()
  } catch (error) {
    console.error('Error loading user events page:', error)
  } finally {
    eventsLoading.value = false
  }
})

const fetchUserEvents = async () => {
  eventsLoading.value = true
  try {
    // 1. Fetch User Confirmed Events (Section 1)
    if (currentAccountId.value) {
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
            Compensation_Fee,
            Description
          )
        `)
        .eq('Requester_Account_ID', currentAccountId.value)
        .in('Status', ['Confirmed', 'Active'])
        .order('Start_Date', { ascending: true })

      if (!confirmedErr && confirmedData) {
        yourEvents.value = confirmedData
      }
    }

    // 2. Fetch All Public Job Listing Events (Live & Upcoming across TONO)
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
        console.error('[UserNavEvents] Error fetching public job listings:', publicJobsErr)
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
        console.error('[UserNavEvents] Error fetching public contracts:', publicContractsErr)
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
          console.warn('[UserNavEvents] Could not resolve artist names:', errArt)
        }
      }

      // D. Combine both sources grouped by Job_ID so all performers are gathered
      const combinedEvents: any[] = []
      const jobContractsMap = new Map<string, any[]>()
      const standaloneContracts: any[] = []

      if (publicContractsData) {
        for (const contract of publicContractsData) {
          if (contract.JOB_LISTING && contract.JOB_LISTING.Is_Public === false) continue
          if (contract.Job_ID) {
            if (!jobContractsMap.has(contract.Job_ID)) {
              jobContractsMap.set(contract.Job_ID, [])
            }
            jobContractsMap.get(contract.Job_ID)!.push(contract)
          } else {
            standaloneContracts.push(contract)
          }
        }
      }

      // Add standalone contracts
      for (const contract of standaloneContracts) {
        combinedEvents.push(contract)
      }

      const processedJobIds = new Set<string>()

      // Process grouped contracts by Job_ID
      for (const [jobId, contracts] of jobContractsMap.entries()) {
        processedJobIds.add(jobId)
        const primary = { ...contracts[0] }
        const artistNames = contracts
          .map((c: any) => c.ARTIST?.BandName?.Band_Name || c.ARTIST?.StageName?.Artist_Name || c.ARTIST?.USER_ACCOUNT?.Username || '')
          .filter(Boolean)
        const distinctArtists = [...new Set(artistNames)]
        primary._allArtists = distinctArtists
        primary._allContracts = contracts
        combinedEvents.push(primary)
      }

      // Then add any open or published job listings not already covered
      if (publicJobsData) {
        for (const job of publicJobsData) {
          if (job.Is_Public === false) continue
          if (processedJobIds.has(job.Job_ID)) continue
          processedJobIds.add(job.Job_ID)

          const activeContracts = Array.isArray(job.BOOKING_CONTRACT)
            ? job.BOOKING_CONTRACT.filter((c: any) => ['Confirmed', 'Active', 'Completed'].includes(c.Status) && c.Provider_Artist_ID)
            : []
          const artistNames = activeContracts
            .map((c: any) => artistLookup[c.Provider_Artist_ID] || '')
            .filter(Boolean)
          const distinctArtists = [...new Set(artistNames)]

          combinedEvents.push({
            ...job,
            _allArtists: distinctArtists,
            _resolvedArtistName: distinctArtists.join(', ')
          })
        }
      }

      allPublicJobEvents.value = combinedEvents
    } catch (errPublic) {
      console.error('[UserNavEvents] Error combining public events:', errPublic)
    }
  } catch (e) {
    console.error('Failed to load user events:', e)
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

  const artistName = (item._allArtists && item._allArtists.length > 0)
    ? item._allArtists.join(', ')
    : (item.ARTIST
        ? (item.ARTIST.BandName?.Band_Name || item.ARTIST.StageName?.Artist_Name || item.ARTIST.USER_ACCOUNT?.Username || '')
        : (item._resolvedArtistName || ''))

  const title = item.Event_Title || item.JOB_LISTING?.Event_Title || 'Live Music Gig'
  let eventTitle = title
  if (artistName) {
    if (!title.toLowerCase().includes(artistName.toLowerCase())) {
      eventTitle = `${title} • ${artistName}`
    } else {
      eventTitle = title
    }
  }

  const time = formatTime12(item.Start_Time || item.Time || item.JOB_LISTING?.Start_Time || item.JOB_LISTING?.Time)

  return {
    id: item.Booking_ID || item.Job_ID || Math.random().toString(),
    month,
    day,
    venueOrCity,
    eventTitle,
    time: time || 'TBA',
    rawJob: item.JOB_LISTING ? { ...item.JOB_LISTING, ...item } : item
  }
}

// Compute live events happening today
const liveEvents = computed(() => {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Candidate pool: All public events + user's confirmed events
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
      // If it's private and not the user's own confirmed contract, skip
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
</script>

<template>
  <title>Events | TONO</title>
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
      <!-- SECTION 1: "YOUR EVENTS" (Deduplicated Job Listings vs Contracts) -->
      <!-- ================================================================= -->
      <section class="space-y-4 font-Sora">
        <div class="flex items-center justify-between border-b border-[#2A2A2E] pb-3">
          <div>
            <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Your Events</h2>
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
                <span v-if="isEventHappeningNow(event)" class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>Happening Now</span>
                </span>
                <span v-else-if="isEventFinished(event)" class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-gray-500/15 text-gray-400 border border-gray-500/30">
                  Ended
                </span>
                <span v-else class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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

              <div v-if="event.ARTIST" class="flex items-center gap-2 text-gray-400">
                <Icon name="ic:outline-music-note" class="text-[#D0D4F7] text-sm shrink-0" />
                <span>Artist: {{ getArtistDisplayName(event.ARTIST) }}</span>
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
      <!-- SECTION 2: "LIVE EVENTS" (Happening Today)                        -->
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
            class="flex items-center justify-between py-4 sm:py-5 px-4 sm:px-6 hover:bg-white/3 transition-colors gap-4 sm:gap-6"
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
      <!-- SECTION 3: "UPCOMING PUBLIC EVENTS"                               -->
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
            class="flex items-center justify-between py-4 sm:py-5 px-4 sm:px-6 hover:bg-white/3 transition-colors gap-4 sm:gap-6"
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
    </main>
  </div>
</template>