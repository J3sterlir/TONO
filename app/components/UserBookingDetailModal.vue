<script setup lang="ts">
import { ref, computed, watch, type PropType } from 'vue'
import { formatTime12, formatTimeRange12 } from '~/utils/formatTime'
import { useTonoEvents } from '~/composables/useTonoEvents'

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  booking: {
    type: Object as PropType<any>,
    default: null
  },
  currentAccountId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'updated', 'cancel', 'complete', 'review'])

useModalScrollLock(() => Boolean(props.isOpen))

const supabase = useSupabaseClient()
const db = supabase as any
const { isEventFinished, isEventHappeningNow } = useTonoEvents()

const isSaving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Form State for Direct Bookings
const editVenue = ref('')
const editIsMultipleDays = ref(false)
const editStartDate = ref('')
const editEndDate = ref('')
const editStartTime = ref('19:00')
const editEndTime = ref('22:00')
const editFee = ref<number | null>(null)
const editDescription = ref('')
const editEquipment = ref('')

interface SongItem {
  id: string
  title: string
  duration: string
  source?: 'business' | 'artist' | 'requester'
}
const editSongLineup = ref<SongItem[]>([])

const isDirectBooking = computed(() => {
  return props.booking && !props.booking.Job_ID
})

const isEditable = computed(() => {
  if (!props.booking || !isDirectBooking.value) return false
  if (isEventFinished(props.booking)) return false
  return ['Pending_Artist_Approval', 'Pending', 'Confirmed', 'Active'].includes(props.booking.Status)
})

// Calculate days to event start for 5-day proximity warning
const daysToEvent = computed(() => {
  if (!props.booking) return 999
  const dateStr = editStartDate.value || props.booking.Start_Date || props.booking.Event_Date
  if (!dateStr) return 999
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
})

const isWithin5Days = computed(() => daysToEvent.value <= 5)

// Parse initial booking into edit state
const populateForm = () => {
  if (!props.booking) return
  errorMessage.value = ''
  successMessage.value = ''

  editVenue.value = props.booking.Venue_Location || props.booking.JOB_LISTING?.Location || ''
  editStartDate.value = props.booking.Start_Date || props.booking.Event_Date || ''
  editEndDate.value = props.booking.End_Date || props.booking.Start_Date || props.booking.Event_Date || ''
  editIsMultipleDays.value = editStartDate.value !== editEndDate.value
  editStartTime.value = props.booking.Start_Time || '19:00'
  editEndTime.value = props.booking.End_Time || '22:00'
  editFee.value = props.booking.Agreed_Fee ? Number(props.booking.Agreed_Fee) : null
  editDescription.value = props.booking.Description || props.booking.JOB_LISTING?.Description || ''
  editEquipment.value = props.booking.Required_Equipment || ''

  // Parse song lineup
  let parsed: SongItem[] = []
  if (Array.isArray(props.booking.Song_Lineup_JSON) && props.booking.Song_Lineup_JSON.length) {
    parsed = props.booking.Song_Lineup_JSON
  } else if (props.booking.Song_Lineup) {
    try {
      const json = typeof props.booking.Song_Lineup === 'string' ? JSON.parse(props.booking.Song_Lineup) : props.booking.Song_Lineup
      if (Array.isArray(json)) parsed = json
    } catch {
      parsed = String(props.booking.Song_Lineup).split(',').map((s: string, idx: number) => ({
        id: `song_${idx}`,
        title: s.trim(),
        duration: '03:30',
        source: 'requester'
      }))
    }
  }

  editSongLineup.value = parsed.map((s, idx) => ({
    id: s.id || `song_${idx}`,
    title: s.title || '',
    duration: s.duration || '03:30',
    source: s.source || 'requester'
  }))
}

watch(() => [props.isOpen, props.booking], () => {
  if (props.isOpen && props.booking) {
    populateForm()
  }
}, { immediate: true })

