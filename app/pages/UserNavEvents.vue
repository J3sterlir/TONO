<script setup lang="ts">
definePageMeta({
  layout: 'user',
  middleware: 'auth'
})

import { ref, onMounted } from 'vue'

const supabase = useSupabaseClient()
const { fetchCurrentUserProfile } = useTonoAuth()

const isLoading = ref(true)
const selectedCategory = ref<'all' | 'gigs' | 'concerts' | 'openmic'>('all')

interface DemoEvent {
  id: string
  title: string
  venue: string
  city: string
  date: string
  month: string
  day: string
  time: string
  category: 'gigs' | 'concerts' | 'openmic'
  ticketPrice?: string
  status: 'Announced' | 'Upcoming' | 'Past'
}

// Sample initial event data for discovery hub
const events = ref<DemoEvent[]>([
  {
    id: '1',
    title: 'Indie Soundscapes Night',
    venue: 'SaGuijo Cafe & Bar',
    city: 'Makati City',
    date: '2026-10-15',
    month: 'OCT',
    day: '15',
    time: '8:00 PM',
    category: 'gigs',
    ticketPrice: '₱350',
    status: 'Upcoming'
  },
  {
    id: '2',
    title: 'Acoustic Soul Sessions',
    venue: '19 East Bar & Grill',
    city: 'Muntinlupa City',
    date: '2026-10-22',
    month: 'OCT',
    day: '22',
    time: '7:30 PM',
    category: 'concerts',
    ticketPrice: '₱500',
    status: 'Upcoming'
  },
  {
    id: '3',
    title: 'Local Musicians Open Mic Night',
    venue: 'Route 196 Revival',
    city: 'Quezon City',
    date: '2026-11-05',
    month: 'NOV',
    day: '05',
    time: '6:00 PM',
    category: 'openmic',
    ticketPrice: 'Free Entry',
    status: 'Announced'
  }
])

onMounted(async () => {
  try {
    const profile = await fetchCurrentUserProfile()
    if (profile?.artistProfile) {
      setPageLayout('artist')
    } else {
      setPageLayout('user')
    }
  } catch (error) {
    console.error('Error fetching profile:', error)
  } finally {
    isLoading.value = false
  }
})

const filteredEvents = computed(() => {
  if (selectedCategory.value === 'all') return events.value
  return events.value.filter(e => e.category === selectedCategory.value)
})
</script>

<template>
  <div class="h-full bg-[#0E0E10] text-white flex flex-col min-h-screen">
    <main class="max-w-7xl mx-auto w-full px-6 sm:px-10 py-10 flex flex-col gap-8">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#2A2A2E]">
        <div>
          <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-[#E5E1E4]">
            Live Music & Events
          </h1>
          <p class="text-sm text-gray-400 mt-2">
            Catch your favorite local acts live, discover gigs, and support local Filipino music venues.
          </p>
        </div>

        <!-- Filter Chips -->
        <div class="flex items-center gap-2">
          <button
            @click="selectedCategory = 'all'"
            class="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
            :class="selectedCategory === 'all' ? 'bg-[#D0D4F7] text-[#0E0E10] font-semibold' : 'bg-[#18181B] text-gray-400 hover:text-white border border-[#2A2A2E]'"
          >
            All Events
          </button>
          <button
            @click="selectedCategory = 'gigs'"
            class="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
            :class="selectedCategory === 'gigs' ? 'bg-[#D0D4F7] text-[#0E0E10] font-semibold' : 'bg-[#18181B] text-gray-400 hover:text-white border border-[#2A2A2E]'"
          >
            Club Gigs
          </button>
          <button
            @click="selectedCategory = 'concerts'"
            class="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
            :class="selectedCategory === 'concerts' ? 'bg-[#D0D4F7] text-[#0E0E10] font-semibold' : 'bg-[#18181B] text-gray-400 hover:text-white border border-[#2A2A2E]'"
          >
            Concerts
          </button>
          <button
            @click="selectedCategory = 'openmic'"
            class="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
            :class="selectedCategory === 'openmic' ? 'bg-[#D0D4F7] text-[#0E0E10] font-semibold' : 'bg-[#18181B] text-gray-400 hover:text-white border border-[#2A2A2E]'"
          >
            Open Mic
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="i in 3"
          :key="'event-skel-' + i"
          class="p-6 rounded-2xl bg-[#131315] border border-[#2A2A2E] animate-pulse flex flex-col gap-4"
        >
          <div class="h-6 w-3/4 bg-[#2A2A32] rounded"></div>
          <div class="h-4 w-1/2 bg-[#1E1E24] rounded"></div>
          <div class="h-10 bg-[#1E1E24] rounded mt-2"></div>
        </div>
      </div>

      <!-- Events List -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="event in filteredEvents"
          :key="event.id"
          class="p-6 rounded-2xl bg-[#131315] border border-[#2A2A2E] hover:border-[#46464D] transition-all flex flex-col justify-between"
        >
          <div>
            <div class="flex items-start justify-between gap-4 mb-4">
              <!-- Date Badge -->
              <div class="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[#D0D4F7] shrink-0">
                <span class="text-[10px] font-bold tracking-wider uppercase">{{ event.month }}</span>
                <span class="text-xl font-bold leading-tight">{{ event.day }}</span>
              </div>

              <!-- Status Badge -->
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {{ event.status }}
              </span>
            </div>

            <!-- Title & Info -->
            <h3 class="text-lg font-bold text-gray-100 mb-1">
              {{ event.title }}
            </h3>

            <div class="flex flex-col gap-1.5 text-xs text-gray-400 mt-3">
              <span class="flex items-center gap-2">
                <Icon name="ic:baseline-storefront" class="text-sm text-[#D0D4F7]" />
                {{ event.venue }}
              </span>
              <span class="flex items-center gap-2">
                <Icon name="ic:baseline-location-on" class="text-sm text-gray-500" />
                {{ event.city }}
              </span>
              <span class="flex items-center gap-2">
                <Icon name="ic:baseline-access-time" class="text-sm text-gray-500" />
                {{ event.time }}
              </span>
            </div>
          </div>

          <!-- Footer & Action -->
          <div class="mt-6 pt-4 border-t border-[#2A2A2E] flex items-center justify-between">
            <span class="text-xs font-semibold text-gray-300">
              {{ event.ticketPrice }}
            </span>
            <button
              class="px-4 py-1.5 rounded-xl bg-[#1E1E24] hover:bg-[#D0D4F7] text-gray-300 hover:text-[#0E0E10] text-xs font-medium transition-all"
            >
              Details
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>