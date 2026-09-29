<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'

const props = defineProps<{
  isOpen: boolean
  contract: any | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'accepted'): void
  (e: 'rejected'): void
}>()

const supabase = useSupabaseClient()
const db = supabase as any

const isSubmitting = ref(false)
const feedbackMessage = ref('')

// Song item interface
interface SongItem {
  id: string
  title: string
  duration: string
  source: 'business' | 'artist'
}

const songLineup = ref<SongItem[]>([])

// Auto-Save Draft for Artist Additions
const isArtistDraftSaving = ref(false)
const artistLastSavedTime = ref('')
const DRAFT_KEY = 'tono_draft_artist_contract_view'

const isContractAccepted = computed(() => {
  if (!props.contract) return false
  return ['Confirmed', 'Active', 'Completed'].includes(props.contract.Status)
})

const isContractPendingApproval = computed(() => {
  if (!props.contract) return false
  return ['Pending_Artist_Approval', 'Pending', 'Draft'].includes(props.contract.Status)
})

watch(
  () => props.contract,
  (c) => {
    if (!c) return
    songLineup.value = []

    // Parse existing songs
    let parsedSongs: SongItem[] = []
    if (Array.isArray(c.Song_Lineup_JSON) && c.Song_Lineup_JSON.length) {
      parsedSongs = c.Song_Lineup_JSON
    } else if (c.Song_Lineup) {
      try {
        const json = typeof c.Song_Lineup === 'string' ? JSON.parse(c.Song_Lineup) : c.Song_Lineup
        if (Array.isArray(json)) parsedSongs = json
      } catch (e) {
        // Fallback for comma-separated legacy songs
        parsedSongs = c.Song_Lineup.split(',').map((s: string, idx: number) => ({
          id: `song_${idx}`,
          title: s.trim(),
          duration: '03:30',
          source: 'business'
        }))
      }
    }

    // Ensure all songs have a source tag
    songLineup.value = parsedSongs.map((s, idx) => ({
      id: s.id || `song_${idx}`,
      title: s.title || '',
      duration: s.duration || '',
      source: s.source === 'artist' ? 'artist' : 'business' // business-requested songs default to business
    }))
  },
  { immediate: true }
)

