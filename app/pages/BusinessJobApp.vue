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

const isLoading = ref(true)
const businessId = ref('')
const currentAccountId = ref('')
const businessName = ref('')

const applications = ref<any[]>([])
const myJobListings = ref<any[]>([])
const selectedJobFilter = ref<string>('all')
const activeStatusTab = ref<'Pending' | 'Shortlisted' | 'Accepted' | 'Declined'>('Pending')

// Feedback & Contract Generation State
const actionFeedback = ref<{ status: 'success' | 'error'; message: string } | null>(null)
const isProcessing = ref(false)

// Edit Application Modal State (Business review & status changes)
const isEditModalOpen = ref(false)
const selectedAppForEdit = ref<any>(null)
const editForm = reactive({
  status: 'Pending' as 'Pending' | 'Shortlisted' | 'Accepted' | 'Declined',
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

    // 1. Fetch business jobs
    const { data: jobsData } = await db
      .from('JOB_LISTING')
      .select('Job_ID, Job_Code, Event_Title, Start_Date, End_Date, Start_Time, End_Time, Location, Compensation_Fee, Requested_Song_Lineup, Description, Status')
      .eq('Posted_By_BUSINESS_ID', businessId.value)
      .order('Created_at', { ascending: false })

    if (jobsData) {
      myJobListings.value = jobsData
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
          Status
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
// Application Actions: Accept (Generates Contract & Closes Job), Shortlist, Decline
// -----------------------------------------------------------------------------
const handleAcceptApplicant = async (app: any) => {
  isProcessing.value = true
  actionFeedback.value = null

  try {
    const job = app.JOB_LISTING
    if (!job) throw new Error('Job listing data missing.')

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

    // 3. Mark the JOB_LISTING as Closed since an applicant has been hired
    const { error: jobErr } = await db
      .from('JOB_LISTING')
      .update({ Status: 'Closed' })
      .eq('Job_ID', job.Job_ID)

    if (jobErr) console.warn('Warning updating job listing status to Closed:', jobErr)

    // 4. Send Notification to Artist
    const artistAccountId = app.ARTIST?.USER_ACCOUNT?.ACCOUNT_ID
    if (artistAccountId) {
      try {
        await db.rpc('send_notification', {
          p_account_id: artistAccountId,
          p_type: 'contract_offer',
          p_title: `Contract Offer from ${businessName.value}`,
          p_content: `${businessName.value} accepted your application for "**${job.Event_Title}**"! Please review the contract and customize your setlist.`,
          p_action_link: `/Artistprofile?tab=events&contractId=${contractCode}`,
          p_svg_type: 'contract_offer',
          p_avatar_text: (businessName.value || 'Host').substring(0, 2).toUpperCase(),
          p_action_primary: 'Review Contract',
          p_action_secondary: null,
          p_entity_id: null,
          p_entity_type: 'BOOKING_CONTRACT',
          p_metadata: { contractCode },
          p_sender_account_id: currentAccountId.value || null
        })
      } catch (notifErr) {
        await db.from('NOTIFICATION').insert({
          Account_ID: artistAccountId,
          Sender_Account_ID: currentAccountId.value || null,
          Type: 'contract_offer',
          Title: `Contract Offer from ${businessName.value}`,
          Content: `${businessName.value} has accepted your application for "**${job.Event_Title}**"! Please review the contract and customize your setlist.`,
          Action_Link: `/Artistprofile?tab=events&contractId=${contractCode}`,
          Svg_Type: 'contract_offer',
          Avatar_Text: (businessName.value || 'Host').substring(0, 2).toUpperCase(),
          Action_Primary: 'Review Contract'
        })
      }
    }

    const artistName = app.ARTIST?.StageName?.[0]?.Artist_Name || app.ARTIST?.BandName?.[0]?.Band_Name || 'Artist'

    actionFeedback.value = {
      status: 'success',
      message: `Applicant ${artistName} accepted! Job listing closed and Booking Contract ${contractCode} generated. The artist has been notified to review the contract offer.`
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
// Edit Application (Notes & Status)
// -----------------------------------------------------------------------------
const openEditModal = (app: any) => {
  selectedAppForEdit.value = app
  editForm.status = app.Status
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
        Status: editForm.status,
        Notes: editForm.notes
      })
      .eq('Application_ID', selectedAppForEdit.value.Application_ID)

    if (error) throw error

    actionFeedback.value = {
      status: 'success',
      message: 'Application review details updated successfully.'
    }
    isEditModalOpen.value = false
    await fetchApplications()
  } catch (e: any) {
    actionFeedback.value = {
      status: 'error',
      message: e.message || 'Failed to update application.'
    }
  } finally {
    isProcessing.value = false
  }
}

// -----------------------------------------------------------------------------
// Filtered Applications
// -----------------------------------------------------------------------------
const filteredApplications = computed(() => {
  return applications.value.filter(app => {
    const matchesJob = selectedJobFilter.value === 'all' || app.Job_ID === selectedJobFilter.value
    const matchesStatus = app.Status === activeStatusTab.value
    return matchesJob && matchesStatus
  })
})

const getArtistDisplayName = (artist: any) => {
  if (!artist) return 'Unknown Artist'
  return artist.StageName?.[0]?.Artist_Name || artist.BandName?.[0]?.Band_Name || artist.USER_ACCOUNT?.Username || 'Performing Artist'
}

// Deep Linking from Notifications
const checkQueryTriggers = () => {
  const jobId = route.query.jobId as string
  if (jobId) {
    selectedJobFilter.value = jobId
  }
}

watch(() => route.query.jobId, (newJobId) => {
  if (newJobId) selectedJobFilter.value = newJobId as string
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
        // Prepend new incoming applicants and update counters live without page refresh
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
  <div class="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-10 space-y-8 font-Sora">

    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A2A2E] pb-6">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Job Applications</h1>
        <p class="text-xs sm:text-sm text-gray-400 mt-1">
          Review artist auditions, manage applicant rosters, and accept performers to spawn official contracts.
        </p>
      </div>

      <!-- Job Filter Selector -->
      <div v-if="myJobListings.length > 0" class="flex items-center gap-2 self-start sm:self-auto">
        <span class="text-xs text-gray-400 shrink-0">Filter Gig:</span>
        <select
          v-model="selectedJobFilter"
          class="bg-[#1C1C1F] border border-[#3A3A3C] rounded-xl px-3 py-1.5 text-xs text-white outline-none cursor-pointer focus:border-[#D0D4F7]"
        >
          <option value="all">All Gigs ({{ myJobListings.length }})</option>
          <option v-for="job in myJobListings" :key="job.Job_ID" :value="job.Job_ID">
            {{ job.Event_Title }} ({{ job.Job_Code || 'JB' }})
          </option>
        </select>
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

    <!-- Status Tabs -->
    <div class="flex items-center gap-2 border-b border-[#2A2A2E] pb-3 text-xs overflow-x-auto">
      <button
        v-for="tab in ['Pending', 'Shortlisted', 'Accepted', 'Declined'] as const"
        :key="tab"
        type="button"
        @click="activeStatusTab = tab"
        class="px-4 py-2 rounded-full font-medium transition-all cursor-pointer whitespace-nowrap"
        :class="activeStatusTab === tab ? 'bg-[#D0D4F7] text-[#0E0E10] font-bold shadow' : 'bg-[#1C1C1F] text-gray-300 border border-[#3A3A3C] hover:bg-white/5'"
      >
        <span>{{ tab === 'Accepted' ? 'Accepted / Hired' : tab }}</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
      <div v-for="i in 4" :key="i" class="h-44 bg-[#1C1C1F] rounded-2xl border border-[#2A2A2E]"></div>
    </div>

    <!-- Applications List -->
    <div v-else>
      <div v-if="filteredApplications.length === 0" class="text-center py-16 bg-[#131315]/50 border border-dashed border-[#2A2A2E] rounded-2xl space-y-3">
        <Icon name="ic:outline-people" class="text-4xl text-gray-500 mx-auto" />
        <h3 class="text-base font-semibold text-white">No {{ activeStatusTab }} Applications</h3>
        <p class="text-xs text-gray-400 max-w-sm mx-auto">
          When artists apply to your open job listings, their portfolios and proposed setlists will appear here.
        </p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div
          v-for="app in filteredApplications"
          :key="app.Application_ID"
          class="bg-[#1C1C1F]/80 border border-[#2A2A2E] hover:border-[#46464D] rounded-2xl p-5 sm:p-6 space-y-4 transition-all shadow-lg"
        >
          <!-- Applicant Header -->
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
                <h3 class="text-base font-bold text-white">{{ getArtistDisplayName(app.ARTIST) }}</h3>
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

          <!-- Gig Reference -->
          <div class="p-3 bg-[#141416] border border-[#2A2A2E] rounded-xl text-xs space-y-1">
            <span class="text-[10px] font-mono text-[#D0D4F7] uppercase tracking-wider">APPLIED FOR GIG</span>
            <p class="text-sm font-semibold text-white truncate">{{ app.JOB_LISTING?.Event_Title }}</p>
            <p class="text-xs text-gray-400">
              📅 {{ app.JOB_LISTING?.Start_Date }} • 📍 {{ app.JOB_LISTING?.Location }}
            </p>
          </div>

          <!-- Artist Pitch Message & Proposed Fee if present -->
          <div v-if="app.Pitch_Message || app.Proposed_Fee" class="p-3 bg-[#18181B] border border-[#2A2A2E] rounded-xl text-xs space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-mono text-[#D0D4F7] uppercase tracking-wider">ARTIST PROPOSAL / PITCH</span>
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
              <span class="font-bold text-[10px] uppercase font-mono text-blue-300">Internal Review Note:</span>
              <p class="text-gray-300 text-xs">{{ app.Notes }}</p>
            </div>
          </div>

          <!-- Artist Bio snippet if present -->
          <p v-if="app.ARTIST?.Bio && !app.Pitch_Message" class="text-xs text-gray-300 line-clamp-2 italic">
            "{{ app.ARTIST.Bio }}"
          </p>

          <!-- Footer Actions -->
          <div class="flex flex-wrap items-center justify-between pt-3 border-t border-[#2A2A2E] text-xs gap-2">
            <span class="text-[10px] text-gray-500 font-mono">
              Applied {{ new Date(app.Applied_at).toLocaleDateString() }}
            </span>

            <div class="flex items-center gap-2">
              <NuxtLink
                v-if="app.ARTIST?.USER_ACCOUNT?.Username"
                :to="`/artist/${app.ARTIST.USER_ACCOUNT.Username}`"
                target="_blank"
                class="px-3 py-1.5 rounded-full border border-[#46464D] hover:bg-white/5 text-gray-300 hover:text-white transition-all cursor-pointer"
              >
                Profile
              </NuxtLink>

              <!-- Edit Application Button (Opens Modal for Notes & Status) -->
              <button
                type="button"
                @click="openEditModal(app)"
                class="px-3 py-1.5 rounded-full border border-[#46464D] hover:border-[#D0D4F7] hover:text-white text-gray-300 transition-all cursor-pointer flex items-center gap-1"
                title="Edit review notes or change status"
              >
                <Icon name="ic:outline-edit" class="text-xs" />
                <span>Edit</span>
              </button>

              <template v-if="app.Status === 'Pending' || app.Status === 'Shortlisted'">
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
                  :disabled="isProcessing"
                  class="px-4 py-1.5 rounded-full font-bold bg-[#D0D4F7] hover:bg-white text-[#131315] transition-all cursor-pointer disabled:opacity-50 shadow"
                >
                  Accept &amp; Contract
                </button>
              </template>
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
            <span class="text-[10px] font-mono text-[#D0D4F7] uppercase tracking-wider">EDIT APPLICATION DETAILS</span>
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

        <!-- Application Status Select -->
        <div class="space-y-1.5">
          <label class="block text-xs font-mono uppercase tracking-wider text-gray-300">
            Application Status
          </label>
          <select
            v-model="editForm.status"
            class="w-full bg-[#18181B] border border-[#3A3A3C] focus:border-[#D0D4F7] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none cursor-pointer"
          >
            <option value="Pending">Pending (Under Review)</option>
            <option value="Shortlisted">Shortlisted (Candidate Pool)</option>
            <option value="Accepted">Accepted (Hired)</option>
            <option value="Declined">Declined</option>
          </select>
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