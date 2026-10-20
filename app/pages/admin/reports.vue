<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

definePageMeta({
  layout: 'admin',
  middleware: 'admin'
})

const { signOutAdmin, fetchCurrentAdmin } = useAdminAuth()
const supabase = useSupabaseClient()
const db = supabase as any

interface ModerationReport {
  id: string
  reporterId?: string
  reporterUsername?: string
  reporterEmail?: string
  reporterAvatar?: string
  targetAccountId?: string
  targetUsername?: string
  targetEmail?: string
  targetAvatar?: string
  targetStrikeCount: number
  targetPenaltyDeduction: number
  targetIsSuspended: boolean
  targetSuspendedUntil?: string | null
  targetSuspensionReason?: string | null
  targetIsBanned: boolean
  targetBanReason?: string | null
  targetBanContested: boolean
  targetContestMessage?: string | null
  targetContestedAt?: string | null
  targetArtistId?: string | null
  targetBusinessId?: string | null
  targetJobId?: string | null
  targetMessageId?: string | null
  targetPostId?: string | null
  targetCommentId?: string | null
  targetContractId?: string | null
  category: string
  severity: string
  description: string
  evidenceSnapshot: any
  isResolved: boolean
  actionTaken?: string | null
  adminNotes?: string | null
  resolvedByAdminId?: string | null
  resolvedAt?: string | null
  createdAt: string
  rawCreatedAt: string
}

const reports = ref<ModerationReport[]>([])
const isLoading = ref(true)

// Filter & Search State
const statusFilter = ref<'pending' | 'appeals' | 'bugs' | 'resolved' | 'all'>('pending')
const typeFilter = ref<string>('all')
const searchQuery = ref('')

// Inspector Drawer State
const selectedReport = ref<ModerationReport | null>(null)
const isInspectorOpen = ref(false)
const targetSanctions = ref<any[]>([])
const isLoadingSanctions = ref(false)

// Action Confirmation Modal State
const isActionDialogOpen = ref(false)
const pendingAction = ref<string | null>(null)
const actionOfficialReason = ref('')
const actionPenaltyScore = ref(0.5)
const actionSuspensionDays = ref(7)
const isSubmittingAction = ref(false)
const actionFeedback = ref<{ status: 'success' | 'error'; message: string } | null>(null)

onMounted(async () => {
  await fetchReports()
})

const fetchReports = async () => {
  isLoading.value = true
  try {
    const { data, error } = await db
      .from('USER_REPORT')
      .select(`
        Report_ID,
        Reporter_Account_ID,
        Target_Account_ID,
        Target_Artist_ID,
        Target_Business_ID,
        Target_Job_ID,
        Target_Message_ID,
        Target_Post_ID,
        Target_Comment_ID,
        Target_Booking_ID,
        Category,
        Description,
        Evidence_Snapshot,
        Is_Resolved,
        Action_Taken,
        Admin_Notes,
        Resolved_By_Admin_ID,
        Resolved_At,
        Created_At,
        Reporter:USER_ACCOUNT!Reporter_Account_ID (
          ACCOUNT_ID,
          Username,
          Email,
          Profile_Picture
        ),
        Target:USER_ACCOUNT!Target_Account_ID (
          ACCOUNT_ID,
          Username,
          Email,
          Profile_Picture,
          Strike_Count,
          Penalty_Rating_Deduction,
          Is_Suspended,
          Suspended_Until,
          Suspension_Reason,
          Is_Banned,
          Ban_Reason,
          Ban_Contested,
          Contest_Message,
          Contested_At
        )
      `)
      .order('Created_At', { ascending: false })

    if (error) throw error

    const deriveSeverity = (r: any): string => {
      if (r.Evidence_Snapshot?.severity) return r.Evidence_Snapshot.severity
      if (r.Evidence_Snapshot?.diagnostics?.severity) return r.Evidence_Snapshot.diagnostics.severity
      const cat = (r.Category || '').toLowerCase()
      if (cat.includes('blackmail') || cat.includes('scam') || cat.includes('phishing') || cat.includes('hate') || cat.includes('explicit')) {
        return 'Critical'
      }
      if (cat.includes('harassment') || cat.includes('late cancellation') || cat.includes('no-show') || cat.includes('breach') || cat.includes('fraud') || cat.includes('dispute')) {
        return 'High'
      }
      if (cat.includes('spam') || cat.includes('unsolicited') || cat.includes('inappropriate') || cat.includes('modification')) {
        return 'Medium'
      }
      return 'Low'
    }

    reports.value = (data || []).map((row: any) => {
      const reporter = row.Reporter
      const target = row.Target

      return {
        id: row.Report_ID,
        reporterId: row.Reporter_Account_ID,
        reporterUsername: reporter?.Username || (row.Category === 'Bug' || row.Category === 'Feedback' ? (row.Evidence_Snapshot?.contactEmail || 'Platform Guest') : 'Unknown User'),
        reporterEmail: reporter?.Email || row.Evidence_Snapshot?.contactEmail || '',
        reporterAvatar: reporter?.Profile_Picture || null,
        targetAccountId: row.Target_Account_ID,
        targetUsername: target?.Username || (row.Category === 'Bug' || row.Category === 'Feedback' ? 'Platform System' : 'N/A'),
        targetEmail: target?.Email || '',
        targetAvatar: target?.Profile_Picture || null,
        targetStrikeCount: Number(target?.Strike_Count || 0),
        targetPenaltyDeduction: Number(target?.Penalty_Rating_Deduction || 0),
        targetIsSuspended: !!target?.Is_Suspended,
        targetSuspendedUntil: target?.Suspended_Until || null,
        targetSuspensionReason: target?.Suspension_Reason || null,
        targetIsBanned: !!target?.Is_Banned,
        targetBanReason: target?.Ban_Reason || null,
        targetBanContested: !!target?.Ban_Contested,
        targetContestMessage: target?.Contest_Message || null,
        targetContestedAt: target?.Contested_At || null,
        targetArtistId: row.Target_Artist_ID,
        targetBusinessId: row.Target_Business_ID,
        targetJobId: row.Target_Job_ID,
        targetMessageId: row.Target_Message_ID,
        targetPostId: row.Target_Post_ID,
        targetCommentId: row.Target_Comment_ID,
        targetContractId: row.Target_Booking_ID,
        category: row.Category || 'General',
        severity: deriveSeverity(row),
        description: row.Description || 'No description provided.',
        evidenceSnapshot: row.Evidence_Snapshot || null,
        isResolved: !!row.Is_Resolved,
        actionTaken: row.Action_Taken || null,
        adminNotes: row.Admin_Notes || null,
        resolvedByAdminId: row.Resolved_By_Admin_ID || null,
        resolvedAt: row.Resolved_At || null,
        createdAt: row.Created_At ? new Date(row.Created_At).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent',
        rawCreatedAt: row.Created_At || ''
      }
    })
  } catch (err) {
    console.error('Error fetching reports:', err)
  } finally {
    isLoading.value = false
  }
}

