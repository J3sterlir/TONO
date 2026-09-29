<script setup lang="ts">
definePageMeta({
  layout: 'business',
  middleware: ['auth', 'business']
})

import { ref, onMounted } from 'vue'

const supabase = useSupabaseClient()
const db = supabase as any
const user = useSupabaseUser()
const { fetchCurrentUserProfile } = useTonoAuth()

const isLoading = ref(true)
const profilePicture = ref<string | null>(null)
const coverPicture = ref<string | null>(null)
const businessProfile = ref<any>(null)
const businessId = ref<string>('')

// Dashboard Metrics
const activeListingsCount = ref(0)
const applicationsCount = ref(0)
const openContractsCount = ref(0)

onMounted(async () => {
  try {
    const profile = await fetchCurrentUserProfile()
    if (profile) {
      profilePicture.value = profile.account?.Profile_Picture || null
      coverPicture.value = profile.account?.Cover_Picture || null
      businessProfile.value = profile.businessProfile || null
      businessId.value = profile.businessProfile?.BUSINESS_ID || ''
    }

    if (businessId.value) {
      await fetchMetrics()
    }
  } catch (err) {
    console.error('Error loading business dashboard data:', err)
  } finally {
    isLoading.value = false
  }
})

const fetchMetrics = async () => {
  try {
    // 1. Count active job listings
    const { data: listings } = await db
      .from('JOB_LISTING')
      .select('Job_ID, Status')
      .eq('Posted_By_BUSINESS_ID', businessId.value)

    const allListings = listings || []
    activeListingsCount.value = allListings.filter((l: any) => l.Status === 'Open').length

    // 2. Count pending applications for this business's jobs
    const jobIds = allListings.map((l: any) => l.Job_ID)
    if (jobIds.length > 0) {
      const { data: apps } = await db
        .from('APPLICATION')
        .select('Application_ID')
        .in('Job_ID', jobIds)
        .eq('Status', 'Pending')

      applicationsCount.value = apps?.length || 0
    }

    // 3. Count active / pending contracts for this business
    const { data: contracts } = await db
      .from('BOOKING_CONTRACT')
      .select('Booking_ID, Status')
      .eq('Provider_Business_ID', businessId.value)
      .in('Status', ['Pending_Artist_Approval', 'Pending', 'Active', 'Confirmed'])

    openContractsCount.value = contracts?.length || 0
  } catch (e) {
    console.error('Failed to fetch dashboard metrics:', e)
  }
}
</script>

