<script setup lang="ts">
definePageMeta({
  layout: 'user',
  middleware: 'auth'
})

import { ref, computed, onMounted } from 'vue'

const supabase = useSupabaseClient()
const db = supabase as any
const { fetchCurrentUserProfile } = useTonoAuth()

const currentAccountId = ref('')
const eventsLoading = ref(true)

const yourEvents = ref<any[]>([])
const liveEvents = ref<any[]>([])

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
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

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

    // 2. Fetch Live Events Happening Today across TONO (Section 2)
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
          Job_ID,
          Job_Code,
          Event_Title,
          Location
        )
      `)
      .in('Status', ['Confirmed', 'Active'])
      .lte('Start_Date', todayStr)
      .gte('End_Date', todayStr)
      .limit(6)

    liveEvents.value = liveData || []
  } catch (e) {
    console.error('Failed to load user events:', e)
  } finally {
    eventsLoading.value = false
  }
}
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
          <p class="text-sm text-gray-400 mt-2 font-Sora">
            Catch live performances, track your booked events, and discover gigs across TONO partner venues.
          </p>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- SECTION 1: "YOUR EVENTS" (Deduplicated Job Listings vs Contracts) -->
      <!-- ================================================================= -->
      <section class="space-y-4 font-Sora">
        <div class="flex items-center justify-between border-b border-[#2A2A2E] pb-3">
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
          <p class="text-xs text-gray-400">Discover local talent on TONO and book live musical acts to fill your schedule.</p>
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
      <!-- SECTION 2: "LIVE EVENTS / GIGS" (Happening Today)                -->
      <!-- ================================================================= -->
      <section class="space-y-4 font-Sora">
        <div class="flex items-center justify-between border-b border-[#2A2A2E] pb-3">
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
            <p v-if="live.ARTIST" class="text-xs text-rose-300 flex items-center gap-1.5">
              <Icon name="ic:outline-music-note" class="text-sm" />
              <span>{{ getArtistDisplayName(live.ARTIST) }}</span>
            </p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>