// Fetch Sanction History for a given account
const fetchSanctionsHistory = async (accountId?: string) => {
  if (!accountId) {
    targetSanctions.value = []
    return
  }
  isLoadingSanctions.value = true
  try {
    const { data, error } = await db
      .from('SANCTION_LOG')
      .select('*')
      .eq('Account_ID', accountId)
      .order('Created_At', { ascending: false })

    if (!error && data) {
      targetSanctions.value = data
    }
  } catch (e) {
    console.error('Failed to load sanction history:', e)
  } finally {
    isLoadingSanctions.value = false
  }
}

// Metric Counts
const totalCount = computed(() => reports.value.length)
const pendingCount = computed(() => reports.value.filter(r => !r.isResolved).length)
const appealsCount = computed(() => reports.value.filter(r => r.category === 'Appeal' || r.targetBanContested).length)
const bugsFeedbackCount = computed(() => reports.value.filter(r => r.category === 'Bug' || r.category === 'Feedback').length)
const resolvedCount = computed(() => reports.value.filter(r => r.isResolved).length)

// Filtered Queue
const filteredReports = computed(() => {
  return reports.value.filter(r => {
    // Status tab filter
    if (statusFilter.value === 'pending' && r.isResolved) return false
    if (statusFilter.value === 'resolved' && !r.isResolved) return false
    if (statusFilter.value === 'appeals' && r.category !== 'Appeal' && !r.targetBanContested) return false
    if (statusFilter.value === 'bugs' && r.category !== 'Bug' && r.category !== 'Feedback') return false

    // Target type filter
    if (typeFilter.value !== 'all') {
      const type = getTargetEntityLabel(r)
      if (type.toLowerCase() !== typeFilter.value.toLowerCase()) return false
    }

    // Search query filter
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      const matchReporter = (r.reporterUsername || '').toLowerCase().includes(q) || (r.reporterEmail || '').toLowerCase().includes(q)
      const matchTarget = (r.targetUsername || '').toLowerCase().includes(q) || (r.targetEmail || '').toLowerCase().includes(q)
      const matchDesc = (r.description || '').toLowerCase().includes(q)
      const matchCat = (r.category || '').toLowerCase().includes(q)
      const matchId = r.id.toLowerCase().includes(q)
      if (!matchReporter && !matchTarget && !matchDesc && !matchCat && !matchId) return false
    }

    return true
  })
})

const getTargetEntityLabel = (report: ModerationReport): string => {
  if (report.category === 'Bug') return 'Bug'
  if (report.category === 'Feedback') return 'Feedback'
  if (report.category === 'Appeal') return 'Appeal'
  if (report.targetPostId) return 'Post'
  if (report.targetCommentId) return 'Comment'
  if (report.targetMessageId) return 'Message'
  if (report.targetContractId) return 'Contract'
  if (report.targetJobId) return 'Job Listing'
  if (report.targetArtistId) return 'Artist'
  if (report.targetBusinessId) return 'Business'
  return 'Profile'
}

const openInspector = async (report: ModerationReport) => {
  selectedReport.value = report
  isInspectorOpen.value = true
  if (report.targetAccountId) {
    await fetchSanctionsHistory(report.targetAccountId)
  } else {
    targetSanctions.value = []
  }
}

const closeInspector = () => {
  isInspectorOpen.value = false
}

