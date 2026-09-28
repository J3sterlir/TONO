<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

definePageMeta({
  layout: 'admin',
  middleware: 'admin'
})

const { signOutAdmin, fetchCurrentAdmin } = useAdminAuth()
const supabase = useSupabaseClient()
const db = supabase as any

interface ReportItem {
  id: string
  reporterId: string
  reporterUsername: string
  reporterEmail: string
  targetAccountId?: string
  targetArtistId?: string
  targetBusinessId?: string
  targetJobId?: string
  category: string
  description: string
  createdAt: string
  isResolved: boolean
}

const reports = ref<ReportItem[]>([])
const isLoading = ref(true)
const selectedFilter = ref<'all' | 'pending' | 'resolved'>('pending')
const selectedReport = ref<ReportItem | null>(null)
const isUpdating = ref(false)

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
        Category,
        Description,
        Created_At,
        Is_Resolved,
        USER_ACCOUNT!Reporter_Account_ID (
          Username,
          Email
        )
      `)
      .order('Created_At', { ascending: false })

    if (error) throw error

    reports.value = (data || []).map((row: any) => ({
      id: row.Report_ID,
      reporterId: row.Reporter_Account_ID,
      reporterUsername: row.USER_ACCOUNT?.Username || 'Unknown User',
      reporterEmail: row.USER_ACCOUNT?.Email || '',
      targetAccountId: row.Target_Account_ID,
      targetArtistId: row.Target_Artist_ID,
      targetBusinessId: row.Target_Business_ID,
      targetJobId: row.Target_Job_ID,
      category: row.Category || 'General',
      description: row.Description || 'No description provided.',
      createdAt: row.Created_At ? new Date(row.Created_At).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
      isResolved: !!row.Is_Resolved
    }))
  } catch (err) {
    console.error('Error fetching reports:', err)
  } finally {
    isLoading.value = false
  }
}

const filteredReports = computed(() => {
  if (selectedFilter.value === 'pending') return reports.value.filter(r => !r.isResolved)
  if (selectedFilter.value === 'resolved') return reports.value.filter(r => r.isResolved)
  return reports.value
})

const pendingCount = computed(() => reports.value.filter(r => !r.isResolved).length)
const resolvedCount = computed(() => reports.value.filter(r => r.isResolved).length)

const toggleResolveStatus = async (report: ReportItem) => {
  isUpdating.value = true
  try {
    const admin = await fetchCurrentAdmin()
    const newStatus = !report.isResolved
    const { error } = await db
      .from('USER_REPORT')
      .update({
        Is_Resolved: newStatus,
        Resolved_By_Admin_ID: newStatus ? (admin?.ADMIN_ID || null) : null
      })
      .eq('Report_ID', report.id)

    if (error) throw error
    report.isResolved = newStatus
  } catch (err) {
    console.error('Error updating report status:', err)
  } finally {
    isUpdating.value = false
  }
}

const getTargetType = (report: ReportItem) => {
  if (report.targetArtistId) return 'Artist'
  if (report.targetBusinessId) return 'Business'
  if (report.targetJobId) return 'Job Listing'
  return 'User'
}
</script>

<template>
  <div class="min-h-screen bg-[#0E0E10] text-white">
    <nav class="flex items-center px-10 h-20 border-b border-[#46464D]/50 sticky top-0 backdrop-blur-3xl z-10">
      <div>
        <h1 class="text-[#D0D4F7] text-2xl font-semibold">User Reports & Moderation</h1>
        <p class="text-xs text-gray-400 mt-0.5">Review reported content, user disputes, and moderation tickets</p>
      </div>
    </nav>

    <main class="p-10 max-w-7xl mx-auto flex flex-col gap-8">
      <!-- Stats Overview Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div class="p-5 rounded-2xl bg-[#131315] border border-[#2A2A2E] flex flex-col gap-1">
          <span class="text-xs text-gray-400 font-medium">Total Reports</span>
          <span class="text-3xl font-bold text-gray-100">{{ reports.length }}</span>
        </div>
        <div class="p-5 rounded-2xl bg-[#131315] border border-amber-500/20 flex flex-col gap-1">
          <span class="text-xs text-amber-400 font-medium">Pending Review</span>
          <span class="text-3xl font-bold text-amber-300">{{ pendingCount }}</span>
        </div>
        <div class="p-5 rounded-2xl bg-[#131315] border border-emerald-500/20 flex flex-col gap-1">
          <span class="text-xs text-emerald-400 font-medium">Resolved</span>
          <span class="text-3xl font-bold text-emerald-300">{{ resolvedCount }}</span>
        </div>
      </div>

      <!-- Controls & Filter Tabs -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <button
            @click="selectedFilter = 'pending'"
            class="px-4 py-2 rounded-xl text-xs font-medium transition-all"
            :class="selectedFilter === 'pending' ? 'bg-[#D0D4F7] text-[#0E0E10] font-semibold' : 'bg-[#18181B] text-gray-400 hover:text-white border border-[#2A2A2E]'"
          >
            Pending ({{ pendingCount }})
          </button>
          <button
            @click="selectedFilter = 'resolved'"
            class="px-4 py-2 rounded-xl text-xs font-medium transition-all"
            :class="selectedFilter === 'resolved' ? 'bg-[#D0D4F7] text-[#0E0E10] font-semibold' : 'bg-[#18181B] text-gray-400 hover:text-white border border-[#2A2A2E]'"
          >
            Resolved ({{ resolvedCount }})
          </button>
          <button
            @click="selectedFilter = 'all'"
            class="px-4 py-2 rounded-xl text-xs font-medium transition-all"
            :class="selectedFilter === 'all' ? 'bg-[#D0D4F7] text-[#0E0E10] font-semibold' : 'bg-[#18181B] text-gray-400 hover:text-white border border-[#2A2A2E]'"
          >
            All Reports ({{ reports.length }})
          </button>
        </div>

        <button
          @click="fetchReports"
          class="px-3 py-2 rounded-xl bg-[#18181B] border border-[#2A2A2E] text-xs text-gray-300 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <Icon name="ic:baseline-refresh" class="text-sm" />
          <span>Refresh</span>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="p-12 text-center text-gray-500">
        <Icon name="ic:baseline-refresh" class="animate-spin text-3xl mx-auto mb-2 text-[#D0D4F7]" />
        <p class="text-xs">Loading moderation reports...</p>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="filteredReports.length === 0"
        class="py-16 px-6 text-center rounded-2xl bg-[#131315]/50 border border-[#2A2A2E] flex flex-col items-center justify-center gap-2"
      >
        <div class="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl mb-1">
          <Icon name="ic:baseline-check-circle" />
        </div>
        <h3 class="text-base font-semibold text-gray-200">No reports found</h3>
        <p class="text-xs text-gray-500 max-w-sm">
          {{ selectedFilter === 'pending' ? 'All clear! There are no pending reports requiring administrative review.' : 'No reports found matching this filter.' }}
        </p>
      </div>

      <!-- Reports Table -->
      <div v-else class="overflow-x-auto rounded-2xl border border-[#2A2A2E] bg-[#131315]">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="border-b border-[#2A2A2E] bg-[#18181B]/50 text-gray-400 font-medium">
              <th class="p-4">Reported Date</th>
              <th class="p-4">Reporter</th>
              <th class="p-4">Target Type</th>
              <th class="p-4">Category</th>
              <th class="p-4">Description</th>
              <th class="p-4">Status</th>
              <th class="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#2A2A2E]">
            <tr
              v-for="report in filteredReports"
              :key="report.id"
              class="hover:bg-[#18181B]/40 transition-colors"
            >
              <td class="p-4 text-gray-400 whitespace-nowrap">
                {{ report.createdAt }}
              </td>
              <td class="p-4">
                <div class="font-medium text-gray-200">{{ report.reporterUsername }}</div>
                <div class="text-[11px] text-gray-500">{{ report.reporterEmail }}</div>
              </td>
              <td class="p-4">
                <span class="px-2 py-0.5 rounded text-[10px] bg-[#1E1E24] text-gray-300 font-mono">
                  {{ getTargetType(report) }}
                </span>
              </td>
              <td class="p-4">
                <span class="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  {{ report.category }}
                </span>
              </td>
              <td class="p-4 max-w-xs truncate text-gray-300" :title="report.description">
                {{ report.description }}
              </td>
              <td class="p-4 whitespace-nowrap">
                <span
                  class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                  :class="report.isResolved ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'"
                >
                  {{ report.isResolved ? 'Resolved' : 'Pending Review' }}
                </span>
              </td>
              <td class="p-4 text-right whitespace-nowrap">
                <button
                  @click="toggleResolveStatus(report)"
                  :disabled="isUpdating"
                  class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  :class="report.isResolved ? 'bg-[#1E1E24] text-gray-400 hover:text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'"
                >
                  {{ report.isResolved ? 'Reopen' : 'Mark Resolved' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>