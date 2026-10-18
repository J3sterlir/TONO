<script setup lang="ts">
import { computed } from 'vue'
import { formatTimeRange12 } from '~/utils/formatTime'

const props = defineProps<{
  isOpen: boolean
  contract: any | null
  canComplete?: boolean
  isCompleting?: boolean
  isReviewed?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'complete', contract: any): void
  (e: 'cancel', contract: any): void
  (e: 'rate', contract: any): void
}>()

useModalScrollLock(() => props.isOpen)

// Artist Display Helpers
const artistName = computed(() => {
  const c = props.contract
  if (!c) return 'Performing Artist'
  const artist = c.ARTIST
  if (!artist) return 'Performing Artist'
  return (
    artist.StageName?.[0]?.Artist_Name ||
    artist.BandName?.[0]?.Band_Name ||
    artist.USER_ACCOUNT?.Username ||
    'Artist'
  )
})

const artistUsername = computed(() => {
  return props.contract?.ARTIST?.USER_ACCOUNT?.Username || ''
})

const artistAvatar = computed(() => {
  return props.contract?.ARTIST?.USER_ACCOUNT?.Profile_Picture || null
})

const artistType = computed(() => {
  return props.contract?.ARTIST?.Artist_Type || 'Solo Artist'
})

// Parsed Song Lineup
interface SongItem {
  id: string
  title: string
  duration: string
  source: 'business' | 'artist'
}

const parsedSongs = computed<SongItem[]>(() => {
  const c = props.contract
  if (!c) return []

  if (Array.isArray(c.Song_Lineup_JSON) && c.Song_Lineup_JSON.length > 0) {
    return c.Song_Lineup_JSON.map((s: any, idx: number) => ({
      id: s.id || `s_${idx}`,
      title: s.title || '',
      duration: s.duration || '',
      source: s.source === 'artist' ? 'artist' : 'business'
    }))
  }

  if (c.Song_Lineup) {
    try {
      const parsed = typeof c.Song_Lineup === 'string' ? JSON.parse(c.Song_Lineup) : c.Song_Lineup
      if (Array.isArray(parsed)) {
        return parsed.map((s: any, idx: number) => ({
          id: s.id || `s_${idx}`,
          title: s.title || '',
          duration: s.duration || '',
          source: s.source === 'artist' ? 'artist' : 'business'
        }))
      }
    } catch {
      return String(c.Song_Lineup)
        .split(',')
        .map((title: string, idx: number) => ({
          id: `s_${idx}`,
          title: title.trim(),
          duration: '3:30',
          source: 'business' as const
        }))
    }
  }

  return []
})

// Status Styling
const statusConfig = computed(() => {
  const status = props.contract?.Status || 'Pending'
  switch (status) {
    case 'Confirmed':
    case 'Active':
      return {
        label: 'Active Agreement',
        colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        icon: 'ic:round-check-circle'
      }
    case 'Pending_Artist_Approval':
    case 'Pending':
      return {
        label: 'Awaiting Artist Approval',
        colorClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
        icon: 'ic:baseline-schedule'
      }
    case 'Completed':
      return {
        label: 'Completed Performance',
        colorClass: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
        icon: 'ic:round-check-circle'
      }
    case 'Cancelled':
      return {
        label: 'Contract Cancelled',
        colorClass: 'bg-red-500/10 text-red-300 border-red-500/30',
        icon: 'ic:baseline-cancel'
      }
    case 'Declined':
      return {
        label: 'Declined by Artist',
        colorClass: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
        icon: 'ic:round-cancel'
      }
    default:
      return {
        label: status,
        colorClass: 'bg-gray-500/10 text-gray-300 border-gray-500/30',
        icon: 'ic:baseline-info'
      }
  }
})
</script>

