<script setup lang="ts">
definePageMeta({
  layout: 'business',
  middleware: ['auth', 'business']
})

import { ref, reactive, computed, onMounted, watch } from 'vue'

const supabase = useSupabaseClient()
const db = supabase as any
const user = useSupabaseUser()
const { fetchCurrentUserProfile } = useTonoAuth()

// Tab state for listings view
const activeTab = ref<'active' | 'pending_drafts' | 'history'>('active')
const isCreatingListing = ref(false)
const isLoading = ref(true)

// Business Context
const businessProfile = ref<any>(null)
const currentAccountId = ref('')
const businessName = ref('Business Account')
const businessId = ref('')

// Job Listings State from Supabase
const jobListings = ref<any[]>([])

// 5-Day Proximity Sanction Modal State
const isWarningModalOpen = ref(false)
const targetListingForCancellation = ref<any>(null)

// -----------------------------------------------------------------------------
// Database-Backed Draft & Form 3 Setup
// -----------------------------------------------------------------------------
const isJobDraftSaving = ref(false)
const editingJobId = ref<string | null>(null)
const editingJobStatus = ref<string | null>(null)

interface SongItem {
  id: string
  title: string
  duration: string
  source?: 'business' | 'artist'
}

const { getNextJobCode } = useCodeGenerator()

const jobSongLineupList = ref<SongItem[]>([])

const generateFallbackJobCode = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const year = now.getFullYear()
  return `JB-${month}${day}01-${year}`
}

const jobListingForm = reactive({
  jobId: generateFallbackJobCode(),
  businessName: '',
  businessId: '',
  eventTitle: '',
  location: '',
  startDate: '',
  endDate: '',
  startTime: '19:00',
  endTime: '22:00',
  compensationFee: null as number | null,
  description: '',
})

const refreshJobCode = async () => {
  if (!editingJobId.value) {
    try {
      jobListingForm.jobId = await getNextJobCode()
    } catch (e) {
      console.warn('Error refreshing job code:', e)
    }
  }
}