<template>
  <div class="h-full text-white flex flex-col min-h-full pb-16 overflow-x-hidden font-Sora">
    <!-- Header Banner & Profile Info -->
    <div class="relative w-full overflow-hidden bg-[#131315] border-b border-[#46464D]/20">
      <!-- Background Banner Image -->
      <div class="absolute inset-0 z-0 bg-[#1E1E24]">
        <div v-if="isLoading" class="w-full h-full bg-[#1E1E24] animate-pulse"></div>
        <img
          v-else-if="coverPicture"
          :src="coverPicture"
          alt="Profile Cover"
          class="w-full h-full object-cover object-center opacity-70 mask-x-from-70% mask-x-to-90%" />
        <div v-else class="w-full h-full bg-linear-to-b from-[#1E1E24]/60 to-[#131315]"></div>
        <!-- Soft gradient overlay for contrast on both mobile and desktop -->
        <div
          class="absolute inset-0 bg-linear-to-t from-[#0E0E10] via-[#0E0E10]/40 to-transparent md:bg-linear-to-r md:from-[#0E0E10]/90 md:via-[#0E0E10]/60 md:to-transparent"
        ></div>
      </div>

      <!-- Loading Skeleton for Header -->
      <div
        v-if="isLoading"
        class="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-8 sm:py-10 min-h-75 md:min-h-85 flex flex-col-reverse md:flex-row items-center md:items-end justify-between gap-6 animate-pulse"
      >
        <div class="flex flex-col items-center md:items-start gap-3 w-full md:w-auto">
          <div class="h-4 w-24 bg-[#1E1E24] rounded-md"></div>
          <div class="h-10 sm:h-12 w-64 sm:w-80 max-w-full bg-[#1E1E24] rounded-xl"></div>
          <div class="h-4 w-48 sm:w-60 max-w-full bg-[#1E1E24] rounded-md"></div>
        </div>
        <div class="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[#1E1E24] border border-[#46464D]/30 shrink-0"></div>
      </div>

      <!-- Loaded Header Info -->
      <div
        v-else
        class="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-8 sm:py-10 min-h-75 md:min-h-85 flex flex-col-reverse md:flex-row items-center md:items-end justify-between gap-6"
      >
        <!-- Left: Details -->
        <div class="flex flex-col items-center md:items-start text-center md:text-left gap-1.5 min-w-0 max-w-full">
          <span class="text-xs font-mono uppercase tracking-wider text-[#D0D4F7]/90 font-medium">
            Business Suite
          </span>
          <h1 class="text-2xl sm:text-3xl font-semibold text-left text-[#e5e1e4]">
            {{ businessProfile?.Business_Name || 'Business Account' }}
          </h1>
          <p class="text-xs font-light text-left text-gray-300">
            {{ businessProfile?.Business_Service || 'Live Music & Entertainment' }}
          </p>
        </div>

        <!-- Right: Avatar -->
        <div class="flex flex-col justify-center items-center shrink-0">
          <div
            class="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[#353437] flex items-center justify-center text-gray-500 overflow-hidden shadow-2xl border-4 border-white/90 shrink-0">
            <!-- Avatar Image or Fallback Icon -->
            <img
              v-if="profilePicture"
              :src="profilePicture"
              alt="Profile Avatar"
              class="w-full h-full object-cover object-center" />
            <Icon
              v-else
              name="ic:outline-account-circle"
              class="w-full h-full text-[#46464D]" />
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <main class="max-w-7xl mx-auto w-full px-4 sm:px-8 md:px-16 mt-6 sm:mt-8">
      <!-- Loading Skeleton for Cards -->
      <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">
        <div v-for="i in 3" :key="i" class="h-28 rounded-2xl bg-[#1c1c1f] border border-[#2a2a2e]/40"></div>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- Card 1: Active job listings -->
        <div
          @click="navigateTo('/BusinessJobList')"
          class="flex flex-col justify-start items-start h-28 relative gap-3 p-5 rounded-2xl bg-[#1c1c1f] border border-[#2a2a2e]/40 hover:border-[#46464D] hover:bg-[#222226] transition-all cursor-pointer shadow-lg group"
        >
          <div class="flex justify-between items-center self-stretch relative">
            <p class="text-[13px] font-medium text-left text-[#c7c5ce] group-hover:text-white transition-colors">
              Active job listings
            </p>
            <div
              class="flex flex-col justify-center items-center h-8 w-8 relative rounded-lg bg-[#c4c6d2]/20"
            >
              <Icon name="mdi:briefcase-outline" class="text-lg text-[#C4C6D2]" />
            </div>
          </div>
          <p class="text-[28px] font-bold text-left text-[#c4c6d2] font-mono">
            {{ activeListingsCount }}
          </p>
        </div>

        <!-- Card 2: Job applications -->
        <div
          @click="navigateTo('/BusinessJobApp')"
          class="flex flex-col justify-start items-start h-28 relative gap-3 p-5 rounded-2xl bg-[#1c1c1f] border border-[#2a2a2e]/40 hover:border-[#46464D] hover:bg-[#222226] transition-all cursor-pointer shadow-lg group"
        >
          <div class="flex justify-between items-center self-stretch relative">
            <p class="text-[13px] font-medium text-left text-[#c7c5ce] group-hover:text-white transition-colors">
              Job applications
            </p>
            <div
              class="flex flex-col justify-center items-center h-8 w-8 relative rounded-lg bg-[#c4c6d2]/20"
            >
              <Icon name="mdi:clipboard-file-outline" class="text-lg text-[#C4C6D2]" />
            </div>
          </div>
          <p class="text-[28px] font-bold text-left text-[#c4c6d2] font-mono">
            {{ applicationsCount }}
          </p>
        </div>

        <!-- Card 3: Open contracts -->
        <div
          @click="navigateTo('/BusinessContracts')"
          class="flex flex-col justify-start items-start h-28 relative gap-3 p-5 rounded-2xl bg-[#1c1c1f] border border-[#2a2a2e]/40 hover:border-[#46464D] hover:bg-[#222226] transition-all cursor-pointer shadow-lg group"
        >
          <div class="flex justify-between items-center self-stretch relative">
            <p class="text-[13px] font-medium text-left text-[#c7c5ce] group-hover:text-white transition-colors">
              Open contracts
            </p>
            <div
              class="flex flex-col justify-center items-center h-8 w-8 relative rounded-lg bg-[#c4c6d2]/20"
            >
              <Icon name="mdi:file-multiple-outline" class="text-lg text-[#C4C6D2]" />
            </div>
          </div>
          <p class="text-[28px] font-bold text-left text-[#c4c6d2] font-mono">
            {{ openContractsCount }}
          </p>
        </div>
      </div>
    </main>
  </div>
</template>