const addArtistSong = () => {
  if (isContractAccepted.value) return
  songLineup.value.push({
    id: `artist_song_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    title: '',
    duration: '',
    source: 'artist'
  })
  triggerDraftAutoSave()
}

const removeArtistSong = (index: number) => {
  if (isContractAccepted.value) return
  // Strict rule: Artists CANNOT remove business-requested songs!
  const song = songLineup.value[index]
  if (song && song.source === 'business') {
    return // Block deletion
  }
  songLineup.value.splice(index, 1)
  triggerDraftAutoSave()
}

const triggerDraftAutoSave = () => {
  if (typeof window === 'undefined' || isContractAccepted.value) return
  isArtistDraftSaving.value = true
  setTimeout(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(songLineup.value))
      artistLastSavedTime.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch (e) {}
    isArtistDraftSaving.value = false
  }, 500)
}

const handleArtistAccept = async () => {
  if (!props.contract) return
  isSubmitting.value = true
  feedbackMessage.value = ''

  try {
    const bookingId = props.contract.Booking_ID

    // 1. Update contract status to Confirmed and save updated setlist
    const { error: contractErr } = await db
      .from('BOOKING_CONTRACT')
      .update({
        Status: 'Confirmed',
        Song_Lineup: JSON.stringify(songLineup.value),
        Song_Lineup_JSON: songLineup.value
      })
      .eq('Booking_ID', bookingId)

    if (contractErr) throw contractErr

    // 2. If attached to a Job_ID, update application status to Accepted and others to Declined
    if (props.contract.Job_ID) {
      await db
        .from('APPLICATION')
        .update({ Status: 'Accepted' })
        .eq('Job_ID', props.contract.Job_ID)
        .eq('Artist_ID', props.contract.Provider_Artist_ID)

      await db
        .from('JOB_LISTING')
        .update({ Status: 'Filled' })
        .eq('Job_ID', props.contract.Job_ID)
    }

    // 3. Clear draft
    try { localStorage.removeItem(DRAFT_KEY) } catch (e) {}

    emit('accepted')
    emit('close')
  } catch (err: any) {
    feedbackMessage.value = err.message || 'Failed to accept contract.'
  } finally {
    isSubmitting.value = false
  }
}

const handleArtistReject = async () => {
  if (!props.contract) return
  isSubmitting.value = true
  try {
    // 1. Update contract to Declined
    await db
      .from('BOOKING_CONTRACT')
      .update({
        Status: 'Declined',
        Cancellation_Reason: 'Declined by Artist'
      })
      .eq('Booking_ID', props.contract.Booking_ID)

    // 2. If tied to a Job_ID, update application and check if job slot can be freed
    if (props.contract.Job_ID) {
      await db
        .from('APPLICATION')
        .update({ Status: 'Declined' })
        .eq('Job_ID', props.contract.Job_ID)
        .eq('Artist_ID', props.contract.Provider_Artist_ID)

      // Free slots for this listing if no other active/pending contracts exist
      const { data: otherContracts } = await db
        .from('BOOKING_CONTRACT')
        .select('Booking_ID')
        .eq('Job_ID', props.contract.Job_ID)
        .neq('Booking_ID', props.contract.Booking_ID)
        .not('Status', 'in', '("Cancelled","Declined")')

      if (!otherContracts || otherContracts.length === 0) {
        await db
          .from('JOB_LISTING')
          .update({ Status: 'Open' })
          .eq('Job_ID', props.contract.Job_ID)
      }
    }

    emit('rejected')
    emit('close')
  } catch (err: any) {
    feedbackMessage.value = err.message || 'Failed to reject contract.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div v-if="isOpen && contract" class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="emit('close')"></div>

    <!-- Modal Content: Form 2 ARTIST BOOKING CONTRACT -->
    <div
      class="relative w-full max-w-5xl bg-[#131315] border border-[#2A2A2E]/80 rounded-2xl p-6 sm:p-8 space-y-6 text-white font-Sora z-10 my-8 shadow-2xl animate-in zoom-in-95 duration-200"
    >
      <!-- Top Status & Actions -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A2A2E]/60 pb-4">
        <div class="flex items-center gap-2">
          <!-- When contract is already accepted/confirmed -->
          <div v-if="isContractAccepted" class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Icon name="ic:round-check-circle" class="text-sm text-emerald-400" />
            <span>Agreement Confirmed & Bound</span>
          </div>
          <!-- When saving setlist draft (only for pending contracts) -->
          <div v-else-if="isArtistDraftSaving" class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">
            <Icon name="ic:baseline-sync" class="animate-spin text-sm" />
            <span>Saving setlist...</span>
          </div>
          <div v-else-if="artistLastSavedTime" class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Setlist saved {{ artistLastSavedTime }}</span>
          </div>
          <div v-else class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span>Awaiting Review & Approval</span>
          </div>
        </div>

        <div class="flex items-center gap-2 self-start sm:self-auto">
          <!-- When pending approval: Show Reject and Accept buttons -->
          <template v-if="isContractPendingApproval">
            <button
              type="button"
              @click="handleArtistReject"
              :disabled="isSubmitting"
              class="text-xs font-medium text-gray-300 hover:text-red-300 px-4 py-2 rounded-full border border-[#46464D] hover:border-red-500/50 hover:bg-red-500/10 transition-all cursor-pointer"
            >
              Reject Contract
            </button>
            <button
              type="button"
              @click="handleArtistAccept"
              :disabled="isSubmitting"
              class="text-xs font-bold text-[#131315] bg-[#D0D4F7] hover:bg-white px-6 py-2 rounded-full transition-all cursor-pointer shadow disabled:opacity-50 flex items-center gap-1.5"
            >
              <Icon v-if="isSubmitting" name="ic:baseline-sync" class="animate-spin text-sm" />
              <span>Accept Contract</span>
            </button>
          </template>

          <!-- When accepted: Hide reject/accept and show confirmed badge -->
          <div
            v-else-if="isContractAccepted"
            class="px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5"
          >
            <Icon name="ic:round-verified" class="text-sm text-emerald-400" />
            <span>Contract Accepted</span>
          </div>

          <!-- Other status (e.g. Cancelled / Declined) -->
          <div
            v-else
            class="px-3.5 py-1.5 rounded-full text-xs font-mono border border-gray-600 text-gray-400 bg-gray-500/10"
          >
            {{ contract.Status }}
          </div>

          <button
            type="button"
            @click="emit('close')"
            class="flex text-gray-400 hover:text-white p-1 cursor-pointer ml-1"
          >
            <Icon name="ic:round-close" class="text-xl" />
          </button>
        </div>
      </div>

      <!-- Header Title -->
      <div class="flex flex-col gap-1">
        <h1 class="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-none">
          {{ contract.Contract_Code || 'BK-CONTRACT' }}
        </h1>
        <h2 class="text-xs sm:text-sm text-[#D0D4F7] font-medium tracking-wide">
          {{ isContractAccepted ? 'ARTIST BOOKING CONTRACT (CONFIRMED AGREEMENT VIEW)' : 'ARTIST BOOKING CONTRACT (RECEIVING & APPROVAL VIEW)' }}
        </h2>
      </div>

      <!-- Notice Banner -->
      <div
        class="p-4 rounded-xl text-xs flex items-center gap-3"
        :class="isContractAccepted ? 'bg-emerald-950/20 border border-emerald-500/30 text-emerald-200' : 'bg-[#1C1C1F] border border-[#3A3A3C] text-gray-300'"
      >
        <Icon :name="isContractAccepted ? 'ic:round-verified' : 'ic:outline-lock'" class="text-xl shrink-0" :class="isContractAccepted ? 'text-emerald-400' : 'text-[#D0D4F7]'" />
        <span v-if="isContractAccepted">
          <strong>Agreement Confirmed & Bound:</strong> Both host business and artist have signed this contract. Event dates, times, venue location, agreed fee, and setlist are finalized.
        </span>
        <span v-else>
          <strong>Contract Terms Locked:</strong> Host dates, times, venue location, and fee are confirmed by the business. You can add extra songs to customize your setlist, but business-requested songs cannot be removed.
        </span>
      </div>

      <!-- Cards Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <!-- Card 1: Participants (Auto-filled & Read-only) -->
        <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 space-y-4">
          <div class="flex items-center gap-3">
            <Icon name="ic:baseline-supervisor-account" class="text-xl text-[#D0D4F7]" />
            <h2 class="text-base font-semibold text-white">Participants</h2>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div class="flex flex-col gap-1 p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
              <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">BUSINESS ACCOUNT</span>
              <p class="text-sm font-medium text-white truncate">
                {{ contract.BUSINESS_PROFILE?.Business_Name || contract.Provider_Business_ID || 'Host Business' }}
              </p>
            </div>
            <div class="flex flex-col gap-1 p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
              <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">REQUESTER ACCOUNT</span>
              <p class="text-sm font-medium text-white truncate">
                {{ contract.Requester_Account_ID || 'Client Account' }}
              </p>
            </div>
            <div class="flex flex-col gap-1 p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
              <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">ARTIST ACCOUNT</span>
              <p class="text-sm font-medium text-white truncate">
                {{ contract.ARTIST?.StageName?.[0]?.Artist_Name || 'Artist' }}
              </p>
            </div>
            <div class="flex flex-col gap-1 p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
              <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">JOB ID / REFERENCE</span>
              <p class="text-sm font-medium text-[#D0D4F7] font-mono truncate">
                {{ contract.JOB_LISTING?.Job_Code || contract.Job_ID || 'Direct Booking (No Job ID)' }}
              </p>
            </div>
          </div>
        </div>

        <!-- Card 2: Event Details (Read-only) -->
        <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 space-y-4">
          <div class="flex items-center gap-3">
            <Icon name="ic:baseline-calendar-today" class="text-xl text-[#D0D4F7]" />
            <h2 class="text-base font-semibold text-white">Event Details (Locked)</h2>
          </div>

          <div class="space-y-3 text-xs">
            <div class="flex flex-col gap-1 p-3.5 bg-[#141416] border border-[#46464D]/60 rounded-xl">
              <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">VENUE LOCATION</span>
              <p class="text-sm font-medium text-white">{{ contract.Venue_Location || 'Host Venue' }}</p>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1 p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">START DATE</span>
                <p class="text-sm font-medium text-white font-mono">{{ contract.Start_Date || contract.Event_Date }}</p>
              </div>
              <div class="flex flex-col gap-1 p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">END DATE</span>
                <p class="text-sm font-medium text-white font-mono">{{ contract.End_Date || contract.Start_Date || contract.Event_Date }}</p>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div class="flex flex-col gap-1 p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">START TIME</span>
                <p class="text-sm font-medium text-white font-mono">{{ formatTime12(contract.Start_Time || '19:00') }}</p>
              </div>
              <div class="flex flex-col gap-1 p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">END TIME</span>
                <p class="text-sm font-medium text-white font-mono">{{ formatTime12(contract.End_Time || '22:00') }}</p>
              </div>
              <div class="flex flex-col gap-1 p-3 bg-[#141416] border border-[#46464D]/60 rounded-xl">
                <span class="text-[10px] font-mono tracking-wider text-[#C7C5CE] uppercase">AGREED FEE</span>
                <p class="text-sm font-bold text-emerald-400 font-mono">₱{{ Number(contract.Agreed_Fee || 0).toLocaleString() }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Song Lineup (Form 2 Customization Rule: business songs locked, artist songs editable) -->
      <div class="bg-[#1C1C1F]/80 border border-[#2A2A2E]/50 rounded-2xl p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon name="ic:outline-queue-music" class="text-xl text-[#D0D4F7]" />
            <h2 class="text-base font-semibold text-white">Song Lineup & Setlist</h2>
          </div>
          <span class="text-xs text-gray-400 font-mono">
            {{ songLineup.length }} {{ songLineup.length === 1 ? 'song' : 'songs' }}
          </span>
        </div>

        <div class="space-y-2.5">
          <div
            v-for="(song, idx) in songLineup"
            :key="song.id"
            class="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#141416] border rounded-xl text-xs transition-colors"
            :class="song.source === 'business' ? 'border-[#3A3A3C] bg-[#141416]/90' : 'border-[#46464D] bg-[#18181B]'"
          >
            <!-- Left: Accent Bar & Title -->
            <div class="flex items-center gap-2.5 flex-1 min-w-0">
              <span
                class="w-1.5 h-4 rounded-full shrink-0"
                :class="song.source === 'business' ? 'bg-amber-400' : 'bg-[#D0D4F7]'"
              ></span>

              <div class="flex-1 min-w-0">
                <!-- If Business Requested: Title is Locked -->
                <div v-if="song.source === 'business'" class="flex items-center gap-2">
                  <span class="text-xs font-medium text-white truncate">{{ song.title || 'Requested Song' }}</span>
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 shrink-0">
                    Business Requested (Locked)
                  </span>
                </div>
                <!-- If Artist Added and Contract Accepted: Title is Locked -->
                <div v-else-if="isContractAccepted" class="flex items-center gap-2">
                  <span class="text-xs font-medium text-[#D0D4F7] truncate">{{ song.title || 'Artist Added Song' }}</span>
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#D0D4F7]/10 text-[#D0D4F7] border border-[#D0D4F7]/20 shrink-0">
                    Artist Song (Confirmed)
                  </span>
                </div>
                <!-- If Artist Added and Pending Approval: Title is Editable -->
                <input
                  v-else
                  type="text"
                  v-model="song.title"
                  placeholder="Enter song title / artist..."
                  class="bg-transparent border-0 outline-none text-white text-xs font-medium placeholder-gray-500 w-full"
                />
              </div>
            </div>

            <!-- Right: Duration & Delete (Locked if business song or accepted contract) -->
            <div class="flex items-center gap-2 shrink-0">
              <span v-if="song.source === 'business' || isContractAccepted" class="text-xs font-mono text-gray-400">
                {{ song.duration || '03:30' }}
              </span>
              <input
                v-else
                type="text"
                v-model="song.duration"
                placeholder="00:00"
                class="bg-transparent border-0 outline-none text-gray-400 text-xs font-mono text-right w-14"
              />

              <!-- Remove button: ONLY for artist added songs when pending approval! -->
              <template v-if="!isContractAccepted">
                <button
                  v-if="song.source === 'artist'"
                  type="button"
                  @click="removeArtistSong(idx)"
                  class="text-gray-400 hover:text-red-400 transition-colors p-1 cursor-pointer"
                  title="Remove artist song"
                >
                  <Icon name="ic:round-close" class="text-base" />
                </button>
                <span v-else class="text-gray-600 p-1" title="Requested by business - cannot be removed">
                  <Icon name="ic:outline-lock" class="text-xs text-gray-500" />
                </span>
              </template>
              <span v-else class="text-gray-600 p-1" title="Confirmed contract - setlist locked">
                <Icon name="ic:outline-lock" class="text-xs text-gray-500" />
              </span>
            </div>
          </div>

          <!-- Add Song CTA: Only visible if contract is not yet accepted -->
          <button
            v-if="!isContractAccepted"
            type="button"
            @click="addArtistSong"
            class="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-[#46464D] hover:border-[#D0D4F7] text-xs text-gray-300 hover:text-white transition-all cursor-pointer"
          >
            <Icon name="ic:baseline-plus" class="text-base" />
            <span>+ Add song to setlist</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