const addSongToJob = () => {
  jobSongLineupList.value.push({
    id: `song_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    title: '',
    duration: '',
    source: 'business'
  })
}

const removeSongFromJob = (index: number) => {
  jobSongLineupList.value.splice(index, 1)
}

const businessAddress = computed(() => {
  return businessProfile.value?.Business_Address || ''
})

const formDaysUntilStart = computed(() => {
  if (!jobListingForm.startDate) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(jobListingForm.startDate)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
})

const isFormRushBooking = computed(() => {
  if (formDaysUntilStart.value === null) return false
  return formDaysUntilStart.value <= 5 && formDaysUntilStart.value >= 0
})

const resetJobForm = async () => {
  editingJobId.value = null
  editingJobStatus.value = null
  jobListingForm.jobId = generateFallbackJobCode()
  jobListingForm.eventTitle = ''
  // Autofill with registered business address by default, but user can freely edit or change it
  jobListingForm.location = businessProfile.value?.Business_Address || ''
  jobListingForm.startDate = ''
  jobListingForm.endDate = ''
  jobListingForm.startTime = '19:00'
  jobListingForm.endTime = '22:00'
  jobListingForm.compensationFee = null
  jobListingForm.description = ''
  jobSongLineupList.value = []
  isCreatingListing.value = false
  await refreshJobCode()
}

const toggleCreationForm = async () => {
  if (isCreatingListing.value) {
    await resetJobForm()
  } else {
    await resetJobForm()
    isCreatingListing.value = true
  }
}

// -----------------------------------------------------------------------------
// Database Operations (Fetch, Post, Draft, Cancel)
// -----------------------------------------------------------------------------
const fetchBusinessAndJobs = async () => {
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
      jobListingForm.businessName = businessName.value
      jobListingForm.businessId = businessId.value

      // Autofill default venue location with registered business address if currently empty
      if (!jobListingForm.location && profile.businessProfile.Business_Address) {
        jobListingForm.location = profile.businessProfile.Business_Address
      }
    }

    if (businessId.value) {
      const { data, error } = await db
        .from('JOB_LISTING')
        .select(`
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
          Status,
          Created_at,
          Requested_Song_Lineup,
          APPLICATION (count)
        `)
        .eq('Posted_By_BUSINESS_ID', businessId.value)
        .order('Created_at', { ascending: false })

      if (!error && data) {
        jobListings.value = data
      }
    }

    if (!editingJobId.value) {
      await refreshJobCode()
    }
  } catch (e) {
    console.error('Failed to load business job listings:', e)
  } finally {
    isLoading.value = false
  }
}

const isSubmittingJob = ref(false)
const submissionFeedback = ref<{ status: 'success' | 'error'; message: string } | null>(null)

// Save Draft to Database (JOB_LISTING with Status = 'Draft')
const handleSaveDraft = async () => {
  if (!businessId.value) {
    submissionFeedback.value = {
      status: 'error',
      message: 'Business account not loaded yet. Please try again.'
    }
    return
  }

  if (!jobListingForm.eventTitle || !jobListingForm.eventTitle.trim()) {
    submissionFeedback.value = {
      status: 'error',
      message: 'Please provide at least an Event Title before saving as a draft.'
    }
    return
  }

  isJobDraftSaving.value = true
  submissionFeedback.value = null

  try {
    const draftPayload = {
      Posted_By_BUSINESS_ID: businessId.value,
      Job_Code: jobListingForm.jobId,
      Event_Title: jobListingForm.eventTitle.trim(),
      Location: jobListingForm.location || null,
      Start_Date: jobListingForm.startDate || null,
      End_Date: jobListingForm.endDate || jobListingForm.startDate || null,
      Start_Time: jobListingForm.startTime || null,
      End_Time: jobListingForm.endTime || null,
      Compensation_Fee: jobListingForm.compensationFee || null,
      Description: jobListingForm.description || null,
      Requested_Song_Lineup: jobSongLineupList.value,
      Status: 'Draft',
      Is_Rush_Booking: false
    }

    if (editingJobId.value) {
      const { error } = await db
        .from('JOB_LISTING')
        .update(draftPayload)
        .eq('Job_ID', editingJobId.value)

      if (error) throw error

      submissionFeedback.value = {
        status: 'success',
        message: `Draft ${jobListingForm.jobId} updated successfully! View it under Drafts & Pending.`
      }
    } else {
      let insertRes = await db.from('JOB_LISTING').insert(draftPayload)

      // Collision retry: if duplicate Job_Code key, re-fetch latest sequence and retry once
      if (insertRes.error && (insertRes.error.message?.includes('Job_Code') || insertRes.error.code === '23505')) {
        await refreshJobCode()
        draftPayload.Job_Code = jobListingForm.jobId
        insertRes = await db.from('JOB_LISTING').insert(draftPayload)
      }

      if (insertRes.error) throw insertRes.error

      submissionFeedback.value = {
        status: 'success',
        message: `Draft ${jobListingForm.jobId} saved to database! View it under Drafts & Pending.`
      }
    }

    resetJobForm()
    activeTab.value = 'pending_drafts'
    await fetchBusinessAndJobs()
  } catch (err: any) {
    if (err.message?.includes('JOB_LISTING_Status_check')) {
      submissionFeedback.value = {
        status: 'error',
        message: 'Database constraint error: The Supabase JOB_LISTING table check constraint needs to be updated to allow "Draft". Please run the SQL migration script in your Supabase SQL Editor.'
      }
    } else {
      submissionFeedback.value = {
        status: 'error',
        message: err.message || 'Failed to save draft to database.'
      }
    }
  } finally {
    isJobDraftSaving.value = false
  }
}

// Post / Publish / Update Job Listing
const handlePostJobListing = async () => {
  if (!jobListingForm.eventTitle || !jobListingForm.startDate || !jobListingForm.location) {
    submissionFeedback.value = {
      status: 'error',
      message: 'Please provide Event Title, Start Date, and Location before posting.'
    }
    return
  }

  isSubmittingJob.value = true
  submissionFeedback.value = null

  try {
    // 5-Day Rush Check
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const startDateObj = new Date(jobListingForm.startDate)
    startDateObj.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((startDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const isRush = diffDays <= 5 && diffDays >= 0
    const isLateMod = !!editingJobId.value && isRush

    const isEditingActiveListing = !!editingJobId.value && editingJobStatus.value !== 'Draft'

    const payload: any = {
      Posted_By_BUSINESS_ID: businessId.value,
      Job_Code: jobListingForm.jobId,
      Event_Title: jobListingForm.eventTitle,
      Location: jobListingForm.location,
      Start_Date: jobListingForm.startDate,
      End_Date: jobListingForm.endDate || jobListingForm.startDate,
      Start_Time: jobListingForm.startTime,
      End_Time: jobListingForm.endTime,
      Compensation_Fee: jobListingForm.compensationFee,
      Description: jobListingForm.description,
      Requested_Song_Lineup: jobSongLineupList.value,
      Is_Rush_Booking: isRush,
      Is_Late_Modification: isLateMod
    }

    // Only set Status to Open if this is a new post or publishing a saved draft
    if (!isEditingActiveListing) {
      payload.Status = 'Open'
    }

    if (editingJobId.value) {
      const { error } = await db
        .from('JOB_LISTING')
        .update(payload)
        .eq('Job_ID', editingJobId.value)

      if (error) throw error

      // If updating an active listing, sync changes to tied booking contracts and notify artists
      if (isEditingActiveListing) {
        let syncedContractCount = 0
        const { data: tiedContracts } = await db
          .from('BOOKING_CONTRACT')
          .select(`
            Booking_ID,
            Contract_Code,
            Provider_Artist_ID,
            Status,
            Song_Lineup_JSON,
            ARTIST:Provider_Artist_ID (
              ARTIST_ID,
              ACCOUNT_ID
            )
          `)
          .eq('Job_ID', editingJobId.value)
          .not('Status', 'in', '("Cancelled","Declined")')

        if (tiedContracts && tiedContracts.length > 0) {
          for (const contract of tiedContracts) {
            // Merge song lineup: preserve artist-added songs, update business-requested songs
            let updatedLineup = [...jobSongLineupList.value]
            if (Array.isArray(contract.Song_Lineup_JSON)) {
              const artistSongs = contract.Song_Lineup_JSON.filter((s: any) => s.source === 'artist')
              updatedLineup = [...updatedLineup, ...artistSongs]
            }

            const contractUpdate: any = {
              Start_Date: jobListingForm.startDate,
              End_Date: jobListingForm.endDate || jobListingForm.startDate,
              Start_Time: jobListingForm.startTime,
              End_Time: jobListingForm.endTime,
              Venue_Location: jobListingForm.location,
              Song_Lineup: JSON.stringify(updatedLineup),
              Song_Lineup_JSON: updatedLineup,
              Is_Rush_Booking: isRush,
              Is_Late_Modification: isLateMod
            }

            if (jobListingForm.compensationFee) {
              contractUpdate.Agreed_Fee = jobListingForm.compensationFee
            }

            const { error: syncErr } = await db
              .from('BOOKING_CONTRACT')
              .update(contractUpdate)
              .eq('Booking_ID', contract.Booking_ID)

            if (!syncErr) {
              syncedContractCount++
            }

            // Resolve artist account ID to notify them
            let artistAccId = contract.ARTIST?.ACCOUNT_ID
            if (!artistAccId && contract.Provider_Artist_ID) {
              const { data: aRow } = await db
                .from('ARTIST')
                .select('ACCOUNT_ID')
                .eq('ARTIST_ID', contract.Provider_Artist_ID)
                .maybeSingle()
              artistAccId = aRow?.ACCOUNT_ID
            }

            if (artistAccId) {
              await db.from('NOTIFICATION').insert({
                Account_ID: artistAccId,
                Sender_Account_ID: currentAccountId.value || null,
                Type: 'Booking_Update',
                Content: `Details for "${jobListingForm.eventTitle}" were updated by ${businessName.value}. Please review the updated schedule and venue details.`,
                Action_Link: '/Artistprofile?tab=events'
              })
            }
          }
        }

        submissionFeedback.value = {
          status: 'success',
          message: syncedContractCount > 0
            ? `Job Listing ${jobListingForm.jobId} updated and synced with ${syncedContractCount} contract(s). Scheduled performer/s have been notified.`
            : `Job Listing ${jobListingForm.jobId} updated successfully.`
        }
      } else {
        submissionFeedback.value = {
          status: 'success',
          message: `Job Listing ${jobListingForm.jobId} published successfully! Now accepting artist applications.`
        }
      }
    } else {
      let insertRes = await db.from('JOB_LISTING').insert(payload)

      // Collision retry: if duplicate Job_Code key, re-fetch latest sequence and retry once
      if (insertRes.error && (insertRes.error.message?.includes('Job_Code') || insertRes.error.code === '23505')) {
        await refreshJobCode()
        payload.Job_Code = jobListingForm.jobId
        insertRes = await db.from('JOB_LISTING').insert(payload)
      }

      if (insertRes.error) throw insertRes.error

      submissionFeedback.value = {
        status: 'success',
        message: `Job Listing ${jobListingForm.jobId} posted successfully! Now accepting artist applications.`
      }
    }

    resetJobForm()
    activeTab.value = 'active'
    await fetchBusinessAndJobs()
  } catch (err: any) {
    submissionFeedback.value = {
      status: 'error',
      message: err.message || 'Failed to post job listing.'
    }
  } finally {
    isSubmittingJob.value = false
  }
}

// Edit an Active Listing
const handleEditJobListing = (job: any) => {
  editingJobId.value = job.Job_ID
  editingJobStatus.value = job.Status
  jobListingForm.jobId = job.Job_Code || generateFallbackJobCode()
  jobListingForm.eventTitle = job.Event_Title || ''
  jobListingForm.location = job.Location || businessAddress.value || ''
  jobListingForm.startDate = job.Start_Date || ''
  jobListingForm.endDate = job.End_Date || job.Start_Date || ''
  jobListingForm.startTime = job.Start_Time || '19:00'
  jobListingForm.endTime = job.End_Time || '22:00'
  jobListingForm.compensationFee = job.Compensation_Fee ? Number(job.Compensation_Fee) : null
  jobListingForm.description = job.Description || ''
  jobSongLineupList.value = Array.isArray(job.Requested_Song_Lineup) ? [...job.Requested_Song_Lineup] : []

  isCreatingListing.value = true
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// Resume a Draft
const resumeDraft = (job: any) => {
  editingJobId.value = job.Job_ID
  editingJobStatus.value = 'Draft'
  jobListingForm.jobId = job.Job_Code || generateFallbackJobCode()
  jobListingForm.eventTitle = job.Event_Title || ''
  jobListingForm.location = job.Location || businessAddress.value || ''
  jobListingForm.startDate = job.Start_Date || ''
  jobListingForm.endDate = job.End_Date || ''
  jobListingForm.startTime = job.Start_Time || '19:00'
  jobListingForm.endTime = job.End_Time || '22:00'
  jobListingForm.compensationFee = job.Compensation_Fee ? Number(job.Compensation_Fee) : null
  jobListingForm.description = job.Description || ''
  jobSongLineupList.value = Array.isArray(job.Requested_Song_Lineup) ? [...job.Requested_Song_Lineup] : []

  isCreatingListing.value = true
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// Delete a Draft
const handleDeleteDraft = async (job: any) => {
  if (!confirm(`Are you sure you want to delete draft "${job.Event_Title}"?`)) return

  try {
    const { error } = await db
      .from('JOB_LISTING')
      .delete()
      .eq('Job_ID', job.Job_ID)

    if (error) throw error

    submissionFeedback.value = {
      status: 'success',
      message: `Draft "${job.Event_Title}" was deleted.`
    }
    if (editingJobId.value === job.Job_ID) {
      resetJobForm()
    }
    await fetchBusinessAndJobs()
  } catch (err: any) {
    console.error('Failed to delete draft:', err)
    submissionFeedback.value = {
      status: 'error',
      message: err.message || 'Failed to delete draft.'
    }
  }
}

// -----------------------------------------------------------------------------
// Cancellation & 5-Day Proximity Warning Interception
// -----------------------------------------------------------------------------
const initiateCancelJob = (job: any) => {
  targetListingForCancellation.value = job
  isWarningModalOpen.value = true
}

const handleConfirmCancellation = async (reason: string, isLateParam?: boolean) => {
  if (!targetListingForCancellation.value) return
  const job = targetListingForCancellation.value

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const startDateObj = new Date(job.Start_Date)
  startDateObj.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((startDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const isLate = isLateParam !== undefined ? isLateParam : (diffDays <= 5 && diffDays >= 0)

  try {
    const { error } = await db
      .from('JOB_LISTING')
      .update({
        Status: 'Cancelled',
        Cancellation_Reason: reason,
        Cancelled_By: currentAccountId.value,
        Is_Late_Cancellation: isLate
      })
      .eq('Job_ID', job.Job_ID)

    if (error) throw error

    isWarningModalOpen.value = false
    targetListingForCancellation.value = null
    await fetchBusinessAndJobs()
  } catch (err: any) {
    console.error('Failed to cancel job listing:', err)
  }
}

// -----------------------------------------------------------------------------
// Filtered Views
// -----------------------------------------------------------------------------
const activeListings = computed(() => {
  return jobListings.value.filter(j => j.Status === 'Open' || j.Status === 'Filled' || j.Status === 'Closed')
})

const pendingAndDraftListings = computed(() => {
  return jobListings.value.filter(j => j.Status === 'Pending' || j.Status === 'Draft')
})

const historyListings = computed(() => {
  return jobListings.value.filter(j => j.Status === 'Completed' || j.Status === 'Cancelled')
})

onMounted(() => {
  fetchBusinessAndJobs()
})
</script>

<template>
  <div class="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-10 space-y-8 font-Sora">

    <!-- Sanctions / Proximity Warning Modal -->
    <SanctionWarningModal
      :is-open="isWarningModalOpen"
      action-type="cancel"
      target-type="job"
      :item-title="targetListingForCancellation?.Event_Title || 'Job Listing'"
      :start-date="targetListingForCancellation?.Start_Date || ''"
      @close="isWarningModalOpen = false"
      @confirm="handleConfirmCancellation"
    />

    <!-- Top Action Banner -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A2A2E] pb-6">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Business Job Listings</h1>
        <p class="text-xs sm:text-sm text-gray-400 mt-1">
          Post casting calls, manage open gig opportunities, and review applicant setlists for {{ businessName }}.
        </p>
      </div>

      <button
        type="button"
        @click="toggleCreationForm"
        class="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-xs sm:text-sm transition-all cursor-pointer shadow-md self-start sm:self-auto"
        :class="isCreatingListing ? 'bg-[#1C1C1F] text-gray-300 border border-[#3A3A3C]' : 'bg-[#D0D4F7] text-[#0E0E10] hover:bg-white'"
      >
        <Icon :name="isCreatingListing ? 'ic:round-close' : 'ic:baseline-add'" class="text-lg" />
        <span>{{ isCreatingListing ? 'Close Creation Form' : 'Add Job Listing' }}</span>
      </button>
    </div>

    <!-- Alert / Feedback Notification -->
    <div
      v-if="submissionFeedback"
      class="p-4 rounded-xl border flex items-center justify-between text-xs"
      :class="submissionFeedback.status === 'success' ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' : 'bg-red-950/30 border-red-500/40 text-red-200'"
    >
      <div class="flex items-center gap-2">
        <Icon :name="submissionFeedback.status === 'success' ? 'ic:round-check-circle' : 'ic:baseline-error'" class="text-lg" />
        <span>{{ submissionFeedback.message }}</span>
      </div>
      <button @click="submissionFeedback = null" class="text-gray-400 hover:text-white cursor-pointer">
        <Icon name="ic:round-close" class="text-base" />
      </button>
    </div>

    <!-- ========================================================================= -->
    <!-- FORM 3: BUSINESS JOB LISTING CREATION (Toggled on Demand) -->
    <!-- ========================================================================= -->
    <div
      v-if="isCreatingListing"
      class="bg-[#131315] border border-[#2A2A2E]/80 rounded-2xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-200 shadow-2xl"
    >
      <!-- Top Bar: Draft Status & Buttons -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A2A2E]/50 pb-4">
        <!-- Draft indicator -->
        <div class="flex items-center gap-2">
          <div v-if="editingJobId && editingJobStatus !== 'Draft'" class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
            <span>Editing Active Listing (Syncs to Contracts)</span>
          </div>
          <div v-else-if="editingJobId" class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>Editing Saved Draft</span>
          </div>
          <div v-else class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            <span>New Listing Form</span>
          </div>
        </div>

        <div class="flex items-center gap-2 self-start sm:self-auto">
          <button
            v-if="!editingJobId || editingJobStatus === 'Draft'"
            type="button"
            @click="handleSaveDraft"
            :disabled="isJobDraftSaving || isSubmittingJob"
            class="text-xs font-medium text-gray-300 hover:text-white px-4 py-2 rounded-full border border-[#46464D] hover:bg-white/5 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <Icon v-if="isJobDraftSaving" name="ic:baseline-sync" class="animate-spin text-sm" />
            <span>{{ isJobDraftSaving ? 'Saving Draft...' : 'Save Draft' }}</span>
          </button>
          <button
            type="button"
            @click="resetJobForm"
            class="text-xs font-medium text-gray-300 hover:text-red-300 px-4 py-2 rounded-full border border-[#46464D] hover:border-red-500/50 hover:bg-red-500/10 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="handlePostJobListing"
            :disabled="isSubmittingJob || isJobDraftSaving"
            class="text-xs font-bold text-[#131315] bg-[#D0D4F7] hover:bg-white px-5 py-2 rounded-full transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow"
          >
            <Icon v-if="isSubmittingJob" name="ic:baseline-sync" class="animate-spin text-sm" />
            <span>{{ editingJobId && editingJobStatus !== 'Draft' ? 'Save & Sync Changes' : (editingJobId ? 'Publish Job Listing' : 'Post Job Listing') }}</span>
          </button>
        </div>
      </div>

      <!-- Header Title -->
      <div class="flex flex-col gap-1">
        <h1 class="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-none">
          {{ jobListingForm.jobId }}
        </h1>
        <h2 class="text-xs sm:text-sm text-[#D0D4F7] font-medium tracking-wide uppercase">
          {{ editingJobId && editingJobStatus !== 'Draft' ? 'Editing Active Job Listing (Syncs to Tied Contracts)' : (editingJobId ? 'Editing Saved Draft (Database)' : 'Business Job Listing Creation') }}
        </h2>
      </div>

      <!-- Form Cards Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <!-- Card 1: Posting Business Information -->
        <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 space-y-4">
          <div class="flex items-center gap-3">
            <Icon name="ic:baseline-storefront" class="text-xl text-[#D0D4F7]" />
            <h2 class="text-base sm:text-lg font-semibold text-white">Posting Business Information</h2>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div class="flex flex-col gap-1 p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
              <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">BUSINESS ACCOUNT</span>
              <p class="text-sm font-medium text-white truncate">{{ businessName }}</p>
            </div>
            <div class="flex flex-col gap-1 p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
              <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">BUSINESS ID</span>
              <p class="text-sm font-medium text-gray-300 font-mono truncate">{{ businessId || 'N/A' }}</p>
            </div>
            <div class="flex flex-col gap-1 p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
              <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">JOB CODE</span>
              <p class="text-sm font-medium text-[#D0D4F7] font-mono">{{ jobListingForm.jobId }}</p>
            </div>
            <div class="flex flex-col gap-1 p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
              <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">STATUS</span>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <p class="text-sm font-medium text-emerald-400">Open for Applicants</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 2: Gig Overview & Schedule -->
        <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 space-y-4">
          <div class="flex items-center gap-3">
            <Icon name="ic:baseline-calendar-month" class="text-xl text-[#D0D4F7]" />
            <h2 class="text-base sm:text-lg font-semibold text-white">Event Schedule & Location</h2>
          </div>

          <div class="space-y-3 text-xs">
            <!-- Event Title -->
            <div class="flex flex-col gap-1 p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
              <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">EVENT TITLE</span>
              <input
                type="text"
                v-model="jobListingForm.eventTitle"
                placeholder="e.g., Saturday Acoustic Lounge Night"
                class="bg-transparent border-0 outline-none text-white text-sm font-medium placeholder-gray-500 w-full"
              />
            </div>

            <!-- Venue Location -->
            <div class="flex flex-col gap-1 p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl relative group">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">VENUE LOCATION / ADDRESS</span>
                <button
                  v-if="businessAddress && jobListingForm.location !== businessAddress"
                  type="button"
                  @click="jobListingForm.location = businessAddress"
                  class="text-[10px] font-mono text-[#D0D4F7] hover:underline cursor-pointer flex items-center gap-1 transition-colors"
                  title="Autofill with registered business address"
                >
                  <Icon name="ic:baseline-my-location" class="text-xs" />
                  <span>Use Business Address</span>
                </button>
              </div>
              <input
                type="text"
                v-model="jobListingForm.location"
                placeholder="e.g., Calle Z Bar & Grill, BGC, Taguig"
                class="bg-transparent border-0 outline-none text-white text-sm font-medium placeholder-gray-500 w-full"
              />
            </div>

            <!-- Start Date & End Date -->
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1 p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">START DATE</span>
                <input
                  type="date"
                  v-model="jobListingForm.startDate"
                  class="bg-transparent border-0 outline-none text-white text-sm font-medium cursor-pointer"
                />
              </div>
              <div class="flex flex-col gap-1 p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">END DATE</span>
                <input
                  type="date"
                  v-model="jobListingForm.endDate"
                  class="bg-transparent border-0 outline-none text-white text-sm font-medium cursor-pointer"
                />
              </div>
            </div>

            <!-- 5-Day Rush Booking Warning Banner -->
            <div
              v-if="isFormRushBooking"
              class="p-3.5 rounded-xl bg-amber-950/25 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5 animate-in fade-in"
            >
              <Icon name="ic:baseline-bolt" class="text-lg text-amber-400 shrink-0 mt-0.5" />
              <div class="space-y-0.5">
                <p class="font-bold text-amber-300">
                  5-Day Proximity Notice: Rush Booking (Due in {{ formDaysUntilStart }} {{ formDaysUntilStart === 1 ? 'day' : 'days' }})
                </p>
                <p class="text-[11px] text-amber-200/90 leading-relaxed">
                  This gig is scheduled within 5 days. It will be posted as a <strong>Rush Booking</strong>. Per TONO platform policy, any cancellations or schedule modifications within 5 days are subject to reliability penalty reviews.
                </p>
              </div>
            </div>

            <!-- Start Time & End Time & Fee -->
            <div class="grid grid-cols-3 gap-3">
              <div class="flex flex-col gap-1 p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">START TIME</span>
                  <span v-if="jobListingForm.startTime" class="text-[10px] font-mono text-[#D0D4F7]">
                    {{ formatTime12(jobListingForm.startTime) }}
                  </span>
                </div>
                <input
                  type="time"
                  v-model="jobListingForm.startTime"
                  class="bg-transparent border-0 outline-none text-white text-sm font-medium cursor-pointer"
                />
              </div>
              <div class="flex flex-col gap-1 p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">END TIME</span>
                  <span v-if="jobListingForm.endTime" class="text-[10px] font-mono text-[#D0D4F7]">
                    {{ formatTime12(jobListingForm.endTime) }}
                  </span>
                </div>
                <input
                  type="time"
                  v-model="jobListingForm.endTime"
                  class="bg-transparent border-0 outline-none text-white text-sm font-medium cursor-pointer"
                />
              </div>
              <div class="flex flex-col gap-1 p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">BUDGET / FEE (₱)</span>
                <input
                  type="number"
                  v-model="jobListingForm.compensationFee"
                  placeholder="5000"
                  class="bg-transparent border-0 outline-none text-white text-sm font-medium placeholder-gray-500 w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Description & Requirements -->
      <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 space-y-3">
        <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">DESCRIPTION & PERFORMANCE REQUIREMENTS</span>
        <textarea
          v-model="jobListingForm.description"
          rows="3"
          placeholder="Describe musical style, audience demographic, required gear, set lengths..."
          class="w-full bg-[#141416] border border-[#46464D]/60 rounded-xl p-3.5 text-xs text-white placeholder-gray-500 outline-none resize-none leading-relaxed"
        ></textarea>
      </div>

      <!-- Requested Song Lineup -->
      <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon name="ic:outline-queue-music" class="text-xl text-[#D0D4F7]" />
            <h2 class="text-base font-semibold text-white">Requested Song Lineup / Setlist</h2>
          </div>
          <span class="text-xs text-gray-400 font-mono">
            {{ jobSongLineupList.length }} {{ jobSongLineupList.length === 1 ? 'song' : 'songs' }}
          </span>
        </div>

        <div class="space-y-2.5">
          <div
            v-for="(song, idx) in jobSongLineupList"
            :key="song.id"
            class="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#141416] border border-[#3A3A3C] rounded-xl text-xs"
          >
            <div class="flex items-center gap-2.5 flex-1">
              <span class="w-1.5 h-4 rounded-full bg-[#D0D4F7]"></span>
              <input
                type="text"
                v-model="song.title"
                placeholder="Enter song title / artist"
                class="bg-transparent border-0 outline-none text-white text-xs font-medium placeholder-gray-500 w-full"
              />
            </div>
            <div class="flex items-center gap-2">
              <input
                type="text"
                v-model="song.duration"
                placeholder="00:00"
                class="bg-transparent border-0 outline-none text-gray-400 text-xs font-mono text-right w-14"
              />
              <button
                type="button"
                @click="removeSongFromJob(idx)"
                class="text-gray-400 hover:text-red-400 transition-colors p-1 cursor-pointer"
              >
                <Icon name="ic:round-close" class="text-base" />
              </button>
            </div>
          </div>

          <button
            type="button"
            @click="addSongToJob"
            class="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-[#46464D] hover:border-[#D0D4F7] text-xs text-gray-300 hover:text-white transition-all cursor-pointer"
          >
            <Icon name="ic:baseline-plus" class="text-base" />
            <span>Add Requested Song to Setlist</span>
          </button>
        </div>
      </div>

      <!-- Bottom Form Actions -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-5 border-t border-[#2A2A2E]/50">
        <p class="text-xs text-gray-400">
          {{ editingJobId && editingJobStatus !== 'Draft' ? 'Changes saved here will automatically sync to active contracts and notify the scheduled performer.' : 'Saved drafts are stored in your TONO database and can be resumed anytime under Drafts & Pending.' }}
        </p>
        <div class="flex items-center gap-2 self-end sm:self-auto">
          <button
            v-if="!editingJobId || editingJobStatus === 'Draft'"
            type="button"
            @click="handleSaveDraft"
            :disabled="isJobDraftSaving || isSubmittingJob"
            class="text-xs font-medium text-gray-300 hover:text-white px-4 py-2 rounded-full border border-[#46464D] hover:bg-white/5 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <Icon v-if="isJobDraftSaving" name="ic:baseline-sync" class="animate-spin text-sm" />
            <span>{{ isJobDraftSaving ? 'Saving Draft...' : 'Save Draft' }}</span>
          </button>
          <button
            type="button"
            @click="resetJobForm"
            class="text-xs font-medium text-gray-300 hover:text-red-300 px-4 py-2 rounded-full border border-[#46464D] hover:border-red-500/50 hover:bg-red-500/10 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="handlePostJobListing"
            :disabled="isSubmittingJob || isJobDraftSaving"
            class="text-xs font-bold text-[#131315] bg-[#D0D4F7] hover:bg-white px-5 py-2 rounded-full transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow"
          >
            <Icon v-if="isSubmittingJob" name="ic:baseline-sync" class="animate-spin text-sm" />
            <span>{{ editingJobId && editingJobStatus !== 'Draft' ? 'Save & Sync Changes' : (editingJobId ? 'Publish Job Listing' : 'Post Job Listing') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- JOB LISTINGS DISPLAY: TABS & CARDS -->
    <!-- ========================================================================= -->
    <div class="space-y-6">

      <!-- Navigation Filter Pills -->
      <div class="flex items-center gap-2 border-b border-[#2A2A2E] pb-3 text-[10px] sm:text-sm">
        <button
          type="button"
          @click="activeTab = 'active'"
          class="px-2 py-2 sm:px-4 sm:py-2 rounded-full font-medium transition-all cursor-pointer flex items-center gap-2"
          :class="activeTab === 'active' ? 'bg-[#D0D4F7] text-[#0E0E10] font-bold shadow' : 'bg-[#1C1C1F] text-gray-300 border border-[#3A3A3C] hover:bg-white/5'"
        >
          <span>Active Gigs</span>
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-mono" :class="activeTab === 'active' ? 'bg-[#0E0E10]/20 text-[#0E0E10]' : 'bg-white/10 text-gray-300'">
            {{ activeListings.length }}
          </span>
        </button>

        <button
          type="button"
          @click="activeTab = 'pending_drafts'"
          class="px-2 py-2 sm:px-4 sm:py-2 rounded-full font-medium transition-all cursor-pointer flex items-center gap-2"
          :class="activeTab === 'pending_drafts' ? 'bg-[#D0D4F7] text-[#0E0E10] font-bold shadow' : 'bg-[#1C1C1F] text-gray-300 border border-[#3A3A3C] hover:bg-white/5'"
        >
          <span>Drafts & Pending</span>
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-mono" :class="activeTab === 'pending_drafts' ? 'bg-[#0E0E10]/20 text-[#0E0E10]' : 'bg-white/10 text-gray-300'">
            {{ pendingAndDraftListings.length }}
          </span>
        </button>

        <button
          type="button"
          @click="activeTab = 'history'"
          class="px-2 py-2 sm:px-4 sm:py-2 rounded-full font-medium transition-all cursor-pointer flex items-center gap-2"
          :class="activeTab === 'history' ? 'bg-[#D0D4F7] text-[#0E0E10] font-bold shadow' : 'bg-[#1C1C1F] text-gray-300 border border-[#3A3A3C] hover:bg-white/5'"
        >
          <span>History & Cancelled</span>
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-mono" :class="activeTab === 'history' ? 'bg-[#0E0E10]/20 text-[#0E0E10]' : 'bg-white/10 text-gray-300'">
            {{ historyListings.length }}
          </span>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
        <div v-for="i in 4" :key="i" class="h-44 bg-[#1C1C1F] rounded-2xl border border-[#2A2A2E]"></div>
      </div>

      <!-- TAB 1: ACTIVE GIGS -->
      <div v-else-if="activeTab === 'active'">
        <div v-if="activeListings.length === 0" class="text-center py-16 bg-[#131315]/50 border border-dashed border-[#2A2A2E] rounded-2xl space-y-3">
          <Icon name="ic:outline-work-outline" class="text-4xl text-gray-500 mx-auto" />
          <h3 class="text-base font-semibold text-white">No Active Job Listings</h3>
          <p class="text-xs text-gray-400 max-w-sm mx-auto">
            You currently have no open gigs. Click "Add Job Listing" above to publish a casting call to artists.
          </p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div
            v-for="job in activeListings"
            :key="job.Job_ID"
            class="bg-[#1C1C1F]/80 border border-[#2A2A2E] hover:border-[#46464D] rounded-2xl p-5 sm:p-6 space-y-4 transition-all shadow-lg group"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <span class="text-[10px] font-mono text-[#D0D4F7] uppercase tracking-wider">{{ job.Job_Code || 'JOB-LISTING' }}</span>
                <h3 class="text-lg font-bold text-white group-hover:text-[#D0D4F7] transition-colors mt-0.5">{{ job.Event_Title }}</h3>
              </div>
              <div class="flex items-center gap-1.5">
                <span
                  v-if="job.Is_Rush_Booking"
                  class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1"
                >
                  <Icon name="ic:baseline-bolt" class="text-xs" />
                  <span>Rush</span>
                </span>
                <span
                  class="px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold"
                  :class="{
                    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': job.Status === 'Open',
                    'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20': job.Status === 'Filled',
                    'bg-purple-500/10 text-purple-300 border border-purple-500/20': job.Status === 'Closed'
                  }"
                >
                  {{ job.Status === 'Closed' ? 'Closed (Contract Active)' : job.Status }}
                </span>
              </div>
            </div>

            <!-- Schedule & Location -->
            <div class="space-y-1.5 text-xs text-gray-300">
              <div class="flex items-center gap-2">
                <Icon name="ic:baseline-calendar-today" class="text-[#D0D4F7] text-sm shrink-0" />
                <span>
                  {{ job.Start_Date }}
                  <span v-if="job.End_Date && job.End_Date !== job.Start_Date"> to {{ job.End_Date }}</span>
                  <span v-if="job.Start_Time"> • {{ formatTimeRange12(job.Start_Time, job.End_Time) }}</span>
                </span>
              </div>
              <div class="flex items-center gap-2">
                <Icon name="ic:baseline-location-on" class="text-[#D0D4F7] text-sm shrink-0" />
                <span class="truncate">{{ job.Location }}</span>
              </div>
              <div v-if="job.Compensation_Fee" class="flex items-center gap-2">
                <Icon name="ic:baseline-payments" class="text-[#D0D4F7] text-sm shrink-0" />
                <span class="font-mono text-emerald-400 font-semibold">₱{{ Number(job.Compensation_Fee).toLocaleString() }}</span>
              </div>
            </div>

            <!-- Applicants Summary & Actions -->
            <div class="flex items-center justify-between pt-3 border-t border-[#2A2A2E] text-xs">
              <NuxtLink
                :to="`/businessjobapp?jobId=${job.Job_ID}`"
                class="flex items-center gap-1.5 text-[#D0D4F7] hover:text-white font-medium transition-colors"
              >
                <Icon name="ic:baseline-people" class="text-base" />
                <span>{{ job.APPLICATION?.[0]?.count || 0 }} Applicants</span>
              </NuxtLink>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="handleEditJobListing(job)"
                  class="px-3.5 py-1.5 rounded-full text-xs font-medium border border-[#46464D] text-gray-300 hover:text-white hover:border-[#D0D4F7] hover:bg-white/5 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Icon name="ic:baseline-edit" class="text-xs text-[#D0D4F7]" />
                  <span>Edit Listing</span>
                </button>
                <button
                  type="button"
                  @click="initiateCancelJob(job)"
                  class="px-3.5 py-1.5 rounded-full text-xs border border-red-500/30 text-red-300 hover:bg-red-500/10 hover:border-red-500/60 transition-all cursor-pointer"
                >
                  Cancel Gig
                </button>
                <NuxtLink
                  :to="`/businessjobapp?jobId=${job.Job_ID}`"
                  class="px-4 py-1.5 rounded-full text-xs font-bold bg-[#D0D4F7] hover:bg-white text-[#131315] transition-all cursor-pointer"
                >
                  View Applicants
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: DRAFTS & PENDING (Strictly separated per rule) -->
      <div v-else-if="activeTab === 'pending_drafts'">
        <div v-if="pendingAndDraftListings.length === 0" class="text-center py-16 bg-[#131315]/50 border border-dashed border-[#2A2A2E] rounded-2xl space-y-3">
          <Icon name="ic:outline-pending-actions" class="text-4xl text-gray-500 mx-auto" />
          <h3 class="text-base font-semibold text-white">No Pending or Draft Listings</h3>
          <p class="text-xs text-gray-400 max-w-sm mx-auto">
            Any unconfirmed or pending listings and saved drafts will appear here away from the active gig roster.
          </p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div
            v-for="job in pendingAndDraftListings"
            :key="job.Job_ID"
            class="bg-[#1C1C1F]/80 border border-[#2A2A2E] rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg hover:border-[#46464D] transition-all"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <span
                  class="text-[10px] font-mono uppercase tracking-wider"
                  :class="job.Status === 'Draft' ? 'text-amber-400' : 'text-indigo-400'"
                >
                  {{ job.Job_Code || 'JOB-LISTING' }}
                </span>
                <h3 class="text-lg font-bold text-white mt-0.5">{{ job.Event_Title }}</h3>
              </div>
              <span
                class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold"
                :class="job.Status === 'Draft' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'"
              >
                {{ job.Status }}
              </span>
            </div>

            <!-- Schedule & Location Details -->
            <div class="space-y-1.5 text-xs text-gray-300">
              <div class="flex items-center gap-2">
                <Icon name="ic:baseline-calendar-today" class="text-[#D0D4F7] text-sm shrink-0" />
                <span>
                  {{ job.Start_Date || 'Date: Not set' }}
                  <span v-if="job.End_Date && job.End_Date !== job.Start_Date"> to {{ job.End_Date }}</span>
                  <span v-if="job.Start_Time"> • {{ formatTimeRange12(job.Start_Time, job.End_Time) }}</span>
                </span>
              </div>
              <div v-if="job.Location" class="flex items-center gap-2">
                <Icon name="ic:baseline-location-on" class="text-[#D0D4F7] text-sm shrink-0" />
                <span class="truncate">{{ job.Location }}</span>
              </div>
              <div v-if="job.Compensation_Fee" class="flex items-center gap-2">
                <Icon name="ic:baseline-payments" class="text-[#D0D4F7] text-sm shrink-0" />
                <span class="font-mono text-emerald-400 font-semibold">₱{{ Number(job.Compensation_Fee).toLocaleString() }}</span>
              </div>
            </div>

            <!-- Draft Specific Actions -->
            <div v-if="job.Status === 'Draft'" class="flex items-center justify-between pt-3 border-t border-[#2A2A2E] text-xs">
              <span class="text-[11px] text-amber-300/80 italic">Saved draft in database</span>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="handleDeleteDraft(job)"
                  class="px-3.5 py-1.5 rounded-full text-xs text-red-300 border border-red-500/30 hover:bg-red-500/10 hover:border-red-500/60 transition-all cursor-pointer"
                >
                  Delete Draft
                </button>
                <button
                  type="button"
                  @click="resumeDraft(job)"
                  class="px-4 py-1.5 rounded-full text-xs font-bold bg-[#D0D4F7] hover:bg-white text-[#131315] transition-all cursor-pointer"
                >
                  Resume Editing
                </button>
              </div>
            </div>

            <!-- Pending specific note -->
            <div v-else class="pt-2 border-t border-[#2A2A2E]">
              <p class="text-xs text-gray-500 italic">This job listing is pending contract completion and is not shown on active boards.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: HISTORY & CANCELLED -->
      <div v-else-if="activeTab === 'history'">
        <div v-if="historyListings.length === 0" class="text-center py-16 bg-[#131315]/50 border border-dashed border-[#2A2A2E] rounded-2xl space-y-3">
          <Icon name="ic:outline-history" class="text-4xl text-gray-500 mx-auto" />
          <h3 class="text-base font-semibold text-white">No Past or Cancelled Listings</h3>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div
            v-for="job in historyListings"
            :key="job.Job_ID"
            class="bg-[#1C1C1F]/40 border border-[#2A2A2E]/50 rounded-2xl p-5 sm:p-6 space-y-3 opacity-80"
          >
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-mono text-gray-400 uppercase">{{ job.Job_Code }}</span>
              <span
                class="px-2.5 py-0.5 rounded-full text-[10px] font-mono"
                :class="job.Status === 'Completed' ? 'bg-blue-500/10 text-blue-300' : 'bg-red-500/10 text-red-300'"
              >
                {{ job.Status }}
              </span>
            </div>
            <h3 class="text-base font-bold text-white">{{ job.Event_Title }}</h3>
            <p class="text-xs text-gray-400">📅 {{ job.Start_Date }} • 📍 {{ job.Location }}</p>
          </div>
        </div>
      </div>

    </div>

  </div>
</template>