watch(editStartDate, (newStart) => {
  if (!editIsMultipleDays.value) {
    editEndDate.value = newStart
  } else if (editEndDate.value && editEndDate.value < newStart) {
    editEndDate.value = newStart
  }
})

watch(editIsMultipleDays, (multi) => {
  if (!multi) {
    editEndDate.value = editStartDate.value
  }
})

const addSong = () => {
  editSongLineup.value.push({
    id: `req_song_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    title: '',
    duration: '03:30',
    source: 'requester'
  })
}

const removeSong = (index: number) => {
  editSongLineup.value.splice(index, 1)
}

const getArtistDisplayName = (artist: any) => {
  if (!artist) return 'Performing Artist'
  return artist.BandName?.Band_Name || artist.StageName?.Artist_Name || artist.USER_ACCOUNT?.Username || 'Artist'
}

const getArtistAvatar = (artist: any) => {
  return artist?.USER_ACCOUNT?.Profile_Picture || null
}

const handleSaveBookingEdits = async () => {
  if (!props.booking) return
  if (!editVenue.value.trim()) {
    errorMessage.value = 'Please enter a venue location.'
    return
  }
  if (!editStartDate.value) {
    errorMessage.value = 'Please select a start date.'
    return
  }
  if (editStartTime.value >= editEndTime.value) {
    errorMessage.value = 'End time must be later than start time.'
    return
  }

  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  const finalEndDate = editIsMultipleDays.value && editEndDate.value ? editEndDate.value : editStartDate.value
  const artistId = props.booking.ARTIST?.ARTIST_ID || props.booking.Provider_Artist_ID

  try {
    // 1. Conflict Check: Verify artist doesn't have another gig or custom activity at this new time slot
    if (artistId) {
      // Check active booking contracts
      const { data: conflictContracts } = await db
        .from('BOOKING_CONTRACT')
        .select('Booking_ID, Start_Time, End_Time')
        .eq('Provider_Artist_ID', artistId)
        .neq('Booking_ID', props.booking.Booking_ID)
        .eq('Start_Date', editStartDate.value)
        .in('Status', ['Confirmed', 'Active', 'Pending_Artist_Approval'])

      const hasContractConflict = (conflictContracts || []).some((c: any) => {
        return editStartTime.value < (c.End_Time || '23:59') && editEndTime.value > (c.Start_Time || '00:00')
      })

      if (hasContractConflict) {
        throw new Error('The artist has another booking during this time slot. Please choose another time or date.')
      }

      // Check artist custom schedule activities
      const { data: conflictSchedule } = await db
        .from('ARTIST_CUSTOM_SCHEDULE')
        .select('Schedule_ID, Start_Time, End_Time')
        .eq('Artist_ID', artistId)
        .lte('Start_Date', editStartDate.value)
        .gte('End_Date', editStartDate.value)

      const hasScheduleConflict = (conflictSchedule || []).some((s: any) => {
        return editStartTime.value < (s.End_Time || '23:59') && editEndTime.value > (s.Start_Time || '00:00')
      })

      if (hasScheduleConflict) {
        throw new Error('The artist is unavailable during this time slot due to a scheduled activity. Please choose another time or date.')
      }
    }

    // 2. Perform Update on BOOKING_CONTRACT
    const updatePayload: any = {
      Venue_Location: editVenue.value.trim(),
      Start_Date: editStartDate.value,
      End_Date: finalEndDate,
      Start_Time: editStartTime.value,
      End_Time: editEndTime.value,
      Agreed_Fee: editFee.value,
      Required_Equipment: editEquipment.value.trim() || null,
      Song_Lineup: JSON.stringify(editSongLineup.value),
      Song_Lineup_JSON: editSongLineup.value,
      Is_Late_Modification: isWithin5Days.value
    }

    const { error: updateErr } = await db
      .from('BOOKING_CONTRACT')
      .update(updatePayload)
      .eq('Booking_ID', props.booking.Booking_ID)

    if (updateErr) throw updateErr

    // 3. Notify Artist of the update
    const targetAccountId = props.booking.ARTIST?.USER_ACCOUNT?.ACCOUNT_ID || props.booking.ARTIST?.ACCOUNT_ID
    if (targetAccountId) {
      try {
        await db.from('NOTIFICATION').insert({
          Account_ID: targetAccountId,
          Sender_Account_ID: props.currentAccountId || null,
          Type: 'booking_terms_modified',
          Title: `Booking Terms Updated • ${props.booking.Contract_Code || ''}`,
          Content: `The client has updated the booking terms (Venue: ${editVenue.value.trim()}, Date: ${editStartDate.value}${isWithin5Days.value ? ' • Late Modification' : ''}).`,
          Action_Link: `/Artistprofile?tab=gigs&contractId=${props.booking.Booking_ID}`,
          Svg_Type: 'contract_offer',
          Action_Primary: 'View Booking',
          Entity_ID: props.booking.Booking_ID,
          Entity_Type: 'BOOKING_CONTRACT',
          Is_Read: false
        })
      } catch (notifErr) {
        console.warn('Failed to dispatch notification:', notifErr)
      }
    }

    successMessage.value = 'Booking details updated successfully!'
    setTimeout(() => {
      emit('updated')
    }, 1200)
  } catch (err: any) {
    console.error('Failed to update booking:', err)
    errorMessage.value = err.message || 'Failed to update booking.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div v-if="isOpen && booking" class="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="emit('close')"></div>

    <!-- Modal Content: Form 2 ARTIST BOOKING CONTRACT Consistency -->
    <div
      class="relative w-full max-w-5xl bg-[#131315] border border-[#2A2A2E]/80 rounded-2xl sm:rounded-3xl p-4 sm:p-8 flex flex-col max-h-[92dvh] sm:max-h-[90vh] text-white font-Sora z-10 my-auto shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
      @click.stop
    >
      <!-- Top Status & Actions Header (Pinned at top) -->
      <div class="flex flex-col gap-2.5 sm:gap-4 border-b border-[#2A2A2E]/60 pb-3 sm:pb-4 shrink-0">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <!-- Status Badges -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <span
              class="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold"
              :class="!booking.Job_ID ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30' : 'bg-[#D0D4F7]/10 text-[#D0D4F7] border border-[#D0D4F7]/30'"
            >
              {{ !booking.Job_ID ? 'DIRECT ARTIST BOOKING' : 'JOB LISTING GIG' }}
            </span>
            <span v-if="!booking.Job_ID" class="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-gray-700/40 text-gray-300 border border-gray-600/50">
              Private
            </span>
            <span v-if="booking.Is_Rush_Booking" class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <Icon name="ic:baseline-bolt" class="text-xs" />
              <span>Rush</span>
            </span>

            <!-- Status Pill (Matches Photo 2) -->
            <div
              v-if="['Confirmed', 'Active'].includes(booking.Status)"
              class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] sm:text-xs font-semibold"
            >
              <Icon name="ic:round-check-circle" class="text-sm text-emerald-400" />
              <span>Confirmed &amp; Bound</span>
            </div>
            <div
              v-else-if="booking.Status === 'Completed'"
              class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] sm:text-xs font-semibold"
            >
              <Icon name="ic:round-check-circle" class="text-sm text-emerald-400" />
              <span>Completed</span>
            </div>
            <div
              v-else-if="['Cancelled', 'Declined'].includes(booking.Status)"
              class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] sm:text-xs font-semibold"
            >
              <Icon name="ic:round-cancel" class="text-sm text-red-400" />
              <span>Cancelled</span>
            </div>
            <div
              v-else-if="['Pending_Artist_Approval', 'Pending'].includes(booking.Status)"
              class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] sm:text-xs font-mono"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span>Awaiting Artist Approval</span>
            </div>
            <div v-else class="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-mono border border-gray-600 text-gray-400 bg-gray-500/10">
              {{ booking.Status }}
            </div>
          </div>

          <!-- Top-Right Actions & Close -->
          <div class="flex items-center gap-2 ml-auto">
            <!-- Save Button in Header (matching Photo 2 Save Setlist Changes position) -->
            <template v-if="isEditable">
              <span v-if="successMessage" class="text-xs font-mono text-emerald-400 flex items-center gap-1">
                <Icon name="ic:round-check-circle" class="text-sm" />
                <span>Saved!</span>
              </span>
              <button
                type="button"
                @click="handleSaveBookingEdits"
                :disabled="isSaving"
                class="text-[11px] sm:text-xs font-bold text-[#131315] bg-[#D0D4F7] hover:bg-white px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full transition-all cursor-pointer shadow disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Icon v-if="isSaving" name="ic:baseline-sync" class="animate-spin text-xs sm:text-sm" />
                <Icon v-else name="ic:outline-save" class="text-xs sm:text-sm" />
                <span>{{ isSaving ? 'Saving...' : 'Save Booking Changes' }}</span>
              </button>
            </template>

            <!-- Close Button -->
            <button
              type="button"
              @click="emit('close')"
              class="flex p-1 sm:p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer ml-1"
              title="Close modal"
              aria-label="Close modal"
            >
              <Icon name="ic:round-close" class="text-lg sm:text-xl" />
            </button>
          </div>
        </div>

        <!-- Header Title & Subtitle -->
        <div class="flex flex-col gap-0.5 sm:gap-1">
          <h1 class="text-xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
            {{ booking.Contract_Code || booking.Booking_ID || 'BK-CONTRACT' }}
          </h1>
          <h2 class="text-[10px] sm:text-xs text-[#D0D4F7] font-medium tracking-wide uppercase">
            {{ !booking.Job_ID ? 'ARTIST BOOKING CONTRACT (DIRECT AGREEMENT VIEW)' : 'ARTIST BOOKING CONTRACT (JOB LISTING CONFIRMED VIEW)' }}
          </h2>
        </div>
      </div>

      <!-- Feedback Message Alert -->
      <div
        v-if="errorMessage"
        class="shrink-0 mt-3 p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-center justify-between"
      >
        <div class="flex items-center gap-2">
          <Icon name="ic:baseline-error" class="text-base text-red-400 shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>
        <button type="button" @click="errorMessage = ''" class="text-gray-400 hover:text-white cursor-pointer">
          <Icon name="ic:round-close" class="text-base" />
        </button>
      </div>

      <!-- Notice Banner (Matching Photo 2 banner style) -->
      <div
        v-if="isEditable && isWithin5Days"
        class="shrink-0 mt-3 p-3 sm:p-4 rounded-xl text-[11px] sm:text-xs flex items-start sm:items-center gap-2.5 sm:gap-3 bg-amber-950/20 border border-amber-500/30 text-amber-200"
      >
        <Icon name="ic:baseline-warning" class="text-lg sm:text-xl text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
        <span>
          <strong>Notice: 5-Day Proximity Policy:</strong> This booking is scheduled within 5 days. Updating terms will flag this contract as a late modification (Is_Late_Modification) and notify the artist.
        </span>
      </div>
      <div
        v-else-if="['Confirmed', 'Active'].includes(booking.Status)"
        class="shrink-0 mt-3 p-3 sm:p-4 rounded-xl text-[11px] sm:text-xs flex items-start sm:items-center gap-2.5 sm:gap-3 bg-emerald-950/20 border border-emerald-500/30 text-emerald-200"
      >
        <Icon name="ic:round-verified" class="text-lg sm:text-xl text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
        <span>
          <strong>Agreement Confirmed &amp; Bound:</strong> Both host business and artist have signed this contract. Event dates, times, venue location, agreed fee, and setlist are finalized.
        </span>
      </div>

      <!-- Scrollable Modal Body -->
      <div class="flex-1 overflow-y-auto space-y-4 sm:space-y-6 pt-3 pb-2 pr-1 sm:pr-2 scrollbar-thin scrollbar-thumb-[#2A2A2E]">

        <!-- Cards Grid: Form in flex-col on mobile, 2-cols on desktop -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

          <!-- Card 1: Participants (Auto-filled / Read-only) -->
          <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div class="flex items-center gap-2.5 sm:gap-3">
              <Icon name="ic:baseline-supervisor-account" class="text-lg sm:text-xl text-[#D0D4F7]" />
              <h2 class="text-sm sm:text-base font-semibold text-white">Participants</h2>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs">
              <div class="flex flex-col gap-0.5 sm:gap-1 p-2.5 sm:p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[9px] sm:text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">BUSINESS ACCOUNT</span>
                <p class="text-xs sm:text-sm font-medium text-white truncate">
                  {{ booking.BUSINESS_PROFILE?.Business_Name || 'Host Business' }}
                </p>
              </div>

              <div class="flex flex-col gap-0.5 sm:gap-1 p-2.5 sm:p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[9px] sm:text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">REQUESTER ACCOUNT</span>
                <p class="text-xs sm:text-sm font-medium text-white truncate">
                  {{ booking.Requester_Account_ID || currentAccountId || 'Client' }}
                </p>
              </div>

              <div class="flex flex-col gap-0.5 sm:gap-1 p-2.5 sm:p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[9px] sm:text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">ARTIST ACCOUNT</span>
                <div class="flex items-center gap-2 min-w-0">
                  <div class="w-6 h-6 rounded-full bg-[#1E1E24] overflow-hidden border border-[#46464D]/50 shrink-0 flex items-center justify-center">
                    <img v-if="getArtistAvatar(booking.ARTIST)" :src="getArtistAvatar(booking.ARTIST)" :alt="getArtistDisplayName(booking.ARTIST)" class="w-full h-full object-cover" />
                    <Icon v-else name="ic:outline-music-note" class="text-xs text-[#D0D4F7]" />
                  </div>
                  <p class="text-xs sm:text-sm font-medium text-white truncate">
                    {{ getArtistDisplayName(booking.ARTIST) }}
                  </p>
                </div>
              </div>

              <div class="flex flex-col gap-0.5 sm:gap-1 p-2.5 sm:p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[9px] sm:text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">JOB ID / REFERENCE</span>
                <p class="text-xs sm:text-sm font-medium text-[#D0D4F7] font-mono truncate">
                  {{ booking.JOB_LISTING?.Job_Code || booking.Job_ID || 'Direct Booking (No Job ID)' }}
                </p>
              </div>
            </div>

            <!-- Optional Equipment & Description attached to Card 1 -->
            <div class="space-y-2 sm:space-y-3 pt-1">
              <div class="flex flex-col gap-0.5 sm:gap-1 p-2.5 sm:p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[9px] sm:text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">
                  REQUIRED TECHNICAL EQUIPMENT
                </span>
                <input
                  v-if="isEditable"
                  v-model="editEquipment"
                  type="text"
                  placeholder="e.g. 2 Wireless Mics, Direct Input Box, Monitors"
                  class="bg-transparent border-0 outline-none text-white text-xs sm:text-sm placeholder-gray-500 w-full"
                />
                <p v-else class="text-xs sm:text-sm font-medium text-white truncate">
                  {{ booking.Required_Equipment || 'None specified' }}
                </p>
              </div>

              <div v-if="booking.JOB_LISTING?.Description || booking.Description || isEditable" class="flex flex-col gap-0.5 sm:gap-1 p-2.5 sm:p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[9px] sm:text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">EVENT DESCRIPTION / NOTES</span>
                <textarea
                  v-if="isEditable"
                  v-model="editDescription"
                  rows="2"
                  placeholder="Notes for the performance..."
                  class="bg-transparent border-0 outline-none text-white text-xs placeholder-gray-500 w-full resize-none"
                ></textarea>
                <p v-else class="text-xs text-gray-300 leading-relaxed whitespace-pre-line">
                  {{ booking.JOB_LISTING?.Description || booking.Description || 'No additional notes provided.' }}
                </p>
              </div>
            </div>
          </div>

          <!-- Card 2: Event Details (Locked or Editable) -->
          <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5 sm:gap-3">
                <Icon name="ic:baseline-calendar-today" class="text-lg sm:text-xl text-[#D0D4F7]" />
                <h2 class="text-sm sm:text-base font-semibold text-white">
                  {{ isEditable ? 'Event Details' : 'Event Details (Locked)' }}
                </h2>
              </div>
              <!-- Multiple Days Toggle Switch for Edit Mode -->
              <div v-if="isEditable" class="flex items-center gap-2">
                <span class="text-[10px] font-mono uppercase text-[#C7C5CE]">Multiple Days</span>
                <button
                  type="button"
                  @click="editIsMultipleDays = !editIsMultipleDays"
                  class="relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                  :class="editIsMultipleDays ? 'bg-[#D0D4F7]' : 'bg-[#2A2A2E]'"
                >
                  <span
                    class="pointer-events-none inline-block h-3 w-3 transform rounded-full bg-[#131315] shadow-lg ring-0 transition duration-200 ease-in-out"
                    :class="editIsMultipleDays ? 'translate-x-4' : 'translate-x-0'"
                  />
                </button>
              </div>
            </div>

            <div class="space-y-2 sm:space-y-3 text-xs">
              <!-- Venue Location -->
              <div class="flex flex-col gap-0.5 sm:gap-1 p-2.5 sm:p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[9px] sm:text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">VENUE LOCATION</span>
                <input
                  v-if="isEditable"
                  v-model="editVenue"
                  type="text"
                  required
                  placeholder="Venue name & address..."
                  class="bg-transparent border-0 outline-none text-white text-xs sm:text-sm font-medium placeholder-gray-500 w-full"
                />
                <p v-else class="text-xs sm:text-sm font-medium text-white truncate">
                  {{ booking.Job_ID ? (booking.JOB_LISTING?.Location || booking.Venue_Location) : booking.Venue_Location }}
                </p>
              </div>

              <!-- Start Date & End Date -->
              <div class="grid grid-cols-2 gap-2 sm:gap-3">
                <div class="flex flex-col gap-0.5 sm:gap-1 p-2 sm:p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                  <span class="text-[9px] sm:text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">START DATE</span>
                  <input
                    v-if="isEditable"
                    v-model="editStartDate"
                    type="date"
                    required
                    class="bg-transparent border-0 outline-none text-white text-xs sm:text-sm font-mono w-full cursor-pointer"
                  />
                  <p v-else class="text-xs sm:text-sm font-medium text-white font-mono">
                    {{ booking.Start_Date || booking.Event_Date }}
                  </p>
                </div>

                <div class="flex flex-col gap-0.5 sm:gap-1 p-2 sm:p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                  <span class="text-[9px] sm:text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">END DATE</span>
                  <input
                    v-if="isEditable"
                    v-model="editEndDate"
                    type="date"
                    required
                    :disabled="!editIsMultipleDays"
                    class="bg-transparent border-0 outline-none text-white text-xs sm:text-sm font-mono w-full cursor-pointer disabled:opacity-50"
                  />
                  <p v-else class="text-xs sm:text-sm font-medium text-white font-mono">
                    {{ booking.End_Date || booking.Start_Date || booking.Event_Date }}
                  </p>
                </div>
              </div>

              <!-- Start Time, End Time, Agreed Fee (3-Columns Matching Photo 2) -->
              <div class="grid grid-cols-3 gap-2 sm:gap-3">
                <div class="flex flex-col gap-0.5 sm:gap-1 p-2 sm:p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                  <span class="text-[8.5px] sm:text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">START TIME</span>
                  <input
                    v-if="isEditable"
                    v-model="editStartTime"
                    type="time"
                    required
                    class="bg-transparent border-0 outline-none text-white text-xs sm:text-sm font-mono w-full cursor-pointer"
                  />
                  <p v-else class="text-xs sm:text-sm font-medium text-white font-mono">
                    {{ formatTime12(booking.Start_Time || '19:00') }}
                  </p>
                </div>

                <div class="flex flex-col gap-0.5 sm:gap-1 p-2 sm:p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                  <span class="text-[8.5px] sm:text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">END TIME</span>
                  <input
                    v-if="isEditable"
                    v-model="editEndTime"
                    type="time"
                    required
                    class="bg-transparent border-0 outline-none text-white text-xs sm:text-sm font-mono w-full cursor-pointer"
                  />
                  <p v-else class="text-xs sm:text-sm font-medium text-white font-mono">
                    {{ formatTime12(booking.End_Time || '22:00') }}
                  </p>
                </div>

                <div class="flex flex-col gap-0.5 sm:gap-1 p-2 sm:p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                  <span class="text-[8.5px] sm:text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">AGREED FEE</span>
                  <div v-if="isEditable" class="flex items-center">
                    <span class="text-xs text-emerald-400 font-bold mr-0.5">₱</span>
                    <input
                      v-model.number="editFee"
                      type="number"
                      min="0"
                      step="500"
                      placeholder="0"
                      class="bg-transparent border-0 outline-none text-emerald-400 text-xs sm:text-sm font-bold font-mono w-full"
                    />
                  </div>
                  <p v-else class="text-xs sm:text-sm font-bold text-emerald-400 font-mono">
                    ₱{{ Number(booking.Agreed_Fee || 0).toLocaleString() }}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

        <!-- Card 3: Song Lineup & Setlist (Full-Width Matching Photo 2) -->
        <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 sm:gap-2.5">
              <Icon name="ic:outline-queue-music" class="text-lg sm:text-xl text-[#D0D4F7]" />
              <h2 class="text-sm sm:text-base font-semibold text-white">Song Lineup &amp; Setlist</h2>
            </div>
            <span class="text-[11px] sm:text-xs text-gray-400 font-mono">
              {{ editSongLineup.length }} {{ editSongLineup.length === 1 ? 'song' : 'songs' }}
            </span>
          </div>

          <div class="space-y-2 sm:space-y-2.5">
            <div
              v-for="(song, idx) in editSongLineup"
              :key="song.id || idx"
              class="flex items-center justify-between gap-2.5 sm:gap-3 px-3 py-2 sm:px-3.5 sm:py-2.5 bg-[#141416] border border-[#46464D]/60 rounded-xl text-xs transition-colors"
            >
              <!-- Left: Accent Bar & Title -->
              <div class="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
                <span
                  class="w-1.5 h-4 rounded-full shrink-0"
                  :class="song.source === 'business' ? 'bg-amber-400' : 'bg-[#D0D4F7]'"
                ></span>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                    <input
                      v-if="isEditable"
                      v-model="song.title"
                      type="text"
                      placeholder="Enter song title / artist..."
                      class="bg-transparent border-0 outline-none text-white text-xs font-medium placeholder-gray-500 w-full"
                    />
                    <span v-else class="text-xs font-medium text-white truncate">{{ song.title || 'Untitled Song' }}</span>

                    <span class="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 shrink-0">
                      {{ song.source === 'business' ? 'Business Requested' : 'Client Requested' }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Right: Duration & Delete -->
              <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <input
                  v-if="isEditable"
                  v-model="song.duration"
                  type="text"
                  placeholder="03:30"
                  class="bg-transparent border-0 outline-none text-gray-400 text-xs font-mono text-right w-12 sm:w-14"
                />
                <span v-else class="text-[11px] sm:text-xs font-mono text-gray-400">
                  {{ song.duration || '03:30' }}
                </span>

                <button
                  v-if="isEditable"
                  type="button"
                  @click="removeSong(idx)"
                  class="text-gray-400 hover:text-red-400 transition-colors p-1 cursor-pointer"
                  title="Remove song"
                >
                  <Icon name="ic:round-close" class="text-sm sm:text-base" />
                </button>
                <span v-else class="text-gray-600 p-1">
                  <Icon name="ic:outline-lock" class="text-xs text-gray-500" />
                </span>
              </div>
            </div>

            <!-- Empty Songs State -->
            <div v-if="editSongLineup.length === 0" class="p-4 rounded-xl bg-[#141416] border border-[#2A2A2E] text-center text-gray-500 text-xs">
              No specific songs requested for this performance.
            </div>

            <!-- Add Song CTA -->
            <button
              v-if="isEditable"
              type="button"
              @click="addSong"
              class="w-full flex items-center justify-center gap-2 p-2 sm:p-2.5 rounded-xl border border-dashed border-[#46464D] hover:border-[#D0D4F7] text-xs text-gray-300 hover:text-white transition-all cursor-pointer"
            >
              <Icon name="ic:baseline-add" class="text-sm sm:text-base" />
              <span>+ Add song to setlist</span>
            </button>
          </div>
        </div>

      </div>

      <!-- Modal Footer (Action Buttons) -->
      <div class="pt-3 sm:pt-4 border-t border-[#2A2A2E]/60 flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div>
          <!-- Cancel button for active bookings -->
          <button
            v-if="!['Completed', 'Cancelled', 'Declined'].includes(booking.Status) && !isEventFinished(booking)"
            type="button"
            @click="emit('cancel', booking); emit('close')"
            class="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full border border-red-500/30 text-red-300 hover:bg-red-500/10 hover:border-red-500/60 transition-all text-xs font-medium cursor-pointer"
          >
            Cancel Booking
          </button>
        </div>

        <div class="flex items-center gap-2">
          <!-- Discard changes if editable -->
          <button
            v-if="isEditable"
            type="button"
            @click="populateForm"
            class="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full border border-[#3A3A3C] hover:border-gray-400 text-gray-300 hover:text-white transition-all text-xs font-medium cursor-pointer"
          >
            Discard Changes
          </button>

          <!-- Save booking changes (bottom) -->
          <button
            v-if="isEditable"
            type="button"
            @click="handleSaveBookingEdits"
            :disabled="isSaving"
            class="px-4 sm:px-5 py-1.5 sm:py-2 rounded-full bg-[#D0D4F7] hover:bg-white text-[#0E0E10] font-bold transition-all text-xs cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50"
          >
            <Icon v-if="isSaving" name="ic:baseline-sync" class="animate-spin text-sm" />
            <Icon v-else name="ic:outline-save" class="text-sm" />
            <span>{{ isSaving ? 'Saving...' : 'Save Booking Changes' }}</span>
          </button>

          <!-- Complete button if finished -->
          <button
            v-if="booking.Status !== 'Completed' && isEventFinished(booking)"
            type="button"
            @click="emit('complete', booking); emit('close')"
            class="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full border border-emerald-500/40 text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 transition-all text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Icon name="ic:round-check-circle" class="text-xs text-emerald-400" />
            <span>Mark as Complete</span>
          </button>

          <!-- Rate artist if completed -->
          <button
            v-else-if="booking.Status === 'Completed'"
            type="button"
            @click="emit('review', booking); emit('close')"
            class="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold bg-[#D0D4F7] hover:bg-white text-[#0E0E10] transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Icon name="ic:round-star" class="text-sm" />
            <span>Rate Artist</span>
          </button>

          <button
            type="button"
            @click="emit('close')"
            class="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full border border-[#3A3A3C] hover:border-gray-400 text-gray-300 hover:text-white transition-all text-xs font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
