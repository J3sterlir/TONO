<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  isOpen: boolean
  job: any | null
  currentArtistId: string
  hasAlreadyApplied?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'applied'): void
}>()

const supabase = useSupabaseClient()
const db = supabase as any
const user = useSupabaseUser()

const isApplying = ref(false)
const isWithdrawing = ref(false)
const applySuccess = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

// Application Proposal Fields
const pitchMessage = ref('')
const proposedFee = ref<number | null>(null)
const existingApp = ref<any>(null)
const isEditing = ref(false)

// Fetch existing application whenever modal opens
watch(
  () => [props.isOpen, props.job?.Job_ID, props.currentArtistId],
  async ([open, jobId, artistId]) => {
    if (open && jobId && artistId) {
      applySuccess.value = false
      successMessage.value = ''
      errorMessage.value = ''
      isEditing.value = false

      try {
        const { data } = await db
          .from('APPLICATION')
          .select('*')
          .eq('Job_ID', jobId)
          .eq('Artist_ID', artistId)
          .maybeSingle()

        if (data) {
          existingApp.value = data
          pitchMessage.value = data.Pitch_Message || ''
          proposedFee.value = data.Proposed_Fee ?? props.job?.Compensation_Fee ?? null
        } else {
          existingApp.value = null
          pitchMessage.value = ''
          proposedFee.value = props.job?.Compensation_Fee ?? null
        }
      } catch (e) {
        console.error('Error checking existing application:', e)
      }
    }
  },
  { immediate: true }
)

const handleApply = async () => {
  if (!props.job || !props.currentArtistId) {
    errorMessage.value = 'You must be logged in as an artist to apply.'
    return
  }

  isApplying.value = true
  errorMessage.value = ''
  applySuccess.value = false

  try {
    // 1. Insert into APPLICATION table
    const { error } = await db
      .from('APPLICATION')
      .insert({
        Job_ID: props.job.Job_ID,
        Artist_ID: props.currentArtistId,
        Status: 'Pending',
        Pitch_Message: pitchMessage.value.trim() || null,
        Proposed_Fee: proposedFee.value || props.job.Compensation_Fee || null
      })

    if (error) {
      if (error.code === '23505') {
        throw new Error('You have already applied for this job listing.')
      }
      throw error
    }

    // 2. Notify business owner
    const businessAccountId = props.job.BUSINESS_PROFILE?.ACCOUNT_ID
    if (businessAccountId) {
      try {
        await db.rpc('send_notification', {
          p_account_id: businessAccountId,
          p_type: 'contract_submission',
          p_title: `New Application for '${props.job.Event_Title}'`,
          p_content: `An artist has applied to your open gig "**${props.job.Event_Title}**"!`,
          p_action_link: `/BusinessJobApp?jobId=${props.job.Job_ID}`,
          p_svg_type: 'contract_submission',
          p_avatar_text: 'AR',
          p_action_primary: 'Review Application',
          p_action_secondary: null,
          p_entity_id: props.job.Job_ID,
          p_entity_type: 'APPLICATION',
          p_sender_account_id: user.value?.id || null
        })
      } catch (notifErr) {
        await db.from('NOTIFICATION').insert({
          Account_ID: businessAccountId,
          Sender_Account_ID: user.value?.id || null,
          Type: 'contract_submission',
          Title: `New Application for '${props.job.Event_Title}'`,
          Content: `An artist has applied to your open gig "**${props.job.Event_Title}**"!`,
          Action_Link: `/BusinessJobApp?jobId=${props.job.Job_ID}`,
          Svg_Type: 'contract_submission',
          Avatar_Text: 'AR',
          Action_Primary: 'Review Application'
        })
      }
    }

    applySuccess.value = true
    successMessage.value = 'Application submitted successfully! The business host has been notified to review your proposal.'
    
    // Refresh local existingApp
    existingApp.value = {
      Status: 'Pending',
      Pitch_Message: pitchMessage.value.trim() || null,
      Proposed_Fee: proposedFee.value || props.job.Compensation_Fee || null
    }

    emit('applied')
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to submit application.'
  } finally {
    isApplying.value = false
  }
}

const handleUpdateApplication = async () => {
  if (!existingApp.value || !props.job || !props.currentArtistId) return
  isApplying.value = true
  errorMessage.value = ''
  applySuccess.value = false

  try {
    const { error } = await db
      .from('APPLICATION')
      .update({
        Pitch_Message: pitchMessage.value.trim() || null,
        Proposed_Fee: proposedFee.value || props.job.Compensation_Fee || null
      })
      .eq('Job_ID', props.job.Job_ID)
      .eq('Artist_ID', props.currentArtistId)

    if (error) throw error

    applySuccess.value = true
    successMessage.value = 'Your application proposal has been updated.'
    isEditing.value = false

    existingApp.value = {
      ...existingApp.value,
      Pitch_Message: pitchMessage.value.trim() || null,
      Proposed_Fee: proposedFee.value || props.job.Compensation_Fee || null
    }

    emit('applied')
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to update application.'
  } finally {
    isApplying.value = false
  }
}

