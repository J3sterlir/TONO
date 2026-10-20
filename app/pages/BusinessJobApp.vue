<script setup lang="ts">
definePageMeta({
  layout: 'business',
  middleware: ['auth', 'business']
})

import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'

const supabase = useSupabaseClient()
const db = supabase as any
const route = useRoute()
const { fetchCurrentUserProfile } = useTonoAuth()
const { isEventFinished } = useTonoEvents()

const isLoading = ref(true)
const businessId = ref('')
const currentAccountId = ref('')
const businessName = ref('')

const applications = ref<any[]>([])
const myJobListings = ref<any[]>([])
const selectedJobFilter = ref<string>('all')
const activeStatusTab = ref<'Pending' | 'Shortlisted' | 'Accepted' | 'Declined' | 'All'>('Pending')
const searchQuery = ref('')

// Accordion open/close state for job cards
const expandedJobIds = ref<Set<string>>(new Set())

const toggleJobAccordion = (jobId: string) => {
  if (expandedJobIds.value.has(jobId)) {
    expandedJobIds.value.delete(jobId)
  } else {
    expandedJobIds.value.add(jobId)
  }
}

const isJobExpanded = (jobId: string) => expandedJobIds.value.has(jobId)

const expandAllJobs = () => {
  groupedJobs.value.forEach(g => expandedJobIds.value.add(g.job.Job_ID))
}

const collapseAllJobs = () => {
  expandedJobIds.value.clear()
}

// Feedback & Contract Generation State
const actionFeedback = ref<{ status: 'success' | 'error'; message: string } | null>(null)
const isProcessing = ref(false)

// Applicant Review Notes Modal State
const isEditModalOpen = ref(false)
useModalScrollLock(isEditModalOpen)
const selectedAppForEdit = ref<any>(null)
const editForm = reactive({
  notes: ''
})

const { getNextContractCode } = useCodeGenerator()

const generateFallbackContractCode = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const year = now.getFullYear()
  return `BK-${month}${day}01-${year}`
}