// Action Confirmation Modal Trigger
const promptAction = (actionKey: string) => {
  pendingAction.value = actionKey
  actionOfficialReason.value = ''
  actionFeedback.value = null
  isActionDialogOpen.value = true
}

const getActionDialogTitle = (action: string | null) => {
  switch (action) {
    case 'strike_1_warning': return 'Issue 1st Strike (Warning)'
    case 'strike_2_penalty': return 'Issue 2nd Strike (Rating Penalty)'
    case 'strike_3_ban': return 'Issue 3rd Strike (Permanent Account Ban)'
    case 'suspend_user': return 'Issue Temporary Account Suspension'
    case 'lift_sanction': return 'Lift All Account Sanctions & Restore'
    case 'delete_content': return 'Delete Offending Content'
    case 'resolve_bug': return 'Resolve Bug / Feedback Ticket'
    case 'dismiss': return 'Dismiss Report Without Sanctions'
    default: return 'Confirm Moderation Action'
  }
}

const executeAdminAction = async () => {
  if (!selectedReport.value || !pendingAction.value) return
  isSubmittingAction.value = true
  actionFeedback.value = null

  try {
    const payload: any = {
      reportId: selectedReport.value.id,
      action: pendingAction.value,
      targetAccountId: selectedReport.value.targetAccountId,
      reason: actionOfficialReason.value.trim() || undefined,
      adminNotes: actionOfficialReason.value.trim() || undefined
    }

    if (pendingAction.value === 'strike_2_penalty') {
      payload.penaltyScore = actionPenaltyScore.value
    } else if (pendingAction.value === 'suspend_user') {
      const until = new Date()
      until.setDate(until.getDate() + Number(actionSuspensionDays.value))
      payload.suspensionUntil = until.toISOString()
    }

    const res = await $fetch('/api/admin/reports/action', {
      method: 'POST',
      body: payload
    })

    actionFeedback.value = {
      status: 'success',
      message: (res as any)?.message || 'Action executed successfully.'
    }

    // Refresh queue & inspector state
    await fetchReports()
    if (selectedReport.value) {
      const updated = reports.value.find(r => r.id === selectedReport.value?.id)
      if (updated) {
        selectedReport.value = updated
        await fetchSanctionsHistory(updated.targetAccountId)
      }
    }

    setTimeout(() => {
      isActionDialogOpen.value = false
    }, 1200)
  } catch (err: any) {
    console.error('Failed to execute admin action:', err)
    actionFeedback.value = {
      status: 'error',
      message: err.data?.message || err.message || 'Failed to execute moderation action.'
    }
  } finally {
    isSubmittingAction.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#131315] text-white font-Sora flex flex-col">
    <!-- Top Header Ribbon -->
    <header class="flex items-center justify-between px-6 sm:px-16 h-16 sm:h-20 border-b border-[#46464D] top-0 sticky backdrop-blur-3xl z-10 pl-16 sm:pl-16">
      <div class="flex items-center gap-3">
        <h1 class="text-[#D0D4F7] text-lg sm:text-[24px] font-medium tracking-tight">Welcome Back Admin!</h1>
      </div>

      <button
        @click="fetchReports"
        :disabled="isLoading"
        class="px-4 py-2 rounded-xl bg-[#18181B] border border-[#2A2A2E] text-xs text-gray-200 hover:text-white hover:border-[#D0D4F7]/40 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
      >
        <Icon name="ic:baseline-refresh" class="text-base" :class="isLoading ? 'animate-spin text-[#D0D4F7]' : ''" />
        <span>Refresh Queue</span>
      </button>
    </header>

    <main class="p-6 sm:p-10 max-w-7xl w-full mx-auto flex flex-col gap-8 flex-1">
      <!-- 2. Controls & Filtering Bar -->
      <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-[#131315] p-3 rounded-2xl border border-[#2A2A2E]">
        <!-- Status Filter Tabs -->
        <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <button
            @click="statusFilter = 'pending'"
            class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer"
            :class="statusFilter === 'pending' ? 'bg-[#D0D4F7] text-[#0E0E10]' : 'bg-[#18181B] text-gray-400 hover:text-white border border-[#2A2A2E]'"
          >
            Pending ({{ pendingCount }})
          </button>
          <button
            @click="statusFilter = 'appeals'"
            class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer"
            :class="statusFilter === 'appeals' ? 'bg-rose-500 text-white' : 'bg-[#18181B] text-gray-400 hover:text-white border border-[#2A2A2E]'"
          >
            Appeals ({{ appealsCount }})
          </button>
          <button
            @click="statusFilter = 'bugs'"
            class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer"
            :class="statusFilter === 'bugs' ? 'bg-[#D0D4F7] text-[#0E0E10]' : 'bg-[#18181B] text-gray-400 hover:text-white border border-[#2A2A2E]'"
          >
            Bugs & Feedback ({{ bugsFeedbackCount }})
          </button>
          <button
            @click="statusFilter = 'resolved'"
            class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer"
            :class="statusFilter === 'resolved' ? 'bg-emerald-600 text-white' : 'bg-[#18181B] text-gray-400 hover:text-white border border-[#2A2A2E]'"
          >
            Resolved ({{ resolvedCount }})
          </button>
          <button
            @click="statusFilter = 'all'"
            class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer"
            :class="statusFilter === 'all' ? 'bg-white text-[#0E0E10]' : 'bg-[#18181B] text-gray-400 hover:text-white border border-[#2A2A2E]'"
          >
            All ({{ totalCount }})
          </button>
        </div>

        <!-- Entity Type & Search Input -->
        <div class="flex items-center gap-3">
          <select
            v-model="typeFilter"
            class="bg-[#18181B] border border-[#2A2A2E] rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-hidden focus:border-[#D0D4F7]"
          >
            <option value="all">All Types</option>
            <option value="Profile">Profile</option>
            <option value="Post">Post</option>
            <option value="Comment">Comment</option>
            <option value="Message">Message</option>
            <option value="Contract">Contract</option>
            <option value="Bug">Bug Report</option>
            <option value="Feedback">Feedback</option>
            <option value="Appeal">Contested Appeal</option>
          </select>

          <div class="relative w-full sm:w-64">
            <Icon name="ic:baseline-search" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-base" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search user, ID, notes..."
              class="w-full bg-[#18181B] border border-[#2A2A2E] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7] font-Geist"
            />
          </div>
        </div>
      </div>

      <!-- 3. Loading State -->
      <div v-if="isLoading" class="p-16 text-center text-gray-500 bg-[#131315]/40 rounded-2xl border border-[#2A2A2E]">
        <Icon name="ic:baseline-refresh" class="animate-spin text-3xl mx-auto mb-2 text-[#D0D4F7]" />
        <p class="text-xs font-Geist">Loading moderation tickets...</p>
      </div>

      <!-- 4. Empty State -->
      <div
        v-else-if="filteredReports.length === 0"
        class="py-20 px-6 text-center rounded-2xl bg-[#131315]/50 border border-[#2A2A2E] flex flex-col items-center justify-center gap-2"
      >
        <div class="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-2xl mb-1">
          <Icon name="ic:baseline-check-box" />
        </div>
        <h3 class="text-base font-bold text-gray-200">No reports found</h3>
        <p class="text-xs text-gray-500 max-w-sm font-Geist">
          {{ statusFilter === 'pending' ? 'All clear!' : 'All clear!' }}
        </p>
      </div>

      <!-- 5. Reports Table -->
      <div v-else class="overflow-x-auto rounded-2xl border border-[#2A2A2E] bg-[#131315] shadow-xl">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="border-b border-[#2A2A2E] bg-[#18181B]/80 text-gray-400 font-medium">
              <th class="p-4">Reported</th>
              <th class="p-4">Type</th>
              <th class="p-4">Category</th>
              <th class="p-4">Severity</th>
              <th class="p-4">Accused / Target</th>
              <th class="p-4">Reporter</th>
              <th class="p-4">Description Snippet</th>
              <th class="p-4">Status</th>
              <th class="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#2A2A2E]">
            <tr
              v-for="report in filteredReports"
              :key="report.id"
              class="hover:bg-[#18181B]/60 transition-colors group cursor-pointer"
              @click="openInspector(report)"
            >
              <td class="p-4 text-gray-400 whitespace-nowrap font-mono text-[11px]">
                {{ report.createdAt }}
              </td>

              <td class="p-4 whitespace-nowrap">
                <span class="px-2 py-0.5 rounded text-[10px] bg-[#1E1E24] text-[#D0D4F7] border border-[#2A2A2E] font-mono uppercase">
                  {{ getTargetEntityLabel(report) }}
                </span>
              </td>

              <td class="p-4">
                <div class="flex flex-col gap-1 items-start">
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                    {{ report.category }}
                  </span>
                </div>
              </td>

              <td class="p-4">
                <div class="flex flex-col gap-1 items-start">
                  <span
                    v-if="report.severity === 'Critical' || report.severity === 'High'"
                    class="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-bold"
                  >
                    {{ report.severity }}
                  </span>
                </div>
              </td>

              <td class="p-4">
                <div v-if="report.targetAccountId" class="flex flex-col gap-1">
                  <div class="font-semibold text-gray-200 flex items-center gap-1.5">
                    <span>{{ report.targetUsername }}</span>
                    <!-- Strike badge -->
                    <span
                      class="px-1.5 py-0.2 text-[9px] rounded font-mono font-bold"
                      :class="report.targetStrikeCount >= 3 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : report.targetStrikeCount >= 1 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-gray-800 text-gray-400'"
                    >
                      Strike {{ report.targetStrikeCount }}/3
                    </span>
                  </div>
                  <div v-if="report.targetIsBanned" class="text-[10px] text-rose-400 font-mono flex items-center gap-1">
                    <Icon name="ic:baseline-lock-person" class="text-xs" />
                    <span>Permanent Ban</span>
                  </div>
                  <div v-else-if="report.targetIsSuspended" class="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                    <Icon name="ic:round-lock-clock" class="text-xs" />
                    <span>Suspended</span>
                  </div>
                </div>
                <div v-else class="text-gray-500 italic">
                  Platform System
                </div>
              </td>

              <td class="p-4">
                <div class="font-medium text-gray-200">{{ report.reporterUsername }}</div>
                <div class="text-[11px] text-gray-500 font-mono truncate max-w-35">{{ report.reporterEmail }}</div>
              </td>

              <td class="p-4 max-w-xs truncate text-gray-300 font-Geist" :title="report.description">
                {{ report.description }}
              </td>

              <td class="p-4 whitespace-nowrap">
                <span
                  class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                  :class="report.isResolved ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'"
                >
                  {{ report.isResolved ? (report.actionTaken || 'Resolved') : 'Pending Review' }}
                </span>
              </td>

              <td class="p-4 text-right whitespace-nowrap" @click.stop>
                <button
                  @click="openInspector(report)"
                  class="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#1E1E24] hover:bg-[#D0D4F7] text-gray-200 hover:text-[#0E0E10] border border-[#2A2A2E] transition-all cursor-pointer shadow-sm"
                >
                  Review
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <!-- 6. Detailed Inspector Slide-Over / Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isInspectorOpen && selectedReport"
          class="fixed inset-0 z-60 flex items-center justify-end bg-black/80 backdrop-blur-md"
          @click="closeInspector"
        >
          <div
            class="w-full max-w-2xl h-full bg-[#131315] border-l border-[#2A2A2E] flex flex-col justify-between shadow-2xl overflow-hidden font-Sora text-white"
            @click.stop
          >
            <!-- Inspector Header -->
            <div class="p-6 border-b border-[#2A2A2E] bg-[#18181B] flex items-center justify-between shrink-0">
              <div class="flex items-center gap-3">
                <span class="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                  <Icon name="ic:round-flag" class="text-xl" />
                </span>
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="text-base font-bold text-white">Ticket {{ selectedReport.id.slice(0, 8) }}</h3>
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#1E1E24] text-[#D0D4F7] border border-[#2A2A2E]">
                      {{ getTargetEntityLabel(selectedReport) }}
                    </span>
                  </div>
                  <p class="text-xs text-gray-400 font-Geist">{{ selectedReport.createdAt }}</p>
                </div>
              </div>

              <button
                @click="closeInspector"
                class="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
              >
                <Icon name="ic:round-close" class="text-xl" />
              </button>
            </div>

            <!-- Inspector Scroll Body -->
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              <!-- Ticket Status Banner -->
              <div
                class="p-3.5 rounded-xl border flex items-center justify-between"
                :class="selectedReport.isResolved ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'"
              >
                <div class="flex items-center gap-2 text-xs font-semibold">
                  <Icon :name="selectedReport.isResolved ? 'ic:baseline-check-box' : 'ic:baseline-warning'" class="text-lg" />
                  <span>{{ selectedReport.isResolved ? `Resolved: ${selectedReport.actionTaken || 'Action Taken'}` : 'Requires Administrative Review' }}</span>
                </div>
                <span class="text-[11px] font-mono">{{ selectedReport.category }} ({{ selectedReport.severity }})</span>
              </div>

              <!-- Reporter & Accused 2-Column Cards -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Reporter Box -->
                <div class="p-4 rounded-xl bg-[#18181B] border border-[#2A2A2E] space-y-2">
                  <span class="text-[10px] uppercase font-mono text-gray-400 tracking-wider">Reporter Details</span>
                  <div class="flex items-center gap-2.5">
                    <img
                      v-if="selectedReport.reporterAvatar"
                      :src="selectedReport.reporterAvatar"
                      class="w-8 h-8 rounded-full object-cover border border-[#3A3A3E]"
                    />
                    <div v-else class="w-8 h-8 rounded-full bg-[#2A2A2E] flex items-center justify-center text-xs text-gray-300">
                      <Icon name="ic:baseline-person" />
                    </div>
                    <div class="min-w-0">
                      <p class="text-xs font-bold text-white truncate">{{ selectedReport.reporterUsername }}</p>
                      <p class="text-[11px] text-gray-400 font-mono truncate">{{ selectedReport.reporterEmail }}</p>
                    </div>
                  </div>
                </div>

                <!-- Accused User Box -->
                <div class="p-4 rounded-xl bg-[#18181B] border border-[#2A2A2E] space-y-2">
                  <span class="text-[10px] uppercase font-mono text-gray-400 tracking-wider">Target / Accused Account</span>
                  <div v-if="selectedReport.targetAccountId" class="flex items-center gap-2.5">
                    <img
                      v-if="selectedReport.targetAvatar"
                      :src="selectedReport.targetAvatar"
                      class="w-8 h-8 rounded-full object-cover border border-[#3A3A3E]"
                    />
                    <div v-else class="w-8 h-8 rounded-full bg-[#2A2A2E] flex items-center justify-center text-xs text-gray-300">
                      <Icon name="ic:baseline-person" />
                    </div>
                    <div class="flex items-center justify-center gap-1 min-w-0">
                      <p class="text-xs font-bold text-white truncate">{{ selectedReport.targetUsername }}</p>
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span
                          class="px-1.5 py-0.2 text-[9px] rounded font-mono font-bold"
                          :class="selectedReport.targetStrikeCount >= 3 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : selectedReport.targetStrikeCount >= 1 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-gray-800 text-gray-400'"
                        >
                          Strike {{ selectedReport.targetStrikeCount }}/3
                        </span>
                        <span v-if="selectedReport.targetPenaltyDeduction > 0" class="text-[10px] text-amber-300 font-mono">
                          -{{ selectedReport.targetPenaltyDeduction }}★
                        </span>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-xs text-gray-500 italic py-1">
                    Platform System Ticket (No single user accused)
                  </div>
                </div>
              </div>

              <!-- Complaint Statement -->
              <div class="p-4 rounded-xl bg-[#18181B] border border-[#2A2A2E] space-y-2">
                <span class="text-[10px] uppercase font-mono text-gray-400 tracking-wider">Report Statement / Description</span>
                <p class="text-xs text-gray-200 leading-relaxed font-Geist whitespace-pre-line bg-[#131315] p-3 rounded-lg border border-[#222226]">
                  {{ selectedReport.description }}
                </p>
              </div>

              <!-- Immutable Quoted Evidence Snapshot Box -->
              <div v-if="selectedReport.evidenceSnapshot" class="p-4 rounded-xl bg-[#18181B] border border-[#2A2A2E] space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5 text-xs font-semibold text-[#D0D4F7]">
                    <Icon name="ic:baseline-lock" class="text-base" />
                    <span>Preserved Evidence Snapshot (Server-Captured)</span>
                  </div>
                  <span class="text-[10px] font-mono text-gray-500">Immutable Integrity</span>
                </div>

                <!-- Snapshot Content Renderer -->
                <div class="bg-[#0E0E10] border border-[#2A2A2E] rounded-xl p-4 text-xs font-Geist space-y-3">
                  <!-- Post Snapshot -->
                  <div v-if="selectedReport.evidenceSnapshot.caption || selectedReport.evidenceSnapshot.mediaUrl" class="space-y-2">
                    <p v-if="selectedReport.evidenceSnapshot.caption" class="text-gray-200 whitespace-pre-line">
                      "{{ selectedReport.evidenceSnapshot.caption }}"
                    </p>
                    <div v-if="selectedReport.evidenceSnapshot.mediaUrl" class="rounded-lg overflow-hidden border border-[#2A2A2E] max-h-60 bg-black flex items-center justify-center">
                      <img :src="selectedReport.evidenceSnapshot.mediaUrl" class="max-h-60 object-contain" />
                    </div>
                  </div>

                  <!-- Comment Snapshot -->
                  <div v-else-if="selectedReport.evidenceSnapshot.content" class="space-y-1">
                    <span class="text-[10px] text-gray-500 font-mono">Comment Content:</span>
                    <p class="text-gray-200">"{{ selectedReport.evidenceSnapshot.content }}"</p>
                  </div>

                  <!-- Message Snapshot -->
                  <div v-else-if="selectedReport.evidenceSnapshot.messageContent" class="space-y-1">
                    <span class="text-[10px] text-gray-500 font-mono">Chat Message Content:</span>
                    <p class="text-gray-200">"{{ selectedReport.evidenceSnapshot.messageContent }}"</p>
                    <p class="text-[10px] text-gray-500 font-mono">Timestamp: {{ selectedReport.evidenceSnapshot.timestamp }}</p>
                  </div>

                  <!-- Contract Snapshot -->
                  <div v-else-if="selectedReport.evidenceSnapshot.contractCode" class="space-y-1.5">
                    <div class="flex items-center justify-between font-mono text-[11px] text-[#D0D4F7]">
                      <span>Code: {{ selectedReport.evidenceSnapshot.contractCode }}</span>
                      <span>Fee: ₱{{ Number(selectedReport.evidenceSnapshot.agreedFee || 0).toLocaleString() }}</span>
                    </div>
                    <p class="text-gray-300">Venue: {{ selectedReport.evidenceSnapshot.venueLocation }}</p>
                    <p class="text-amber-300">Late Cancellation: {{ selectedReport.evidenceSnapshot.isLateCancellation ? 'YES (≤5 days)' : 'NO' }}</p>
                    <p v-if="selectedReport.evidenceSnapshot.cancellationReason" class="text-rose-300">
                      Cancellation Reason: {{ selectedReport.evidenceSnapshot.cancellationReason }}
                    </p>
                  </div>

                  <!-- Bug / Feedback Diagnostics -->
                  <div v-else-if="selectedReport.evidenceSnapshot.stepsToReproduce || selectedReport.evidenceSnapshot.diagnostics" class="space-y-2">
                    <div v-if="selectedReport.evidenceSnapshot.stepsToReproduce" class="space-y-1">
                      <span class="text-[10px] font-mono text-gray-400 uppercase">Steps to Reproduce:</span>
                      <p class="text-gray-200 whitespace-pre-line">{{ selectedReport.evidenceSnapshot.stepsToReproduce }}</p>
                    </div>
                    <div v-if="selectedReport.evidenceSnapshot.diagnostics" class="p-2 rounded bg-[#131315] text-[10.5px] font-mono text-gray-400 space-y-0.5 border border-[#1E1E24]">
                      <p>Route: {{ selectedReport.evidenceSnapshot.diagnostics.url }}</p>
                      <p>Viewport: {{ selectedReport.evidenceSnapshot.diagnostics.viewport }}</p>
                      <p>Platform: {{ selectedReport.evidenceSnapshot.diagnostics.platform }}</p>
                    </div>
                  </div>

                  <!-- Fallback JSON viewer -->
                  <div v-else class="text-[11px] font-mono text-gray-400 overflow-x-auto">
                    <pre>{{ JSON.stringify(selectedReport.evidenceSnapshot, null, 2) }}</pre>
                  </div>
                </div>
              </div>

              <!-- Prior Sanction History for this target account -->
              <div v-if="selectedReport.targetAccountId" class="p-4 rounded-xl bg-[#18181B] border border-[#2A2A2E] space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] uppercase font-mono text-gray-400 tracking-wider">Account Sanction History</span>
                  <span class="text-xs font-mono text-gray-400">{{ targetSanctions.length }} Entries</span>
                </div>

                <div v-if="isLoadingSanctions" class="text-center py-4 text-gray-500">
                  <Icon name="ic:baseline-refresh" class="animate-spin text-lg" />
                </div>
                <div v-else-if="targetSanctions.length === 0" class="text-xs text-gray-500 italic py-2">
                  No prior strikes or sanctions on record for this user account.
                </div>
                <div v-else class="space-y-2">
                  <div
                    v-for="log in targetSanctions"
                    :key="log.Log_ID"
                    class="p-2.5 rounded-lg bg-[#131315] border border-[#222226] text-xs space-y-1"
                  >
                    <div class="flex items-center justify-between">
                      <span
                        class="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                        :class="log.Sanction_Type === 'Ban' ? 'bg-rose-500/20 text-rose-300' : log.Sanction_Type === 'Lifted' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'"
                      >
                        {{ log.Sanction_Type }} {{ log.Strike_Number ? `(Strike ${log.Strike_Number})` : '' }}
                      </span>
                      <span class="text-[10px] text-gray-500 font-mono">{{ new Date(log.Created_At).toLocaleDateString() }}</span>
                    </div>
                    <p class="text-gray-300 font-Geist text-[11px]">{{ log.Reason }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Inspector Action Toolbar (Strictly using requested Iconify icons, NO EMOJIS) -->
            <div class="p-5 border-t border-[#2A2A2E] bg-[#18181B] space-y-3 shrink-0">
              <span class="text-[10px] uppercase font-mono text-gray-400 tracking-wider block">Moderation Action Controls</span>

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <!-- Delete Content Button -->
                <button
                  v-if="selectedReport.targetPostId || selectedReport.targetCommentId || selectedReport.targetMessageId"
                  @click="promptAction('delete_content')"
                  class="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm"
                  title="Delete Offending Content"
                >
                  <Icon name="ic:baseline-delete" class="text-base" />
                  <span>Delete Content</span>
                </button>

                <!-- Issue Strike 1 (Warning) -->
                <button
                  v-if="selectedReport.targetAccountId"
                  @click="promptAction('strike_1_warning')"
                  class="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm"
                  title="Issue 1st Strike (Warning)"
                >
                  <Icon name="ic:baseline-warning" class="text-base" />
                  <span>Strike 1 (Warn)</span>
                </button>

                <!-- Issue Strike 2 (Rating Penalty) -->
                <button
                  v-if="selectedReport.targetAccountId"
                  @click="promptAction('strike_2_penalty')"
                  class="px-3 py-2 rounded-xl bg-amber-600/15 hover:bg-amber-600/25 border border-amber-600/30 text-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm"
                  title="Issue 2nd Strike (-0.5 Rating)"
                >
                  <Icon name="ic:baseline-star-half" class="text-base" />
                  <span>Strike 2 (-0.5★)</span>
                </button>

                <!-- Issue Strike 3 (Permanent Ban) -->
                <button
                  v-if="selectedReport.targetAccountId"
                  @click="promptAction('strike_3_ban')"
                  class="px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-600/40 text-rose-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm"
                  title="Issue 3rd Strike (Permanent Ban)"
                >
                  <Icon name="ic:baseline-lock-person" class="text-base" />
                  <span>Strike 3 (Ban)</span>
                </button>

                <!-- Temporary Suspension -->
                <button
                  v-if="selectedReport.targetAccountId"
                  @click="promptAction('suspend_user')"
                  class="px-3 py-2 rounded-xl bg-[#1E1E24] hover:bg-[#282830] border border-[#3A3A3E] text-gray-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm"
                  title="Temporary Account Suspension"
                >
                  <Icon name="ic:round-lock-clock" class="text-base" />
                  <span>Suspend</span>
                </button>

                <!-- Lift Sanction / Restore Account -->
                <button
                  v-if="selectedReport.targetAccountId && (selectedReport.targetStrikeCount > 0 || selectedReport.targetIsSuspended || selectedReport.targetIsBanned || selectedReport.targetPenaltyDeduction > 0)"
                  @click="promptAction('lift_sanction')"
                  class="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm"
                  title="Lift All Sanctions"
                >
                  <Icon name="ic:round-lock-open" class="text-base" />
                  <span>Lift Sanctions</span>
                </button>

                <!-- Resolve Bug / Feedback Ticket -->
                <button
                  v-if="selectedReport.category === 'Bug' || selectedReport.category === 'Feedback' || !selectedReport.targetAccountId"
                  @click="promptAction('resolve_bug')"
                  class="px-3 py-2 rounded-xl bg-[#D0D4F7]/15 hover:bg-[#D0D4F7]/25 border border-[#D0D4F7]/30 text-[#D0D4F7] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm"
                  title="Resolve Bug / Feedback"
                >
                  <Icon name="ic:baseline-check-box" class="text-base" />
                  <span>Resolve Ticket</span>
                </button>

                <!-- Dismiss Report Without Sanction -->
                <button
                  @click="promptAction('dismiss')"
                  class="px-3 py-2 rounded-xl bg-[#1E1E24] hover:bg-gray-700/30 border border-[#3A3A3E] text-gray-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm"
                  title="Dismiss Without Sanctions"
                >
                  <Icon name="ic:baseline-close" class="text-base" />
                  <span>Dismiss</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 7. Action Confirmation Modal with Admin Reason & Param Inputs -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isActionDialogOpen && pendingAction"
          class="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          @click="isActionDialogOpen = false"
        >
          <div
            class="bg-[#18181B] border border-[#2A2A2E] rounded-2xl w-full max-w-lg p-6 space-y-5 font-Sora text-white shadow-2xl"
            @click.stop
          >
            <!-- Title -->
            <div class="flex items-center justify-between border-b border-[#2A2A2E] pb-4">
              <h3 class="text-base font-bold text-white flex items-center gap-2">
                <Icon
                  :name="
                    pendingAction === 'strike_1_warning' ? 'ic:baseline-warning' :
                    pendingAction === 'strike_2_penalty' ? 'ic:baseline-star-half' :
                    pendingAction === 'strike_3_ban' ? 'ic:baseline-lock-person' :
                    pendingAction === 'suspend_user' ? 'ic:round-lock-clock' :
                    pendingAction === 'lift_sanction' ? 'ic:round-lock-open' :
                    pendingAction === 'delete_content' ? 'ic:baseline-delete' :
                    pendingAction === 'resolve_bug' ? 'ic:baseline-check-box' : 'ic:round-flag'
                  "
                  class="text-xl text-[#D0D4F7]"
                />
                <span>{{ getActionDialogTitle(pendingAction) }}</span>
              </h3>
              <button @click="isActionDialogOpen = false" class="text-gray-400 hover:text-white cursor-pointer">
                <Icon name="ic:round-close" class="text-lg" />
              </button>
            </div>

            <!-- Parameter Configuration (If Suspension or Strike 2) -->
            <div v-if="pendingAction === 'suspend_user'" class="space-y-2">
              <label class="text-xs font-semibold text-gray-300">Suspension Duration (Days):</label>
              <div class="grid grid-cols-4 gap-2">
                <button
                  v-for="days in [3, 7, 14, 30]"
                  :key="days"
                  type="button"
                  @click="actionSuspensionDays = days"
                  class="py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer"
                  :class="actionSuspensionDays === days ? 'bg-[#D0D4F7] text-[#0E0E10] border-[#D0D4F7]' : 'bg-[#1E1E24] text-gray-300 border-[#2A2A2E] hover:border-gray-500'"
                >
                  {{ days }} Days
                </button>
              </div>
            </div>

            <div v-if="pendingAction === 'strike_2_penalty'" class="space-y-2">
              <label class="text-xs font-semibold text-gray-300">Rating Penalty Deduction:</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="val in [0.25, 0.5, 1.0]"
                  :key="val"
                  type="button"
                  @click="actionPenaltyScore = val"
                  class="py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer"
                  :class="actionPenaltyScore === val ? 'bg-[#D0D4F7] text-[#0E0E10] border-[#D0D4F7]' : 'bg-[#1E1E24] text-gray-300 border-[#2A2A2E] hover:border-gray-500'"
                >
                  -{{ val }} Stars
                </button>
              </div>
            </div>

            <!-- Official Reason / Notes Input -->
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-gray-300">Official Moderation Reason &amp; Audit Notes:</label>
              <textarea
                v-model="actionOfficialReason"
                rows="3"
                placeholder="State the official rationale for this decision. This will be recorded in SANCTION_LOG and sent in user notification."
                class="w-full bg-[#131315] border border-[#2A2A2E] rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7] font-Geist resize-none"
              />
            </div>

            <!-- Feedback Alert -->
            <div
              v-if="actionFeedback"
              class="p-3 rounded-xl text-xs flex items-center gap-2"
              :class="actionFeedback.status === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'"
            >
              <Icon :name="actionFeedback.status === 'success' ? 'ic:baseline-check-box' : 'ic:baseline-warning'" class="text-base shrink-0" />
              <span>{{ actionFeedback.message }}</span>
            </div>

            <!-- Footer Buttons -->
            <div class="flex items-center justify-end gap-3 pt-3 border-t border-[#2A2A2E]">
              <button
                type="button"
                @click="isActionDialogOpen = false"
                :disabled="isSubmittingAction"
                class="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                @click="executeAdminAction"
                :disabled="isSubmittingAction"
                class="px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                :class="
                  pendingAction === 'strike_3_ban' || pendingAction === 'delete_content'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : pendingAction === 'lift_sanction' || pendingAction === 'resolve_bug'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-[#D0D4F7] hover:bg-white text-[#0E0E10]'
                "
              >
                <Icon v-if="isSubmittingAction" name="ic:baseline-refresh" class="animate-spin text-sm" />
                <span>{{ isSubmittingAction ? 'Executing...' : 'Confirm & Execute Action' }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>