const handleWithdrawApplication = async () => {
  if (!existingApp.value || !props.job || !props.currentArtistId) return
  if (!confirm(`Are you sure you want to withdraw your application for "${props.job.Event_Title}"?`)) return

  isWithdrawing.value = true
  errorMessage.value = ''

  try {
    const { error } = await db
      .from('APPLICATION')
      .delete()
      .eq('Job_ID', props.job.Job_ID)
      .eq('Artist_ID', props.currentArtistId)

    if (error) throw error

    existingApp.value = null
    pitchMessage.value = ''
    emit('applied')
    emit('close')
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to withdraw application.'
  } finally {
    isWithdrawing.value = false
  }
}

// Disable background scroll while modal is open
useModalScrollLock(() => props.isOpen)
</script>

<template>
  <div v-if="isOpen && job" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" @click="emit('close')"></div>

    <!-- Modal Content: Form 3 JOB LISTING APPLICATION & PROPOSAL -->
    <div
      class="relative w-full max-w-4xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col bg-[#131315] border border-[#2A2A2E]/80 rounded-2xl sm:rounded-3xl shadow-2xl text-white font-Sora z-10 overflow-hidden animate-in zoom-in-95 duration-200"
    >
      <!-- Top Action Bar (Pinned Header) -->
      <div class="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-7 py-4 sm:py-5 border-b border-[#2A2A2E]/80 bg-[#131315]/95 backdrop-blur-md">
        <div class="min-w-0">
          <span class="text-[10px] font-mono text-[#D0D4F7] uppercase tracking-wider block">JOB LISTING APPLICATION</span>
          <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight mt-0.5 truncate">
            {{ job.Job_Code || 'JB-LISTING' }}
          </h1>
        </div>

        <div class="flex items-center gap-2 sm:gap-3 shrink-0">
          <!-- If already applied -->
          <template v-if="existingApp || hasAlreadyApplied">
            <button
              v-if="!isEditing && existingApp?.Status === 'Pending'"
              type="button"
              @click="isEditing = true"
              class="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-semibold border border-[#D0D4F7] text-[#D0D4F7] hover:bg-[#D0D4F7]/10 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Icon name="ic:outline-edit" class="text-sm" />
              <span>Edit Proposal</span>
            </button>
            <span
              v-else-if="!isEditing"
              class="px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5"
            >
              <Icon name="ic:round-check" class="text-base" />
              <span>{{ existingApp?.Status || 'Applied' }}</span>
            </span>
          </template>

          <button
            type="button"
            @click="emit('close')"
            class="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-medium border border-[#46464D] text-gray-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      <!-- Modal Body (Internal Smooth Scrolling with overscroll-contain) -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 overscroll-contain">
        <!-- Feedback / Error Notice -->
        <div v-if="errorMessage" class="p-3.5 rounded-xl bg-red-950/30 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
          <Icon name="ic:baseline-error" class="text-base shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>

      <div v-if="applySuccess" class="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
        <Icon name="ic:round-check-circle" class="text-base shrink-0" />
        <span>{{ successMessage }}</span>
      </div>

      <!-- Grid Cards (Matches Form 3) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <!-- Card 1: Business Information -->
        <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 space-y-4">
          <div class="flex items-center gap-3">
            <Icon name="ic:baseline-storefront" class="text-xl text-[#D0D4F7]" />
            <h2 class="text-base font-semibold text-white">Posting Business Information</h2>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div class="flex flex-col gap-1 p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
              <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">BUSINESS ACCOUNT</span>
              <p class="text-sm font-medium text-white truncate">{{ job.BUSINESS_PROFILE?.Business_Name || 'Venue Host' }}</p>
            </div>
            <div class="flex flex-col gap-1 p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
              <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">BUSINESS ID</span>
              <p class="text-sm font-medium text-gray-300 font-mono truncate">{{ job.Posted_By_BUSINESS_ID || 'N/A' }}</p>
            </div>
            <div class="flex flex-col gap-1 p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
              <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">JOB CODE</span>
              <p class="text-sm font-medium text-[#D0D4F7] font-mono">{{ job.Job_Code || 'JB' }}</p>
            </div>
            <div class="flex flex-col gap-1 p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
              <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">STATUS</span>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <p class="text-sm font-medium text-emerald-400">Open for Applications</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 2: Schedule & Location -->
        <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 space-y-4">
          <div class="flex items-center gap-3">
            <Icon name="ic:baseline-calendar-today" class="text-xl text-[#D0D4F7]" />
            <h2 class="text-base font-semibold text-white">Event Schedule &amp; Location</h2>
          </div>

          <div class="space-y-3 text-xs">
            <div class="flex flex-col gap-1 p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
              <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">EVENT TITLE</span>
              <p class="text-sm font-medium text-white">{{ job.Event_Title }}</p>
            </div>

            <div class="flex flex-col gap-1 p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
              <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">VENUE LOCATION</span>
              <p class="text-sm font-medium text-white">{{ job.Location }}</p>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1 p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">START DATE</span>
                <p class="text-sm font-medium text-white font-mono">{{ job.Start_Date || job.Date }}</p>
              </div>
              <div class="flex flex-col gap-1 p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">END DATE</span>
                <p class="text-sm font-medium text-white font-mono">{{ job.End_Date || job.Start_Date || job.Date }}</p>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <div class="flex flex-col gap-1 p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">START TIME</span>
                <p class="text-sm font-medium text-white font-mono">{{ formatTime12(job.Start_Time || '19:00') }}</p>
              </div>
              <div class="flex flex-col gap-1 p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">END TIME</span>
                <p class="text-sm font-medium text-white font-mono">{{ formatTime12(job.End_Time || '22:00') }}</p>
              </div>
              <div class="flex flex-col gap-1 p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">BUDGET / FEE</span>
                <p class="text-sm font-bold text-emerald-400 font-mono">₱{{ Number(job.Compensation_Fee || 0).toLocaleString() }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Description & Requirements -->
      <div v-if="job.Description" class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 space-y-2">
        <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">PERFORMANCE DESCRIPTION &amp; REQUIREMENTS</span>
        <p class="text-xs text-gray-300 leading-relaxed">{{ job.Description }}</p>
      </div>

      <!-- Requested Song Lineup -->
      <div v-if="job.Requested_Song_Lineup?.length" class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon name="ic:outline-queue-music" class="text-xl text-[#D0D4F7]" />
            <h2 class="text-base font-semibold text-white">Requested Song Lineup</h2>
          </div>
          <span class="text-xs text-gray-400 font-mono">
            {{ job.Requested_Song_Lineup.length }} requested
          </span>
        </div>

        <div class="space-y-2 text-xs">
          <div
            v-for="song in job.Requested_Song_Lineup"
            :key="song.id"
            class="flex items-center justify-between p-3 bg-[#141416] border border-[#3A3A3C] rounded-xl"
          >
            <div class="flex items-center gap-2.5">
              <span class="w-1.5 h-4 rounded-full bg-amber-400"></span>
              <span class="font-medium text-white">{{ song.title }}</span>
            </div>
            <span class="text-xs font-mono text-gray-400">{{ song.duration || '03:30' }}</span>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- APPLICATION / PROPOSAL SECTION -->
      <!-- ================================================================= -->
      <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 space-y-5">
        <div class="flex items-center justify-between border-b border-[#2A2A2E] pb-3">
          <div class="flex items-center gap-2">
            <Icon name="ic:baseline-assignment" class="text-xl text-[#D0D4F7]" />
            <h2 class="text-base font-semibold text-white">Your Audition Proposal &amp; Application</h2>
          </div>
          <span
            v-if="existingApp"
            class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold"
            :class="{
              'bg-amber-500/10 text-amber-300 border border-amber-500/20': existingApp.Status === 'Pending',
              'bg-blue-500/10 text-blue-300 border border-blue-500/20': existingApp.Status === 'Shortlisted',
              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': existingApp.Status === 'Accepted',
              'bg-red-500/10 text-red-300 border border-red-500/20': existingApp.Status === 'Declined'
            }"
          >
            Status: {{ existingApp.Status }}
          </span>
        </div>

        <!-- Mode A: Already Applied & Not in Editing mode -->
        <div v-if="existingApp && !isEditing" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div class="p-3.5 bg-[#141416] border border-[#2A2A2E] rounded-xl space-y-1">
              <span class="text-[10px] font-mono text-gray-400 uppercase">YOUR PROPOSED FEE</span>
              <p class="text-sm font-bold text-emerald-400 font-mono">
                ₱{{ Number(existingApp.Proposed_Fee || job.Compensation_Fee || 0).toLocaleString() }}
              </p>
            </div>
            <div class="p-3.5 bg-[#141416] border border-[#2A2A2E] rounded-xl space-y-1">
              <span class="text-[10px] font-mono text-gray-400 uppercase">SUBMISSION DATE</span>
              <p class="text-sm font-medium text-white">
                {{ existingApp.Applied_at ? new Date(existingApp.Applied_at).toLocaleDateString() : 'Recently Submitted' }}
              </p>
            </div>
          </div>

          <div v-if="existingApp.Pitch_Message" class="p-3.5 bg-[#141416] border border-[#2A2A2E] rounded-xl space-y-1 text-xs">
            <span class="text-[10px] font-mono text-[#D0D4F7] uppercase tracking-wider">YOUR PITCH &amp; NOTES</span>
            <p class="text-xs text-gray-200 leading-relaxed italic">
              "{{ existingApp.Pitch_Message }}"
            </p>
          </div>

          <div class="flex items-center justify-between pt-2 text-xs">
            <template v-if="existingApp.Status === 'Pending'">
              <button
                type="button"
                @click="handleWithdrawApplication"
                :disabled="isWithdrawing"
                class="px-4 py-2 rounded-full border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Icon v-if="isWithdrawing" name="ic:baseline-sync" class="animate-spin text-sm" />
                <span>Withdraw Application</span>
              </button>
              <button
                type="button"
                @click="isEditing = true"
                class="px-5 py-2 rounded-full font-bold bg-[#D0D4F7] hover:bg-white text-[#131315] transition-all cursor-pointer shadow flex items-center gap-1.5"
              >
                <Icon name="ic:outline-edit" class="text-sm" />
                <span>Edit Proposal</span>
              </button>
            </template>

            <template v-else-if="existingApp.Status === 'Accepted'">
              <div class="flex items-center gap-2 text-emerald-400 font-medium">
                <Icon name="ic:baseline-check-circle" class="text-base" />
                <span>Application Accepted! Host has sent a contract offer.</span>
              </div>
              <NuxtLink
                to="/ArtistNavEvents"
                @click="$emit('close')"
                class="px-4 py-2 rounded-full font-bold bg-emerald-400 hover:bg-emerald-300 text-black transition-all cursor-pointer shadow flex items-center gap-1.5"
              >
                <Icon name="ic:baseline-assignment" class="text-sm" />
                <span>Review Contract</span>
              </NuxtLink>
            </template>

            <span v-else class="text-[11px] text-gray-400">Application has been processed by host.</span>
          </div>
        </div>

        <!-- Mode B: New Application Form OR Editing Existing Proposal -->
        <div v-else class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-mono uppercase tracking-wider text-gray-300">
                Proposed Performance Fee (₱)
              </label>
              <input
                type="number"
                v-model="proposedFee"
                :placeholder="job.Compensation_Fee ? String(job.Compensation_Fee) : '5000'"
                class="w-full bg-[#141416] border border-[#46464D]/60 focus:border-[#D0D4F7] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none font-mono"
              />
              <span class="text-[10px] text-gray-400">Host listed budget: ₱{{ Number(job.Compensation_Fee || 0).toLocaleString() }}</span>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-mono uppercase tracking-wider text-gray-300">
              Pitch Message / Setlist Readiness (Optional)
            </label>
            <div class="flex flex-col justify-end">
              <p class="text-xs text-gray-400 leading-relaxed">
                Provide an introductory note or setlist pitch to help the venue manager review your audition.
              </p>
            </div>
            <textarea
              v-model="pitchMessage"
              rows="3"
              placeholder="Highlight your genre fit, instruments, experience, or specific song preparation for this gig..."
              class="w-full bg-[#141416] border border-[#46464D]/60 focus:border-[#D0D4F7] rounded-xl p-3.5 text-xs text-white placeholder-gray-500 outline-none resize-none leading-relaxed"
            ></textarea>
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t border-[#2A2A2E]">
            <button
              v-if="isEditing"
              type="button"
              @click="isEditing = false"
              class="px-5 py-2.5 rounded-full text-xs font-medium border border-[#46464D] text-gray-300 hover:text-white transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              v-if="existingApp"
              type="button"
              @click="handleUpdateApplication"
              :disabled="isApplying"
              class="px-6 py-2.5 rounded-full text-xs font-bold bg-[#D0D4F7] hover:bg-white text-[#131315] transition-all cursor-pointer shadow disabled:opacity-50 flex items-center gap-1.5"
            >
              <Icon v-if="isApplying" name="ic:baseline-sync" class="animate-spin text-sm" />
              <span>Save Updated Proposal</span>
            </button>

            <button
              v-else
              type="button"
              @click="handleApply"
              :disabled="isApplying"
              class="px-6 py-2.5 rounded-full text-xs font-bold bg-[#D0D4F7] hover:bg-white text-[#131315] transition-all cursor-pointer shadow disabled:opacity-50 flex items-center gap-1.5"
            >
              <Icon v-if="isApplying" name="ic:baseline-sync" class="animate-spin text-sm" />
              <span>Submit Audition Application</span>
            </button>
          </div>
        </div>
      </div>

      </div><!-- End Modal Body -->
    </div><!-- End Modal Card -->
  </div>
</template>
