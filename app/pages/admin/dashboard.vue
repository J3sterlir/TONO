<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({
  layout: 'admin',
  middleware: 'admin'
})

const { signOutAdmin, fetchCurrentAdmin } = useAdminAuth()
const supabase = useSupabaseClient()
const db = supabase as any

const handleLogout = async () => {
  await signOutAdmin()
}

// Admin profile
const adminProfile = await fetchCurrentAdmin()

// Dashboard State
const isLoading = ref(true)
const reportsCount = ref(0)
const unverifiedArtistsCount = ref(0)
const totalUsersCount = ref(0)

// Quick Views State
const recentReports = ref<any[]>([])
const recentAccounts = ref<any[]>([])
const pendingArtists = ref<any[]>([])
const recentTags = ref<any[]>([])

// Relative Time Formatter Helper
const formatRelativeTime = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'Recently'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'Recently'

  const diff = Date.now() - date.getTime()
  if (diff < 0) return 'Just now'

  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Fetch all dashboard data in parallel
const fetchDashboardData = async () => {
  isLoading.value = true
  try {
    const [
      reportsCountRes,
      unverifiedArtistsCountRes,
      totalUsersCountRes,
      reportsDataRes,
      accountsDataRes,
      artistsDataRes,
      tagsDataRes
    ] = await Promise.all([
      // 1. Metric: Reports to resolve (USER_REPORT where Is_Resolved = false)
      db.from('USER_REPORT').select('*', { count: 'exact', head: true }).eq('Is_Resolved', false),

      // 2. Metric: Artists to verify (ARTIST where Is_Verified = false and Status = 'Pending')
      db.from('ARTIST').select('*', { count: 'exact', head: true }).eq('Is_Verified', false).eq('Status', 'Pending'),

      // 3. Metric: Total users (USER_ACCOUNT exact count)
      db.from('USER_ACCOUNT').select('*', { count: 'exact', head: true }),

      // 4. Quick View: Recent unresolved reports (Top 4)
      db.from('USER_REPORT')
        .select(`
          Report_ID,
          Category,
          Description,
          Created_At,
          Is_Resolved,
          USER_ACCOUNT ( Username )
        `)
        .eq('Is_Resolved', false)
        .order('Created_At', { ascending: false })
        .limit(4),

      // 5. Quick View: Recent registered user accounts (Top 4)
      db.from('USER_ACCOUNT')
        .select('ACCOUNT_ID, Username, Email, Created_at, Profile_Picture')
        .order('Created_at', { ascending: false })
        .limit(4),

      // 6. Quick View: Pending verification artists (Top 4)
      db.from('ARTIST')
        .select(`
          ARTIST_ID,
          Artist_Type,
          Status,
          Is_Verified,
          Created_at,
          USER_ACCOUNT ( Username, Email, Profile_Picture ),
          SOLO_ARTIST ( Artist_Name ),
          BAND ( Band_Name )
        `)
        .eq('Is_Verified', false)
        .eq('Status', 'Pending')
        .order('Created_at', { ascending: false })
        .limit(4),

      // 7. Quick View: Recent community tag submissions from TAG_REQUEST
      db.from('TAG_REQUEST')
        .select(`
          Request_ID,
          Tag_Name,
          Type,
          Status,
          Created_at,
          USER_ACCOUNT ( Username )
        `)
        .order('Created_at', { ascending: false })
        .limit(4)
    ])

    // Assign counts
    reportsCount.value = reportsCountRes.count ?? 0
    unverifiedArtistsCount.value = unverifiedArtistsCountRes.count ?? 0
    totalUsersCount.value = totalUsersCountRes.count ?? 0

    // Assign recent reports
    if (reportsDataRes.data) {
      recentReports.value = reportsDataRes.data.map((r: any) => {
        const username = r.USER_ACCOUNT ? (Array.isArray(r.USER_ACCOUNT) ? r.USER_ACCOUNT[0]?.Username : r.USER_ACCOUNT?.Username) : null
        return {
          id: r.Report_ID,
          category: r.Category || 'General',
          description: r.Description || '',
          reporter: username || 'Anonymous User',
          time: formatRelativeTime(r.Created_At),
          resolved: r.Is_Resolved
        }
      })
    }

    // Assign recent accounts
    if (accountsDataRes.data) {
      recentAccounts.value = accountsDataRes.data.map((u: any) => {
        const initials = (u.Username || 'U').slice(0, 2).toUpperCase()
        return {
          id: u.ACCOUNT_ID,
          username: u.Username || 'Anonymous',
          email: u.Email || '',
          avatar: u.Profile_Picture || `https://placehold.co/100x100/2A2F4A/FFF?text=${initials}`,
          time: formatRelativeTime(u.Created_at)
        }
      })
    }

    // Assign verification queue
    if (artistsDataRes.data) {
      pendingArtists.value = artistsDataRes.data.map((a: any) => {
        const userAcc = a.USER_ACCOUNT ? (Array.isArray(a.USER_ACCOUNT) ? a.USER_ACCOUNT[0] : a.USER_ACCOUNT) : null
        const isSolo = a.Artist_Type === 'Solo'
        const soloData = isSolo && a.SOLO_ARTIST ? (Array.isArray(a.SOLO_ARTIST) ? a.SOLO_ARTIST[0] : a.SOLO_ARTIST) : null
        const bandData = !isSolo && a.BAND ? (Array.isArray(a.BAND) ? a.BAND[0] : a.BAND) : null
        const displayName = isSolo ? (soloData?.Artist_Name || userAcc?.Username) : (bandData?.Band_Name || userAcc?.Username)
        const initials = (displayName || 'A').slice(0, 2).toUpperCase()

        return {
          id: a.ARTIST_ID,
          name: displayName || 'Artist',
          username: userAcc?.Username || '',
          email: userAcc?.Email || '',
          artistType: a.Artist_Type || 'Solo',
          avatar: userAcc?.Profile_Picture || `https://placehold.co/100x100/2A2F4A/FFF?text=${initials}`,
          time: formatRelativeTime(a.Created_at)
        }
      })
    }

    // Assign tag requests (if table exists)
    if (tagsDataRes.data) {
      recentTags.value = tagsDataRes.data.map((t: any) => {
        const username = t.USER_ACCOUNT ? (Array.isArray(t.USER_ACCOUNT) ? t.USER_ACCOUNT[0]?.Username : t.USER_ACCOUNT?.Username) : null
        return {
          id: t.Request_ID,
          name: t.Tag_Name,
          type: t.Type,
          status: t.Status,
          requester: username || 'User',
          time: formatRelativeTime(t.Created_at)
        }
      })
    }
  } catch (error) {
    console.error('Error loading dashboard data:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchDashboardData()
})
</script>

<template>
  <div>
    <nav class="flex items-center px-16 h-20 border-b border-[#46464D] top-0 sticky backdrop-blur-3xl z-10">
      <h1 class="text-[#D0D4F7] text-[24px] font-medium">Welcome Back Admin!</h1>
    </nav>
    <main class="p-8 lg:p-16">
      <!-- Metric Counters Row -->
      <div class="flex flex-wrap justify-start gap-6 text-[1.2rem] font-Geist">

        <!-- 1. Reports To Resolve -->
        <NuxtLink to="/admin/reports"
          class="flex justify-between border rounded-xl border-[#2A2A2E]/50 hover:border-rose-500/40 w-[282.66px] h-36.5 px-6 bg-[#1C1C1F]/60 transition-all group cursor-pointer">
          <div class="flex flex-col justify-center">
            <h1 class="text-base text-zinc-300 group-hover:text-white transition-colors">Reports To Resolve</h1>
            <h1 v-if="isLoading" class="text-[36px] text-[#FFB4AB] animate-pulse">...</h1>
            <h1 v-else class="text-[36px] font-bold text-[#FFB4AB]">{{ reportsCount }}</h1>
          </div>
          <div class="flex justify-center items-center">
            <div class="flex p-2 rounded-lg bg-[#93000A]/20 group-hover:bg-[#93000A]/30 transition-colors">
              <Icon name="ic:baseline-warning" class="text-[36px] text-[#FFB4AB]" />
            </div>
          </div>
        </NuxtLink>

        <!-- 2. Artist To Verify -->
        <NuxtLink to="/admin/verifications"
          class="flex justify-between border rounded-xl border-[#2A2A2E]/50 hover:border-[#D0D4F7]/40 w-[282.66px] h-36.5 px-6 bg-[#1C1C1F]/60 transition-all group cursor-pointer">
          <div class="flex flex-col justify-center">
            <h1 class="text-base text-zinc-300 group-hover:text-white transition-colors">Artist To Verify</h1>
            <h1 v-if="isLoading" class="text-[36px] text-[#D0D4F7] animate-pulse">...</h1>
            <h1 v-else class="text-[36px] font-bold text-[#D0D4F7]">{{ unverifiedArtistsCount }}</h1>
          </div>
          <div class="flex justify-center items-center">
            <div class="flex p-2 rounded-lg bg-[#D0D4F7]/20 group-hover:bg-[#D0D4F7]/30 transition-colors">
              <Icon name="ic:round-check-circle" class="text-[36px] text-[#D0D4F7]" />
            </div>
          </div>
        </NuxtLink>

        <!-- 3. Total Users -->
        <NuxtLink to="/admin/users"
          class="flex justify-between border rounded-xl border-[#2A2A2E]/50 hover:border-[#D0D4F7]/40 w-[282.66px] h-36.5 px-6 bg-[#1C1C1F]/60 transition-all group cursor-pointer">
          <div class="flex flex-col justify-center">
            <h1 class="text-base text-zinc-300 group-hover:text-white transition-colors">Total Users</h1>
            <h1 v-if="isLoading" class="text-[36px] text-[#D0D4F7] animate-pulse">...</h1>
            <h1 v-else class="text-[36px] font-bold text-[#D0D4F7]">{{ totalUsersCount }}</h1>
          </div>
          <div class="flex justify-center items-center">
            <div class="flex p-2 rounded-lg bg-[#D0D4F7]/20 group-hover:bg-[#D0D4F7]/30 transition-colors">
              <Icon name="ic:outline-person" class="text-[36px] text-[#D0D4F7]" />
            </div>
          </div>
        </NuxtLink>
      </div>

      <!-- Quick Views Grid -->
      <div class="grid grid-cols-12 gap-6 mt-10">

        <!-- 1. Recent Reports (Col 8) -->
        <div
          class="col-span-12 xl:col-span-8 bg-[#1C1C1F]/60 border border-[#2A2A2E]/50 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div class="flex justify-between items-center mb-6">
              <h1 class="font-bold text-lg text-white">Recent Reports</h1>
              <NuxtLink to="/admin/reports"
                class="text-xs font-semibold text-[#D0D4F7] hover:underline flex items-center gap-1 transition">
                <span>View All</span>
                <Icon name="ic:baseline-arrow-forward" class="text-sm" />
              </NuxtLink>
            </div>

            <!-- Loading Skeleton -->
            <div v-if="isLoading" class="flex flex-col gap-3">
              <div v-for="n in 3" :key="n" class="h-16 bg-[#1B1B1D] rounded-lg animate-pulse"></div>
            </div>

            <!-- Empty State -->
            <div v-else-if="recentReports.length === 0"
              class="py-12 text-center flex flex-col items-center justify-center text-zinc-500">
              <Icon name="ic:baseline-check-circle-outline" class="text-4xl text-emerald-400 mb-2" />
              <p class="text-sm font-medium text-zinc-300">All caught up!</p>
              <p class="text-xs text-zinc-500 mt-0.5">No pending reports require resolution.</p>
            </div>

            <!-- Feed Items -->
            <div v-else class="flex flex-col gap-3">
              <NuxtLink v-for="report in recentReports" :key="report.id" to="/admin/reports"
                class="bg-[#1B1B1D] hover:bg-[#232328] p-4 rounded-lg flex items-center justify-between transition-colors border border-transparent hover:border-zinc-700/50 group">
                <div class="flex items-center gap-3.5 min-w-0">
                  <div class="p-2 rounded-lg bg-rose-500/10 text-rose-400 shrink-0">
                    <Icon name="ic:baseline-report-problem" class="text-xl" />
                  </div>
                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-[14px] text-zinc-100 truncate">{{ report.category }}</span>
                      <span
                        class="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-semibold uppercase">Pending</span>
                    </div>
                    <p class="text-xs text-zinc-400 truncate mt-0.5">{{ report.description }}</p>
                    <span class="text-[11px] text-zinc-500 mt-1">Reported by <strong
                        class="text-zinc-400 font-medium">{{ report.reporter }}</strong> • {{ report.time }}</span>
                  </div>
                </div>
                <Icon name="ic:baseline-chevron-right"
                  class="text-zinc-500 group-hover:text-zinc-200 text-xl transition-colors shrink-0" />
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- 2. Recent Accounts (Col 4) -->
        <div
          class="col-span-12 xl:col-span-4 bg-[#1C1C1F]/60 border border-[#2A2A2E]/50 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div class="flex justify-between items-center mb-6">
              <h1 class="font-bold text-lg text-white">Recent Accounts</h1>
              <NuxtLink to="/admin/users"
                class="text-xs font-semibold text-[#D0D4F7] hover:underline flex items-center gap-1 transition">
                <span>View All</span>
                <Icon name="ic:baseline-arrow-forward" class="text-sm" />
              </NuxtLink>
            </div>

            <!-- Loading Skeleton -->
            <div v-if="isLoading" class="flex flex-col gap-3">
              <div v-for="n in 3" :key="n" class="h-16 bg-[#1B1B1D] rounded-lg animate-pulse"></div>
            </div>

            <!-- Empty State -->
            <div v-else-if="recentAccounts.length === 0" class="py-12 text-center text-zinc-500">
              <p class="text-sm">No recent user accounts found.</p>
            </div>

            <!-- Feed Items -->
            <div v-else class="flex flex-col gap-3">
              <NuxtLink v-for="user in recentAccounts" :key="user.id" to="/admin/users"
                class="bg-[#1B1B1D] hover:bg-[#232328] p-3.5 rounded-lg flex items-center justify-between transition-colors border border-transparent hover:border-zinc-700/50 group">
                <div class="flex items-center gap-3 min-w-0">
                  <img :src="user.avatar" :alt="user.username"
                    class="w-10 h-10 rounded-lg object-cover bg-zinc-800 shrink-0" />
                  <div class="flex flex-col min-w-0">
                    <h1 class="font-bold text-[14px] text-zinc-100 truncate">{{ user.username }}</h1>
                    <h2 class="text-xs text-zinc-400 truncate">{{ user.email }}</h2>
                  </div>
                </div>
                <span class="text-[11px] text-zinc-500 whitespace-nowrap shrink-0">{{ user.time }}</span>
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- 3. Verification Queue (Col 5) -->
        <div
          class="col-span-12 xl:col-span-5 bg-[#1C1C1F]/60 border border-[#2A2A2E]/50 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div class="flex justify-between items-center mb-6">
              <h1 class="font-bold text-lg text-white">Verification Queue</h1>
              <NuxtLink to="/admin/verifications"
                class="text-[#2A2F4A] bg-[#D0D4F7] hover:bg-[#B0B4D7] px-2.5 py-1 text-[11px] rounded-full font-bold transition flex items-center gap-1">
                <span>{{ unverifiedArtistsCount }} PENDING</span>
              </NuxtLink>
            </div>

            <!-- Loading Skeleton -->
            <div v-if="isLoading" class="flex flex-col gap-3">
              <div v-for="n in 3" :key="n" class="h-16 bg-[#1B1B1D] rounded-lg animate-pulse"></div>
            </div>

            <!-- Empty State -->
            <div v-else-if="pendingArtists.length === 0"
              class="py-12 text-center flex flex-col items-center justify-center text-zinc-500">
              <Icon name="ic:baseline-verified" class="text-4xl text-[#D0D4F7] mb-2" />
              <p class="text-sm font-medium text-zinc-300">Queue is clear</p>
              <p class="text-xs text-zinc-500 mt-0.5">No artist verification applications pending.</p>
            </div>

            <!-- Feed Items -->
            <div v-else class="flex flex-col gap-3">
              <div v-for="artist in pendingArtists" :key="artist.id"
                class="bg-[#1B1B1D] p-3.5 rounded-lg flex items-center justify-between border border-transparent hover:border-zinc-700/50 transition-colors">
                <div class="flex items-center gap-3 min-w-0">
                  <img :src="artist.avatar" :alt="artist.name"
                    class="w-10 h-10 rounded-lg object-cover bg-zinc-800 shrink-0" />
                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-[14px] text-zinc-100 truncate">{{ artist.name }}</span>
                      <span class="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        {{ artist.artistType }}
                      </span>
                    </div>
                    <span class="text-[11px] text-zinc-500 mt-0.5">Applied {{ artist.time }}</span>
                  </div>
                </div>
                <NuxtLink to="/admin/verifications"
                  class="px-3 py-1.5 bg-[#D0D4F7]/10 hover:bg-[#D0D4F7]/20 text-[#D0D4F7] border border-[#D0D4F7]/30 rounded-lg text-xs font-medium transition whitespace-nowrap">
                  Review
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Tag Management (Col 7) -->
        <div
          class="col-span-12 xl:col-span-7 bg-[#1C1C1F]/60 border border-[#2A2A2E]/50 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div class="flex flex-wrap justify-between items-center gap-2 mb-6">
              <h1 class="font-bold text-lg text-white">Tag Management</h1>
              <div class="flex gap-2 items-center">
                <NuxtLink to="/admin/tags"
                  class="flex items-center gap-1.5 px-3 py-1 text-[#D0D4F7] hover:text-white border border-[#D0D4F7]/30 hover:border-[#D0D4F7] rounded-full transition text-xs font-semibold">
                  <Icon name="ic:baseline-plus" class="text-base" />
                  <span>Add New</span>
                </NuxtLink>

                <NuxtLink to="/admin/tags"
                  class="flex items-center gap-1.5 px-3 py-1 bg-[#D0D4F7] hover:bg-[#B0B4D7] text-[#2A2F4A] rounded-full transition text-xs font-semibold">
                  <Icon name="ic:round-check-circle" class="text-base" />
                  <span>Verify Customs</span>
                </NuxtLink>
              </div>
            </div>

            <!-- Loading Skeleton -->
            <div v-if="isLoading" class="flex flex-col gap-3">
              <div v-for="n in 3" :key="n" class="h-16 bg-[#1B1B1D] rounded-lg animate-pulse"></div>
            </div>

            <!-- Empty State -->
            <div v-else-if="recentTags.length === 0"
              class="py-12 text-center flex flex-col items-center justify-center text-zinc-500">
              <Icon name="ic:baseline-label" class="text-4xl text-zinc-600 mb-2" />
              <p class="text-sm font-medium text-zinc-300">No custom tag submissions yet</p>
              <p class="text-xs text-zinc-500 mt-0.5">Community requested genre or instrument tags will appear here.</p>
              <NuxtLink to="/admin/tags" class="mt-3 text-xs text-[#D0D4F7] hover:underline">Manage all platform tags
                &rarr;</NuxtLink>
            </div>

            <!-- Feed Items -->
            <div v-else class="flex flex-col gap-3">
              <div v-for="tag in recentTags" :key="tag.id"
                class="bg-[#1B1B1D] p-3.5 rounded-lg flex items-center justify-between border border-transparent hover:border-zinc-700/50 transition-colors">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="p-2 rounded-lg bg-[#D0D4F7]/10 text-[#D0D4F7] shrink-0">
                    <Icon name="ic:baseline-new-label" class="text-xl" />
                  </div>
                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-[14px] text-zinc-100 truncate">{{ tag.name }}</span>
                      <span class="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        :class="tag.type === 'Genre' ? 'bg-[#D0D4F7]/10 text-[#D0D4F7] border border-[#D0D4F7]/25' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'">
                        {{ tag.type }}
                      </span>
                    </div>
                    <span class="text-[11px] text-zinc-500 mt-0.5">Requested by <strong
                        class="text-zinc-400 font-medium">{{ tag.requester }}</strong> • {{ tag.time }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-[11px] font-semibold px-2 py-0.5 rounded"
                    :class="tag.status === 'Accepted' ? 'bg-emerald-500/10 text-emerald-400' : (tag.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400')">
                    {{ tag.status }}
                  </span>
                  <NuxtLink to="/admin/tags" class="p-1.5 text-zinc-400 hover:text-white rounded transition"
                    title="Manage in Tags page">
                    <Icon name="ic:baseline-arrow-forward" class="text-base" />
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>
  </div>
</template>