const fetchApplications = async () => {
  isLoading.value = true
  try {
    const profile = await fetchCurrentUserProfile()
    if (profile?.account) {
      currentAccountId.value = profile.account.ACCOUNT_ID
    }
    if (profile?.businessProfile) {
      businessId.value = profile.businessProfile.BUSINESS_ID || ''
      businessName.value = profile.businessProfile.Business_Name || 'Business Host'
    }

    if (!businessId.value) return

    // 1. Fetch business jobs including Slots
    const { data: jobsData } = await db
      .from('JOB_LISTING')
      .select('Job_ID, Job_Code, Event_Title, Start_Date, End_Date, Start_Time, End_Time, Location, Compensation_Fee, Requested_Song_Lineup, Description, Status, Slots')
      .eq('Posted_By_BUSINESS_ID', businessId.value)
      .order('Created_at', { ascending: false })

    if (jobsData) {
      myJobListings.value = jobsData
      // Auto-expand jobs
      if (route.query.jobId && typeof route.query.jobId === 'string') {
        expandedJobIds.value.add(route.query.jobId)
      } else {
        jobsData.forEach((j: any) => expandedJobIds.value.add(j.Job_ID))
      }
    }

    // Check query params for jobId filter
    if (route.query.jobId && typeof route.query.jobId === 'string') {
      selectedJobFilter.value = route.query.jobId
    }

    // 2. Fetch applications for these jobs
    const jobIds = myJobListings.value.map(j => j.Job_ID)
    if (jobIds.length === 0) {
      applications.value = []
      return
    }

    const { data: appsData, error } = await db
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
        ARTIST (
          ARTIST_ID,
          Artist_Type,
          Bio,
          StageName:SOLO_ARTIST(Artist_Name),
          BandName:BAND(Band_Name),
          USER_ACCOUNT (
            Username,
            Profile_Picture,
            City,
            Barangay
          )
        ),
        JOB_LISTING (
          Job_ID,
          Job_Code,
          Event_Title,
          Start_Date,
          End_Date,
          Start_Time,
          End_Time,
          Location,
          Compensation_Fee,
          Requested_Song_Lineup,
          Description,
          Status,
          Slots
        )
      `)
      .in('Job_ID', jobIds)
      .order('Applied_at', { ascending: false })

    if (!error && appsData) {
      applications.value = appsData
    }
  } catch (e) {
    console.error('Failed to load applications:', e)
  } finally {
    isLoading.value = false
  }
}

// -----------------------------------------------------------------------------
// Application Actions: Accept (Generates Contract & Closes Job if all slots filled), Shortlist, Decline
// -----------------------------------------------------------------------------
const handleAcceptApplicant = async (app: any) => {
  isProcessing.value = true
  actionFeedback.value = null

  try {
    const job = app.JOB_LISTING
    if (!job) throw new Error('Job listing data missing.')
    if (isEventFinished(job) || job.Status === 'Completed') {
      throw new Error('This gig has already concluded and cannot accept applicants or issue new contracts.')
    }

    const totalSlots = Number(job.Slots) || 1
    const currentAccepted = applications.value.filter(a => a.Job_ID === job.Job_ID && a.Status === 'Accepted').length

    if (currentAccepted >= totalSlots) {
      throw new Error(`All ${totalSlots} performer slot(s) for this gig have already been filled.`)
    }

    // Format business requested songs with source: 'business'
    let songs = []
    if (Array.isArray(job.Requested_Song_Lineup)) {
      songs = job.Requested_Song_Lineup.map((s: any) => ({
        ...s,
        source: 'business'
      }))
    }

    let contractCode = await getNextContractCode()

    // 1. Spawn BOOKING_CONTRACT in Pending_Artist_Approval
    const contractPayload = {
      Contract_Code: contractCode,
      Job_ID: job.Job_ID,
      Provider_Artist_ID: app.Artist_ID,
      Requester_Account_ID: currentAccountId.value,
      Provider_Business_ID: businessId.value,
      Booking_Type: 'Gig',
      Start_Date: job.Start_Date,
      End_Date: job.End_Date || job.Start_Date,
      Start_Time: job.Start_Time,
      End_Time: job.End_Time,
      Venue_Location: job.Location,
      Agreed_Fee: app.Proposed_Fee || job.Compensation_Fee,
      Song_Lineup: JSON.stringify(songs),
      Song_Lineup_JSON: songs,
      Status: 'Pending_Artist_Approval'
    }

    let insertRes = await db
      .from('BOOKING_CONTRACT')
      .insert(contractPayload)

    // Collision retry: if duplicate Contract_Code key, re-fetch latest sequence and retry once
    if (insertRes.error && (insertRes.error.message?.includes('Contract_Code') || insertRes.error.code === '23505')) {
      contractCode = await getNextContractCode()
      contractPayload.Contract_Code = contractCode
      insertRes = await db.from('BOOKING_CONTRACT').insert(contractPayload)
    }

    if (insertRes.error) throw insertRes.error

    // 2. Update APPLICATION Status to Accepted
    const { error: appErr } = await db
      .from('APPLICATION')
      .update({ Status: 'Accepted' })
      .eq('Application_ID', app.Application_ID)

    if (appErr) throw appErr

    // 3. Update JOB_LISTING status: Closed if all slots filled, otherwise remain Open
    const willBeFull = (currentAccepted + 1) >= totalSlots
    if (willBeFull) {
      const { error: jobErr } = await db
        .from('JOB_LISTING')
        .update({ Status: 'Closed' })
        .eq('Job_ID', job.Job_ID)

      if (jobErr) console.warn('Warning updating job listing status to Closed:', jobErr)
    } else {
      // Ensure listing explicitly remains 'Open' so it can be fetched by Open Jobs / Gigs
      await db
        .from('JOB_LISTING')
        .update({ Status: 'Open' })
        .eq('Job_ID', job.Job_ID)
    }

    // 4. Send Notification to Artist
    const artistAccountId = app.ARTIST?.USER_ACCOUNT?.ACCOUNT_ID
    if (artistAccountId) {
      const formattedDate = job.Start_Date
        ? new Date(job.Start_Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'scheduled date'
      const venueAddr = job.Location || 'scheduled venue'
      const notifTitle = `Application Accepted • ${contractCode}`
      const notifContent = `${businessName.value} accepted your job application to perform at ${venueAddr} on ${formattedDate}.`
      const actionLink = `/Artistprofile?tab=gigs&contractId=${contractCode}`

      // Check if DB trigger already dispatched notification for this contract to prevent duplicates
      const { data: existingNotif } = await db
        .from('NOTIFICATION')
        .select('Notification_ID')
        .eq('Account_ID', artistAccountId)
        .eq('Title', notifTitle)
        .gte('Created_At', new Date(Date.now() - 15000).toISOString())
        .limit(1)

      if (!existingNotif || existingNotif.length === 0) {
        try {
          await db.rpc('send_notification', {
            p_account_id: artistAccountId,
            p_type: 'contract_offer',
            p_title: notifTitle,
            p_content: notifContent,
            p_action_link: actionLink,
            p_svg_type: 'contract_offer',
            p_avatar_text: (businessName.value || 'Host').substring(0, 2).toUpperCase(),
            p_action_primary: 'Review & Sign',
            p_action_secondary: null,
            p_entity_id: null,
            p_entity_type: 'BOOKING_CONTRACT',
            p_metadata: { contractCode, is_job_application: true },
            p_sender_account_id: currentAccountId.value || null
          })
        } catch (notifErr) {
          await db.from('NOTIFICATION').insert({
            Account_ID: artistAccountId,
            Sender_Account_ID: currentAccountId.value || null,
            Type: 'contract_offer',
            Title: notifTitle,
            Content: notifContent,
            Action_Link: actionLink,
            Svg_Type: 'contract_offer',
            Avatar_Text: (businessName.value || 'Host').substring(0, 2).toUpperCase(),
            Action_Primary: 'Review & Sign'
          })
        }
      }
    }

    const artistName = app.ARTIST?.StageName?.[0]?.Artist_Name || app.ARTIST?.BandName?.[0]?.Band_Name || 'Artist'
    const remaining = totalSlots - (currentAccepted + 1)
    const slotInfo = willBeFull
      ? `All ${totalSlots} slot(s) filled! Gig listing marked as Closed.`
      : `${remaining} more slot(s) open for this gig.`

    actionFeedback.value = {
      status: 'success',
      message: `Applicant ${artistName} accepted! Booking Contract ${contractCode} generated. ${slotInfo}`
    }

    await fetchApplications()
  } catch (err: any) {
    actionFeedback.value = {
      status: 'error',
      message: err.message || 'Failed to accept applicant and generate contract.'
    }
  } finally {
    isProcessing.value = false
  }
}

const handleUpdateStatus = async (appId: string, newStatus: 'Pending' | 'Shortlisted' | 'Declined') => {
  try {
    const { error } = await db
      .from('APPLICATION')
      .update({ Status: newStatus })
      .eq('Application_ID', appId)

    if (!error) {
      actionFeedback.value = {
        status: 'success',
        message: `Application marked as ${newStatus}.`
      }
      await fetchApplications()
    }
  } catch (e: any) {
    console.error(`Failed to update application to ${newStatus}:`, e)
  }
}

// -----------------------------------------------------------------------------
// Applicant Internal Review Notes Modal
// -----------------------------------------------------------------------------
const openEditModal = (app: any) => {
  selectedAppForEdit.value = app
  editForm.notes = app.Notes || ''
  isEditModalOpen.value = true
}

const handleSaveAppEdit = async () => {
  if (!selectedAppForEdit.value) return
  isProcessing.value = true
  try {
    const { error } = await db
      .from('APPLICATION')
      .update({
        Notes: editForm.notes
      })
      .eq('Application_ID', selectedAppForEdit.value.Application_ID)

    if (error) throw error

    actionFeedback.value = {
      status: 'success',
      message: 'Applicant internal review notes saved successfully.'
    }
    isEditModalOpen.value = false
    await fetchApplications()
  } catch (e: any) {
    actionFeedback.value = {
      status: 'error',
      message: e.message || 'Failed to update application notes.'
    }
  } finally {
    isProcessing.value = false
  }
}

// -----------------------------------------------------------------------------
// Grouped Applications by Job Listing (Accordion Structure)
// -----------------------------------------------------------------------------
const getArtistDisplayName = (artist: any) => {
  if (!artist) return 'Unknown Artist'
  return artist.StageName?.[0]?.Artist_Name || artist.BandName?.[0]?.Band_Name || artist.USER_ACCOUNT?.Username || 'Performing Artist'
}

const groupedJobs = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return myJobListings.value.map(job => {
    const slots = Number(job.Slots) || 1
    const allAppsForJob = applications.value.filter(a => a.Job_ID === job.Job_ID)
    const acceptedCount = allAppsForJob.filter(a => a.Status === 'Accepted').length
    const isFull = acceptedCount >= slots
    const remainingSlots = Math.max(0, slots - acceptedCount)

    // Filter matching applications for this job based on active status tab & search query
    const matchingApps = allAppsForJob.filter(app => {
      const matchesStatus = activeStatusTab.value === 'All' || app.Status === activeStatusTab.value
      if (!matchesStatus) return false

      if (!query) return true

      const artistName = getArtistDisplayName(app.ARTIST).toLowerCase()
      const artistType = (app.ARTIST?.Artist_Type || '').toLowerCase()
      const city = (app.ARTIST?.USER_ACCOUNT?.City || '').toLowerCase()
      const pitch = (app.Pitch_Message || '').toLowerCase()
      const jobTitle = (job.Event_Title || '').toLowerCase()
      const jobCode = (job.Job_Code || '').toLowerCase()

      return (
        artistName.includes(query) ||
        artistType.includes(query) ||
        city.includes(query) ||
        pitch.includes(query) ||
        jobTitle.includes(query) ||
        jobCode.includes(query)
      )
    })

    return {
      job,
      slots,
      acceptedCount,
      remainingSlots,
      isFull,
      allApps: allAppsForJob,
      matchingApps
    }
  }).filter(group => {
    // Specific jobId filter check
    if (selectedJobFilter.value !== 'all' && group.job.Job_ID !== selectedJobFilter.value) {
      return false
    }

    // If query is present, check if job or applicants match
    if (query) {
      const jobMatches = (group.job.Event_Title || '').toLowerCase().includes(query) || (group.job.Job_Code || '').toLowerCase().includes(query)
      return jobMatches || group.matchingApps.length > 0
    }

    // Default: show jobs that have applications or are currently open
    return group.allApps.length > 0 || group.job.Status === 'Open'
  })
})

const tabCounts = computed(() => {
  const counts = {
    Pending: 0,
    Shortlisted: 0,
    Accepted: 0,
    Declined: 0,
    All: applications.value.length
  }
  for (const app of applications.value) {
    if (app.Status in counts) {
      counts[app.Status as keyof typeof counts]++
    }
  }
  return counts
})

// Deep Linking from Notifications
const checkQueryTriggers = () => {
  const jobId = route.query.jobId as string
  if (jobId) {
    selectedJobFilter.value = jobId
    expandedJobIds.value.add(jobId)
  }
}

watch(() => route.query.jobId, (newJobId) => {
  if (newJobId) {
    selectedJobFilter.value = newJobId as string
    expandedJobIds.value.add(newJobId as string)
  }
})

// Realtime Zero-Refresh: Sync incoming applications live
let applicationsLiveChannel: any = null
const setupRealtimeApplications = () => {
  if (applicationsLiveChannel) return

  applicationsLiveChannel = supabase
    .channel('business-job-apps-live')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'APPLICATION'
      },
      async () => {
        await fetchApplications()
      }
    )
    .subscribe()
}

onMounted(async () => {
  checkQueryTriggers()
  await fetchApplications()
  setupRealtimeApplications()
})

onBeforeUnmount(() => {
  if (applicationsLiveChannel) {
    supabase.removeChannel(applicationsLiveChannel)
    applicationsLiveChannel = null
  }
})
</script>

<template>
  <head>
    <title>Business Job Applications | TONO</title>
  </head>
  <div class="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-10 space-y-8 font-Sora">

    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Job Applications</h1>
        <p class="text-xs text-gray-400 mt-1">Review candidates and hire performers grouped by gig listing</p>
      </div>

      <!-- Quick Expand / Collapse Actions -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="expandAllJobs"
          class="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#3A3A3C] text-gray-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
        >
          Expand All
        </button>
        <button
          type="button"
          @click="collapseAllJobs"
          class="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#3A3A3C] text-gray-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
        >
          Collapse All
        </button>
      </div>
    </div>

    <!-- Alert / Feedback Notification -->
    <div
      v-if="actionFeedback"
      class="p-4 rounded-xl border flex items-center justify-between text-xs"
      :class="actionFeedback.status === 'success' ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' : 'bg-red-950/30 border-red-500/40 text-red-200'"
    >
      <div class="flex items-center gap-2">
        <Icon :name="actionFeedback.status === 'success' ? 'ic:round-check-circle' : 'ic:baseline-error'" class="text-lg shrink-0" />
        <span>{{ actionFeedback.message }}</span>
      </div>
      <button @click="actionFeedback = null" class="text-gray-400 hover:text-white cursor-pointer">
        <Icon name="ic:round-close" class="text-base" />
      </button>
    </div>

    <!-- Controls Bar: Search & Status Tabs -->
    <div class="space-y-4">
      <!-- Search Input -->
      <div class="relative max-w-md w-full">
        <Icon name="ic:round-search" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search applicants, artists, gigs, or genres..."
          class="w-full bg-[#1C1C1F] border border-[#2A2A2E] focus:border-[#D0D4F7] text-white text-xs pl-10 pr-4 py-2.5 rounded-xl outline-none placeholder-gray-500 transition-colors"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
        >
          <Icon name="ic:round-close" class="text-sm" />
        </button>
      </div>

      <!-- Status Tabs -->
      <div class="flex items-center gap-2 border-b border-[#2A2A2E] pb-3 text-xs overflow-x-auto">
        <button
          v-for="tab in (['Pending', 'Shortlisted', 'Accepted', 'Declined', 'All'] as const)"
          :key="tab"
          type="button"
          @click="activeStatusTab = tab"
          class="px-4 py-2 rounded-full font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-2"
          :class="activeStatusTab === tab ? 'bg-[#D0D4F7] text-[#0E0E10] font-bold shadow' : 'bg-[#1C1C1F] text-gray-300 border border-[#3A3A3C] hover:bg-white/5'"
        >
          <span>{{ tab === 'Accepted' ? 'Accepted / Hired' : tab }}</span>
          <span
            class="text-[10px] px-1.5 py-0.2 rounded-full font-mono"
            :class="activeStatusTab === tab ? 'bg-[#0E0E10]/20 text-[#0E0E10]' : 'bg-[#2A2A2E] text-gray-400'"
          >
            {{ tabCounts[tab] }}
          </span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="space-y-4 animate-pulse">
      <div v-for="i in 3" :key="i" class="h-28 bg-[#1C1C1F] rounded-2xl border border-[#2A2A2E]"></div>
    </div>

    <!-- Grouped Job Listings (Accordion) -->
    <div v-else>
      <div v-if="groupedJobs.length === 0" class="text-center py-16 bg-[#131315]/50 border border-dashed border-[#2A2A2E] rounded-2xl space-y-3">
        <Icon name="ic:outline-people" class="text-4xl text-gray-500 mx-auto" />
        <h3 class="text-base font-semibold text-white">No Applications Found</h3>
        <p class="text-xs text-gray-400">Try switching status tabs or clear your search query.</p>
      </div>

      <div v-else class="space-y-5">
        <div
          v-for="group in groupedJobs"
          :key="group.job.Job_ID"
          class="border border-[#2A2A2E] rounded-2xl bg-[#141416]/90 overflow-hidden transition-all shadow-md"
        >
          <!-- Job Listing Header Accordion Toggle -->
          <div
            role="button"
            tabindex="0"
            @click="toggleJobAccordion(group.job.Job_ID)"
            @keydown.enter="toggleJobAccordion(group.job.Job_ID)"
            @keydown.space.prevent="toggleJobAccordion(group.job.Job_ID)"
            class="w-full p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left hover:bg-white/2 transition-colors cursor-pointer select-none"
          >
            <!-- Left: Job Details -->
            <div class="space-y-1.5 flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-[10px] font-mono text-[#D0D4F7] uppercase tracking-wider bg-[#1E1E24] px-2 py-0.5 rounded border border-[#46464D]/50">
                  {{ group.job.Job_Code || 'GIG' }}
                </span>
                <span
                  class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold"
                  :class="group.isFull ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'"
                >
                  Slots: {{ group.acceptedCount }} / {{ group.slots }} Hired {{ group.isFull ? '(Filled)' : '' }}
                </span>
                <span
                  v-if="group.job.Status === 'Closed'"
                  class="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20"
                >
                  Closed
                </span>
              </div>
              <h3 class="text-base sm:text-lg font-bold text-white truncate">{{ group.job.Event_Title }}</h3>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                <span>📅 {{ group.job.Start_Date }}</span>
                <span v-if="group.job.Start_Time">⏰ {{ group.job.Start_Time }}</span>
                <span>📍 {{ group.job.Location || 'Venue TBA' }}</span>
                <span v-if="group.job.Compensation_Fee" class="text-emerald-400 font-mono font-medium">
                  ₱{{ Number(group.job.Compensation_Fee).toLocaleString() }}
                </span>
              </div>
            </div>

            <!-- Right: Count & Arrow -->
            <div class="flex items-center gap-3 shrink-0 self-end md:self-center">
              <div class="text-right">
                <span class="text-xs font-semibold text-white block">
                  {{ group.matchingApps.length }} {{ activeStatusTab === 'All' ? 'Applicant' : activeStatusTab }}
                </span>
                <span class="text-[10px] text-gray-400 font-mono block">
                  ({{ group.allApps.length }} Total)
                </span>
              </div>
              <div
                class="w-8 h-8 rounded-full bg-[#1C1C1F] border border-[#2A2A2E] flex items-center justify-center text-gray-400 transition-transform duration-200"
                :class="{ 'rotate-180 text-white': isJobExpanded(group.job.Job_ID) }"
              >
                <Icon name="ic:round-keyboard-arrow-down" class="text-lg" />
              </div>
            </div>
          </div>

          <!-- Enclosed Application Cards Container -->
          <div v-if="isJobExpanded(group.job.Job_ID)" class="p-4 sm:p-5 border-t border-[#2A2A2E] bg-[#0E0E10]/60 space-y-4">
            <!-- Empty state for this job -->
            <div v-if="group.matchingApps.length === 0" class="text-center py-8 bg-[#18181B]/40 border border-dashed border-[#2A2A2E] rounded-xl space-y-1">
              <p class="text-xs text-gray-400">
                No {{ activeStatusTab === 'All' ? '' : activeStatusTab.toLowerCase() }} applications for this gig.
              </p>
              <p v-if="group.allApps.length > 0" class="text-[11px] text-gray-500">
                ({{ group.allApps.length }} total applications in other categories)
              </p>
            </div>

            <!-- Application Cards Grid -->
            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-for="app in group.matchingApps"
                :key="app.Application_ID"
                class="bg-[#1C1C1F]/90 border border-[#2A2A2E] hover:border-[#46464D] rounded-2xl p-4 sm:p-5 space-y-4 transition-all shadow-md flex flex-col justify-between"
              >
                <!-- Card Header: Artist info -->
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full bg-[#2A2A2E] border border-[#3A3A3C] overflow-hidden shrink-0 flex items-center justify-center">
                      <img
                        v-if="app.ARTIST?.USER_ACCOUNT?.Profile_Picture"
                        :src="app.ARTIST.USER_ACCOUNT.Profile_Picture"
                        alt="Avatar"
                        class="w-full h-full object-cover"
                      />
                      <Icon v-else name="ic:outline-account-circle" class="text-2xl text-gray-400" />
                    </div>
                    <div>
                      <h4 class="text-base font-bold text-white">{{ getArtistDisplayName(app.ARTIST) }}</h4>
                      <p class="text-xs text-gray-400">
                        {{ app.ARTIST?.Artist_Type || 'Solo' }} • {{ app.ARTIST?.USER_ACCOUNT?.City || 'Philippines' }}
                      </p>
                    </div>
                  </div>

                  <span
                    class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold"
                    :class="{
                      'bg-amber-500/10 text-amber-300 border border-amber-500/20': app.Status === 'Pending',
                      'bg-blue-500/10 text-blue-300 border border-blue-500/20': app.Status === 'Shortlisted',
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': app.Status === 'Accepted',
                      'bg-red-500/10 text-red-300 border border-red-500/20': app.Status === 'Declined'
                    }"
                  >
                    {{ app.Status }}
                  </span>
                </div>

                <!-- Artist Proposal & Proposed Fee -->
                <div v-if="app.Pitch_Message || app.Proposed_Fee" class="p-3 bg-[#18181B] border border-[#2A2A2E] rounded-xl text-xs space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-mono text-[#D0D4F7] uppercase tracking-wider">ARTIST PROPOSAL</span>
                    <span v-if="app.Proposed_Fee" class="font-mono text-emerald-400 font-semibold text-xs">
                      Proposed: ₱{{ Number(app.Proposed_Fee).toLocaleString() }}
                    </span>
                  </div>
                  <p v-if="app.Pitch_Message" class="text-xs text-gray-200 leading-relaxed italic">
                    "{{ app.Pitch_Message }}"
                  </p>
                </div>

                <!-- Internal Review Notes if set -->
                <div v-if="app.Notes" class="p-2.5 bg-blue-950/20 border border-blue-500/30 rounded-xl text-xs text-blue-200 flex items-start gap-2">
                  <Icon name="ic:baseline-sticky-note-2" class="text-sm text-blue-400 shrink-0 mt-0.5" />
                  <div class="space-y-0.5">
                    <span class="font-bold text-[10px] uppercase font-mono text-blue-300">Review Note:</span>
                    <p class="text-gray-300 text-xs">{{ app.Notes }}</p>
                  </div>
                </div>

                <!-- Artist Bio snippet if present and no pitch -->
                <p v-if="app.ARTIST?.Bio && !app.Pitch_Message" class="text-xs text-gray-300 line-clamp-2 italic">
                  "{{ app.ARTIST.Bio }}"
                </p>

                <!-- Footer Actions -->
                <div class="flex flex-wrap items-center justify-between pt-3 border-t border-[#2A2A2E] text-xs gap-2 mt-auto">
                  <span class="text-[10px] text-gray-500 font-mono">
                    Applied {{ new Date(app.Applied_at).toLocaleDateString() }}
                  </span>

                  <div class="flex flex-wrap items-center gap-2">
                    <NuxtLink
                      v-if="app.ARTIST?.USER_ACCOUNT?.Username"
                      :to="`/artist/${app.ARTIST.USER_ACCOUNT.Username}`"
                      target="_blank"
                      class="px-3 py-1.5 rounded-full border border-[#46464D] hover:bg-white/5 text-gray-300 hover:text-white transition-all cursor-pointer"
                    >
                      Check Profile
                    </NuxtLink>

                    <button
                      type="button"
                      @click="openEditModal(app)"
                      class="px-3 py-1.5 rounded-full border border-[#46464D] hover:bg-white/5 text-gray-300 hover:text-white transition-all cursor-pointer"
                      title="Add internal note or edit review"
                    >
                      Notes
                    </button>

                    <template v-if="(app.Status === 'Pending' || app.Status === 'Shortlisted') && !isEventFinished(group.job) && group.job?.Status !== 'Completed'">
                      <button
                        v-if="app.Status === 'Pending'"
                        type="button"
                        @click="handleUpdateStatus(app.Application_ID, 'Shortlisted')"
                        class="px-3 py-1.5 rounded-full border border-blue-500/40 text-blue-300 hover:bg-blue-500/10 transition-all cursor-pointer"
                      >
                        Shortlist
                      </button>
                      <button
                        type="button"
                        @click="handleUpdateStatus(app.Application_ID, 'Declined')"
                        class="px-3 py-1.5 rounded-full border border-red-500/40 text-red-300 hover:bg-red-500/10 transition-all cursor-pointer"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        @click="handleAcceptApplicant(app)"
                        :disabled="isProcessing || group.isFull"
                        class="px-4 py-1.5 rounded-full font-bold transition-all cursor-pointer shadow text-xs flex items-center gap-1.5"
                        :class="group.isFull ? 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-60' : 'bg-[#D0D4F7] hover:bg-white text-[#131315]'"
                        :title="group.isFull ? `All ${group.slots} performer slots filled for this gig` : 'Generate contract offer for this applicant'"
                      >
                        <span v-if="group.isFull">Slots Filled ({{ group.acceptedCount }}/{{ group.slots }})</span>
                        <span v-else>Accept &amp; Contract</span>
                      </button>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Application Modal (Business Perspective) -->
    <div v-if="isEditModalOpen && selectedAppForEdit" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="isEditModalOpen = false"></div>
      <div class="relative w-full max-w-lg bg-[#131315] border border-[#2A2A2E] rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5 text-white z-10 font-Sora animate-in zoom-in-95 duration-200">
        <div class="flex items-start justify-between border-b border-[#2A2A2E] pb-4">
          <div>
            <span class="text-[10px] font-mono text-[#D0D4F7] uppercase tracking-wider">APPLICANT REVIEW NOTES</span>
            <h2 class="text-lg font-bold text-white mt-0.5">
              {{ getArtistDisplayName(selectedAppForEdit.ARTIST) }}
            </h2>
            <p class="text-xs text-gray-400">
              Gig: {{ selectedAppForEdit.JOB_LISTING?.Event_Title }}
            </p>
          </div>
          <button @click="isEditModalOpen = false" class="text-gray-400 hover:text-white p-1 cursor-pointer">
            <Icon name="ic:round-close" class="text-xl" />
          </button>
        </div>



        <!-- Internal Business Review Notes -->
        <div class="space-y-1.5">
          <label class="block text-xs font-mono uppercase tracking-wider text-gray-300">
            Internal Review Notes
          </label>
          <textarea
            v-model="editForm.notes"
            rows="3"
            placeholder="Add internal feedback, interview impressions, or setup requirements for this applicant..."
            class="w-full bg-[#18181B] border border-[#3A3A3C] focus:border-[#D0D4F7] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none resize-none leading-relaxed"
          ></textarea>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-[#2A2A2E]">
          <button
            type="button"
            @click="isEditModalOpen = false"
            class="px-5 py-2 rounded-full text-xs font-medium border border-[#46464D] text-gray-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="handleSaveAppEdit"
            :disabled="isProcessing"
            class="px-5 py-2 rounded-full text-xs font-bold bg-[#D0D4F7] hover:bg-white text-[#131315] transition-all cursor-pointer disabled:opacity-50 shadow flex items-center gap-1.5"
          >
            <Icon v-if="isProcessing" name="ic:baseline-sync" class="animate-spin text-sm" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>