<template>
  <div
    v-if="isOpen && contract"
    class="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
  >
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
      @click="emit('close')"
    ></div>

    <!-- Modal Card -->
    <div
      class="relative w-full max-w-3xl bg-[#131315] border border-[#2A2A2E] rounded-2xl sm:rounded-3xl p-5 sm:p-8 flex flex-col max-h-[92dvh] sm:max-h-[88vh] text-white font-Sora z-10 my-auto shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
    >
      <!-- Header -->
      <div class="flex items-start justify-between gap-4 border-b border-[#2A2A2E] pb-4 shrink-0">
        <div class="space-y-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-mono font-bold text-[#D0D4F7] tracking-wider uppercase">
              {{ contract.Contract_Code }}
            </span>
            <span
              class="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border flex items-center gap-1"
              :class="statusConfig.colorClass"
            >
              <Icon :name="statusConfig.icon" class="text-xs" />
              <span>{{ statusConfig.label }}</span>
            </span>
            <span
              v-if="contract.Is_Rush_Booking"
              class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1"
            >
              <Icon name="ic:baseline-bolt" class="text-xs" />
              <span>5-Day Rush</span>
            </span>
          </div>
          <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {{ contract.JOB_LISTING?.Event_Title || 'Direct Booking Contract' }}
          </h2>
          <p class="text-xs text-gray-400">
            Booking Type: <span class="text-gray-200 font-medium">{{ contract.Booking_Type || (contract.Job_ID ? 'Job Listing' : 'Direct Booking') }}</span>
          </p>
        </div>

        <button
          type="button"
          @click="emit('close')"
          class="flex p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          aria-label="Close modal"
        >
          <Icon name="ic:round-close" class="text-xl" />
        </button>
      </div>

      <!-- Scrollable Body -->
      <div class="overflow-y-auto py-5 space-y-6 pr-1">

        <!-- Cancellation / Declined Notice Banner if applicable -->
        <div
          v-if="contract.Status === 'Cancelled' || contract.Status === 'Declined'"
          class="p-4 rounded-2xl border bg-red-950/20 border-red-500/30 text-xs space-y-2"
        >
          <div class="flex items-center gap-2 text-red-300 font-semibold text-sm">
            <Icon name="ic:baseline-cancel" class="text-lg shrink-0 text-red-400" />
            <span>{{ contract.Status === 'Declined' ? 'Contract Declined by Artist' : 'Contract Cancelled' }}</span>
          </div>
          <div class="pl-6 space-y-1">
            <p v-if="contract.Cancellation_Reason" class="text-gray-200">
              <span class="text-gray-400 font-mono">Reason:</span> {{ contract.Cancellation_Reason }}
            </p>
            <p v-else class="text-gray-400 italic">No cancellation reason provided.</p>
            <p v-if="contract.Is_Late_Cancellation" class="text-amber-300/90 font-mono text-[11px] flex items-center gap-1 pt-1">
              <Icon name="ic:baseline-warning" class="text-xs shrink-0 text-amber-400" />
              <span>Late Cancellation: Intercepted within 5 days of scheduled event.</span>
            </p>
          </div>
        </div>

        <!-- Artist Profile Card -->
        <div class="p-4 sm:p-5 rounded-2xl bg-[#1C1C1F]/90 border border-[#2A2A2E] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="w-13 h-13 rounded-full bg-[#2A2A2E] overflow-hidden shrink-0 border border-white/10 flex items-center justify-center">
              <img
                v-if="artistAvatar"
                :src="artistAvatar"
                :alt="artistName"
                class="w-full h-full object-cover"
              />
              <Icon v-else name="ic:baseline-person" class="text-2xl text-gray-400" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-bold text-white">{{ artistName }}</h3>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  {{ artistType }}
                </span>
              </div>
              <p v-if="artistUsername" class="text-xs text-gray-400 mt-0.5">@{{ artistUsername }}</p>
            </div>
          </div>

          <NuxtLink
            v-if="artistUsername"
            :to="`/artist/${artistUsername}`"
            target="_blank"
            class="px-3.5 py-1.5 rounded-full text-xs font-medium border border-[#46464D] hover:border-[#D0D4F7] text-gray-300 hover:text-white hover:bg-white/5 transition-all self-start sm:self-auto inline-flex items-center gap-1.5"
          >
            <span>View Artist Profile</span>
            <Icon name="ic:round-arrow-outward" class="text-xs text-[#D0D4F7]" />
          </NuxtLink>
        </div>

        <!-- Schedule & Financial Terms -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Schedule & Location -->
          <div class="p-4 rounded-2xl bg-[#1C1C1F]/60 border border-[#2A2A2E] space-y-3">
            <h4 class="text-xs font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Icon name="ic:baseline-calendar-today" class="text-sm text-[#D0D4F7]" />
              <span>Performance Schedule</span>
            </h4>
            <div class="space-y-2 text-xs">
              <div>
                <span class="text-gray-400 block text-[11px]">Event Date:</span>
                <span class="text-white font-medium">
                  {{ contract.Start_Date || contract.Event_Date }}
                  <span v-if="contract.End_Date && contract.End_Date !== (contract.Start_Date || contract.Event_Date)">
                    to {{ contract.End_Date }}
                  </span>
                </span>
              </div>
              <div>
                <span class="text-gray-400 block text-[11px]">Time Window:</span>
                <span class="text-white font-medium">
                  {{ formatTimeRange12(contract.Start_Time, contract.End_Time) || 'Time not specified' }}
                </span>
              </div>
              <div>
                <span class="text-gray-400 block text-[11px]">Venue Location:</span>
                <span class="text-white font-medium">{{ contract.Venue_Location || contract.JOB_LISTING?.Location || 'To be determined' }}</span>
              </div>
            </div>
          </div>

          <!-- Financial Terms & Platform Protection -->
          <div class="p-4 rounded-2xl bg-[#1C1C1F]/60 border border-[#2A2A2E] space-y-3 flex flex-col justify-between">
            <div class="space-y-3">
              <h4 class="text-xs font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Icon name="ic:baseline-payments" class="text-sm text-emerald-400" />
                <span>Agreed Compensation</span>
              </h4>
              <div>
                <span class="text-2xl font-bold font-mono text-emerald-400">
                  ₱{{ Number(contract.Agreed_Fee || 0).toLocaleString() }}
                </span>
                <span class="text-xs text-gray-400 block mt-0.5">Fixed performance honorarium</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Song Lineup / Setlist -->
        <div class="p-4 sm:p-5 rounded-2xl bg-[#1C1C1F]/60 border border-[#2A2A2E] space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Icon name="ic:baseline-queue-music" class="text-sm text-[#D0D4F7]" />
              <span>Agreed Song Lineup &amp; Setlist ({{ parsedSongs.length }})</span>
            </h4>
            <span v-if="parsedSongs.length" class="text-[11px] text-gray-400 font-mono">
              {{ parsedSongs.filter(s => s.source === 'business').length }} requested • {{ parsedSongs.filter(s => s.source === 'artist').length }} artist added
            </span>
          </div>

          <div v-if="parsedSongs.length === 0" class="py-4 text-center text-xs text-gray-400 italic">
            No specific song lineup requested. Performer will deliver a signature repertoire appropriate for the venue.
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="(song, idx) in parsedSongs"
              :key="song.id || idx"
              class="flex items-center justify-between p-2.5 rounded-xl bg-[#18181B] border border-[#2A2A2E] text-xs gap-3"
            >
              <div class="flex items-center gap-2.5 truncate">
                <span class="font-mono text-[11px] text-gray-500 w-5 shrink-0 text-right">{{ idx + 1 }}.</span>
                <span class="font-medium text-white truncate">{{ song.title }}</span>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <span v-if="song.duration" class="font-mono text-gray-400 text-[11px]">
                  {{ song.duration }}
                </span>
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-mono"
                  :class="song.source === 'artist' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'"
                >
                  {{ song.source === 'artist' ? 'Artist Added' : 'Business Requested' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Required Equipment (if any) -->
        <div v-if="contract.Required_Equipment" class="p-4 rounded-2xl bg-[#1C1C1F]/60 border border-[#2A2A2E] space-y-1.5 text-xs">
          <h4 class="font-mono uppercase text-gray-400 text-[11px] flex items-center gap-1.5">
            <Icon name="ic:baseline-speaker-group" class="text-sm text-[#D0D4F7]" />
            <span>Equipment &amp; Technical Requirements</span>
          </h4>
          <p class="text-gray-300 whitespace-pre-line">{{ contract.Required_Equipment }}</p>
        </div>

      </div>

      <!-- Footer Actions -->
      <div class="pt-4 border-t border-[#2A2A2E] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 text-xs">
        <span class="text-[11px] font-mono text-gray-500">
          Created: {{ contract.Created_at ? new Date(contract.Created_at).toLocaleDateString() : 'N/A' }}
        </span>

        <div class="flex items-center gap-2 flex-wrap w-full sm:w-auto sm:justify-end">
          <!-- Mark as Complete (if finished and active) -->
          <button
            v-if="canComplete"
            type="button"
            :disabled="isCompleting"
            @click="emit('complete', contract)"
            class="w-full sm:w-auto px-4 py-2 rounded-full border border-emerald-500/40 text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 transition-all cursor-pointer font-semibold flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Icon name="ic:round-check-circle" class="text-sm text-emerald-400" />
            <span>{{ isCompleting ? 'Completing...' : 'Mark as Completed' }}</span>
          </button>

          <!-- Rate Performer (if completed) -->
          <button
            v-else-if="contract.Status === 'Completed'"
            type="button"
            @click="emit('rate', contract)"
            class="w-full sm:w-auto px-4 py-2 rounded-full border border-amber-400/40 text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 transition-all cursor-pointer font-semibold flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Icon :name="isReviewed ? 'ic:round-check' : 'ic:round-star'" class="text-sm text-amber-400" />
            <span>{{ isReviewed ? 'Reviewed' : 'Rate Performer' }}</span>
          </button>

          <!-- Cancel / Withdraw (if not completed and not finished) -->
          <button
            v-else-if="!canComplete && ['Confirmed', 'Active', 'Pending_Artist_Approval', 'Pending'].includes(contract.Status) && !contract.Job_ID"
            type="button"
            @click="emit('cancel', contract)"
            class="w-full sm:w-auto px-3.5 py-2 rounded-full border border-red-500/30 text-red-300 hover:bg-red-500/10 hover:border-red-500/60 transition-all cursor-pointer flex items-center justify-center"
          >
            {{ ['Pending_Artist_Approval', 'Pending'].includes(contract.Status) ? 'Withdraw Offer' : 'Cancel Contract' }}
          </button>

          <button
            type="button"
            @click="emit('close')"
            class="w-full sm:w-auto px-4 py-2 rounded-full border border-[#46464D] hover:border-[#D0D4F7] text-gray-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
