<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    artistId: string
    isOwner?: boolean
  }>(),
  {
    isOwner: false
  }
)

const supabase = useSupabaseClient()
const db = supabase as any

// Calendar navigation state
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth()) // 0-indexed

const gigs = ref<any[]>([])
const isLoading = ref(true)

// Selected gig for modal
const selectedGig = ref<any | null>(null)
const isModalOpen = ref(false)
useModalScrollLock(isModalOpen)

// Proximity warning state for cancellations
const isWarningModalOpen = ref(false)

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const prevMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

const nextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

const fetchArtistGigs = async () => {
  if (!props.artistId) return
  isLoading.value = true
  try {
    const { data, error } = await db
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
        Song_Lineup,
        Song_Lineup_JSON,
        Required_Equipment,
        Status,
        Is_Rush_Booking,
        JOB_LISTING (
          Job_Code,
          Event_Title,
          Location,
          Description
        ),
        BUSINESS_PROFILE:Provider_Business_ID (
          Business_Name,
          Business_Address
        )
      `)
      .eq('Provider_Artist_ID', props.artistId)
      .in('Status', ['Confirmed', 'Active', 'Completed'])

    if (!error && data) {
      gigs.value = data
    }
  } catch (e) {
    console.error('Failed to fetch artist gigs for calendar:', e)
  } finally {
    isLoading.value = false
  }
}

// Compute calendar grid days
interface CalendarDay {
  date: Date
  dateStr: string
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
  gigs: any[]
}

const formatDateStr = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const calendarDays = computed(() => {
  const days: CalendarDay[] = []
  const todayStr = formatDateStr(new Date())

  const firstDayOfMonth = new Date(currentYear.value, currentMonth.value, 1)
  const lastDayOfMonth = new Date(currentYear.value, currentMonth.value + 1, 0)

  const startingDayOfWeek = firstDayOfMonth.getDay() // 0 = Sunday
  const daysInMonth = lastDayOfMonth.getDate()

  // Previous month padding days
  const prevMonthLastDay = new Date(currentYear.value, currentMonth.value, 0).getDate()
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(currentYear.value, currentMonth.value - 1, prevMonthLastDay - i)
    const dateStr = formatDateStr(d)
    days.push({
      date: d,
      dateStr,
      dayNumber: prevMonthLastDay - i,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      gigs: getGigsForDate(dateStr)
    })
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(currentYear.value, currentMonth.value, i)
    const dateStr = formatDateStr(d)
    days.push({
      date: d,
      dateStr,
      dayNumber: i,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      gigs: getGigsForDate(dateStr)
    })
  }

  // Next month padding days to complete 35 or 42 grid cells
  const remainingCells = (7 - (days.length % 7)) % 7
  for (let i = 1; i <= remainingCells; i++) {
    const d = new Date(currentYear.value, currentMonth.value + 1, i)
    const dateStr = formatDateStr(d)
    days.push({
      date: d,
      dateStr,
      dayNumber: i,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      gigs: getGigsForDate(dateStr)
    })
  }

  return days
})

const getGigsForDate = (dateStr: string) => {
  return gigs.value.filter(g => {
    const start = g.Start_Date || g.Event_Date
    const end = g.End_Date || start
    if (!start) return false
    return dateStr >= start && dateStr <= end
  })
}

const getGigTitle = (gig: any) => {
  return gig.JOB_LISTING?.Event_Title || gig.Contract_Code || 'Live Performance'
}

const handleChipClick = (gig: any) => {
  selectedGig.value = gig
  isModalOpen.value = true
}

const getSongList = (gig: any) => {
  if (Array.isArray(gig?.Song_Lineup_JSON)) return gig.Song_Lineup_JSON
  if (typeof gig?.Song_Lineup === 'string') {
    try {
      const parsed = JSON.parse(gig.Song_Lineup)
      if (Array.isArray(parsed)) return parsed
    } catch (e) {
      return gig.Song_Lineup.split(',').map((s: string) => ({ title: s.trim() }))
    }
  }
  return []
}

onMounted(() => {
  fetchArtistGigs()
})

watch(() => props.artistId, () => {
  fetchArtistGigs()
})
</script>

<template>
  <div class="w-full bg-[#131315] border border-[#2A2A2E]/80 rounded-2xl p-5 sm:p-7 space-y-6 font-Sora text-white shadow-xl">

    <!-- Calendar Header with Month Controls -->
    <div class="flex items-center justify-between gap-4">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold tracking-tight text-white">
          {{ monthNames[currentMonth] }} {{ currentYear }}
        </h2>
        <p class="text-xs text-gray-400 mt-0.5">
          {{ isOwner ? 'Your confirmed performance dates and bookings.' : 'Public gig schedule and tour dates.' }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="prevMonth"
          class="w-9 h-9 rounded-full bg-[#1C1C1F] border border-[#3A3A3C] hover:border-gray-400 text-gray-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          title="Previous Month"
        >
          <Icon name="ic:round-chevron-left" class="text-xl" />
        </button>
        <button
          type="button"
          @click="nextMonth"
          class="w-9 h-9 rounded-full bg-[#1C1C1F] border border-[#3A3A3C] hover:border-gray-400 text-gray-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          title="Next Month"
        >
          <Icon name="ic:round-chevron-right" class="text-xl" />
        </button>
      </div>
    </div>

    <!-- Day Headers -->
    <div class="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-mono font-semibold text-gray-400">
      <div v-for="day in daysOfWeek" :key="day" class="py-1">
        {{ day }}
      </div>
    </div>

    <!-- Calendar Grid -->
    <div class="grid grid-cols-7 gap-1 sm:gap-2">
      <div
        v-for="day in calendarDays"
        :key="day.dateStr"
        class="min-h-24 sm:min-h-28 p-1.5 sm:p-2 rounded-xl border transition-all flex flex-col justify-between"
        :class="[
          day.isCurrentMonth ? 'bg-[#18181B]/80 border-[#2A2A2E]' : 'bg-[#121214]/40 border-[#202024]/50 opacity-40',
          day.isToday ? 'ring-1 ring-[#D0D4F7]/60' : ''
        ]"
      >
        <!-- Day Number -->
        <div class="flex items-center justify-between text-xs">
          <span
            class="w-6 h-6 rounded-full flex items-center justify-center font-mono font-medium"
            :class="day.isToday ? 'bg-[#D0D4F7] text-[#0E0E10] font-bold' : 'text-gray-300'"
          >
            {{ day.dayNumber }}
          </span>
          <span v-if="day.gigs.length" class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse sm:hidden"></span>
        </div>

        <!-- Gig Chips Container -->
        <div class="space-y-1 mt-1 overflow-hidden">
          <div
            v-for="gig in day.gigs"
            :key="gig.Booking_ID"
            @click.stop="handleChipClick(gig)"
            class="px-2 py-1 rounded-md text-[10px] font-medium truncate cursor-pointer transition-all hover:scale-[1.02] shadow-sm flex items-center gap-1.5 group select-none"
            :class="isOwner ? 'bg-[#D0D4F7] text-[#0E0E10] hover:bg-white' : 'bg-[#B4B8DA] text-[#151A34] hover:bg-white'"
            :title="getGigTitle(gig)"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-current shrink-0"></span>
            <span class="truncate">{{ getGigTitle(gig) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- DETAILS MODAL: ROLE-BASED (PUBLIC VS ARTIST OWNER) -->
    <!-- ========================================================================= -->
    <div v-if="isModalOpen && selectedGig" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="isModalOpen = false"></div>

      <div
        class="relative w-full max-w-lg bg-[#131315] border border-[#2A2A2E]/80 rounded-2xl p-6 sm:p-7 space-y-5 text-white font-Sora z-10 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <!-- Modal Header -->
        <div class="flex items-start justify-between gap-4 border-b border-[#2A2A2E] pb-4">
          <div>
            <span class="text-[10px] font-mono text-[#D0D4F7] uppercase tracking-wider">
              {{ isOwner ? (selectedGig.Job_ID ? 'MARKETPLACE GIG CONTRACT' : 'DIRECT BOOKING CONTRACT') : 'LIVE EVENT DETAILS' }}
            </span>
            <h3 class="text-xl font-bold text-white mt-0.5">
              {{ getGigTitle(selectedGig) }}
            </h3>
          </div>
          <button
            type="button"
            @click="isModalOpen = false"
            class="text-gray-400 hover:text-white p-1 cursor-pointer"
          >
            <Icon name="ic:round-close" class="text-xl" />
          </button>
        </div>

        <!-- SHARED PUBLIC DETAILS: Date, Time, Venue -->
        <div class="space-y-3 text-xs">
          <div class="flex items-center gap-2 p-3 bg-[#1C1C1F] border border-[#2A2A2E] rounded-xl">
            <Icon name="ic:baseline-calendar-today" class="text-[#D0D4F7] text-base shrink-0" />
            <div>
              <p class="font-medium text-white">
                {{ selectedGig.Start_Date || selectedGig.Event_Date }}
                <span v-if="selectedGig.End_Date && selectedGig.End_Date !== selectedGig.Start_Date"> to {{ selectedGig.End_Date }}</span>
              </p>
              <p class="text-gray-400">{{ formatTimeRange12(selectedGig.Start_Time || '19:00', selectedGig.End_Time || '22:00') }}</p>
            </div>
          </div>

          <div class="flex items-center gap-2 p-3 bg-[#1C1C1F] border border-[#2A2A2E] rounded-xl">
            <Icon name="ic:baseline-location-on" class="text-[#D0D4F7] text-base shrink-0" />
            <div>
              <p class="font-medium text-white">{{ selectedGig.Venue_Location || selectedGig.JOB_LISTING?.Location || '' }}</p>
            </div>
          </div>
        </div>

        <!-- ===================================================================== -->
        <!-- ARTIST OWNER ONLY: Fee, Full Setlist, Technical Gear, Actions -->
        <!-- ===================================================================== -->
        <template v-if="isOwner">
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="p-3 bg-[#1C1C1F] border border-[#2A2A2E] rounded-xl">
              <span class="text-[10px] font-mono text-gray-400 uppercase">AGREED FEE</span>
              <p class="text-base font-bold text-emerald-400 font-mono mt-0.5">
                ₱{{ Number(selectedGig.Agreed_Fee || 0).toLocaleString() }}
              </p>
            </div>
            <div class="p-3 bg-[#1C1C1F] border border-[#2A2A2E] rounded-xl">
              <span class="text-[10px] font-mono text-gray-400 uppercase">CONTRACT CODE</span>
              <p class="text-xs font-mono text-[#D0D4F7] mt-1 truncate">
                {{ selectedGig.Contract_Code || 'BK-CONTRACT' }}
              </p>
            </div>
          </div>

          <!-- Setlist Preview -->
          <div v-if="getSongList(selectedGig).length" class="space-y-2 text-xs">
            <span class="text-[10px] font-mono text-gray-400 uppercase">CONFIRMED SETLIST</span>
            <div class="max-h-32 overflow-y-auto space-y-1 p-2 bg-[#141416] border border-[#2A2A2E] rounded-xl">
              <div
                v-for="(s, idx) in getSongList(selectedGig)"
                :key="idx"
                class="flex items-center justify-between text-[11px] py-1 px-1.5 border-b border-[#2A2A2E]/50 last:border-b-0"
              >
                <div class="flex items-center gap-1.5 truncate">
                  <span class="w-1 h-3 rounded-full" :class="s.source === 'business' ? 'bg-amber-400' : 'bg-[#D0D4F7]'"></span>
                  <span class="text-white truncate">{{ s.title }}</span>
                </div>
                <span class="text-gray-500 font-mono text-[10px] shrink-0">{{ s.duration || '03:30' }}</span>
              </div>
            </div>
          </div>

          <!-- Equipment Required -->
          <div v-if="selectedGig.Required_Equipment" class="text-xs space-y-1 p-3 bg-[#1C1C1F] border border-[#2A2A2E] rounded-xl">
            <span class="text-[10px] font-mono text-gray-400 uppercase">TECHNICAL EQUIPMENT</span>
            <p class="text-gray-300">{{ selectedGig.Required_Equipment }}</p>
          </div>
        </template>

        <!-- Modal Footer -->
        <div class="flex items-center justify-end pt-3 border-t border-[#2A2A2E]">
          <button
            type="button"
            @click="isModalOpen = false"
            class="px-5 py-2 rounded-full text-xs font-semibold bg-[#D0D4F7] text-[#0E0E10] hover:bg-white transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
