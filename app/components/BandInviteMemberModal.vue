<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useBandMembers, type VerifiedSoloArtistItem, type BandMemberItem } from '~/composables/useBandMembers'
import { normalizeRole, POPULAR_BAND_ROLES } from '~/utils/roleHelper'

const props = defineProps<{
  isOpen: boolean
  bandId: string
  currentMembers: BandMemberItem[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'invited', member: { accountId: string; role: string; artistName: string }): void
}>()

const {
  verifiedSoloArtists,
  isLoading,
  isActionLoading,
  errorMessage,
  fetchVerifiedSoloArtists,
  inviteMember,
} = useBandMembers()

const searchQuery = ref('')
const selectedArtist = ref<VerifiedSoloArtistItem | null>(null)
const roleInput = ref('')
const localError = ref<string | null>(null)
const localSuccess = ref<string | null>(null)

// Computed normalized role preview
const normalizedRolePreview = computed(() => {
  return normalizeRole(roleInput.value)
})

// Current member status lookup map
const memberStatusMap = computed(() => {
  const map = new Map<string, 'Accepted' | 'Pending'>()
  for (const m of props.currentMembers) {
    if (m.status === 'Accepted' || m.status === 'Pending') {
      map.set(m.memberId, m.status)
    }
  }
  return map
})

// Filtered verified artists based on search
const filteredArtists = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return verifiedSoloArtists.value

  return verifiedSoloArtists.value.filter((artist) => {
    const nameMatch = artist.artistName.toLowerCase().includes(q)
    const userMatch = artist.username.toLowerCase().includes(q)
    const specMatch = artist.specialty?.toLowerCase().includes(q)
    const cityMatch = artist.city?.toLowerCase().includes(q)
    return nameMatch || userMatch || specMatch || cityMatch
  })
})

const selectArtist = (artist: VerifiedSoloArtistItem) => {
  const status = memberStatusMap.value.get(artist.accountId)
  if (status) return // Already active or pending

  selectedArtist.value = artist
  localError.value = null
  localSuccess.value = null

  // Pre-fill specialty as role if available and role input is empty
  if (!roleInput.value && artist.specialty) {
    roleInput.value = normalizeRole(artist.specialty)
  }
}

const selectRoleChip = (role: string) => {
  roleInput.value = role
}

const handleSendInvite = async () => {
  if (!selectedArtist.value) {
    localError.value = 'Please select a verified solo artist to invite.'
    return
  }

  const role = normalizedRolePreview.value
  if (!role) {
    localError.value = 'Please specify a role (e.g. Lead Guitarist, Drummer).'
    return
  }

  localError.value = null
  localSuccess.value = null

  const result = await inviteMember(props.bandId, selectedArtist.value.accountId, role)

  if (result.success) {
    localSuccess.value = `Invitation sent to ${selectedArtist.value.artistName} as ${result.role}!`
    emit('invited', {
      accountId: selectedArtist.value.accountId,
      role: result.role || role,
      artistName: selectedArtist.value.artistName,
    })

    setTimeout(() => {
      handleClose()
    }, 1200)
  } else {
    localError.value = result.error || 'Failed to send invitation. Please try again.'
  }
}

const handleClose = () => {
  selectedArtist.value = null
  roleInput.value = ''
  searchQuery.value = ''
  localError.value = null
  localSuccess.value = null
  emit('close')
}

// Fetch verified solo artists whenever modal opens
useModalScrollLock(() => props.isOpen)

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      fetchVerifiedSoloArtists()
      selectedArtist.value = null
      roleInput.value = ''
      localError.value = null
      localSuccess.value = null
    }
  }
)

onMounted(() => {
  if (props.isOpen) {
    fetchVerifiedSoloArtists()
  }
})
</script>

<template>
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
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm"
        @click.self="handleClose"
      >
        <div
          class="relative w-full max-w-2xl bg-[#141416] border border-[#46464D]/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        >
          <!-- Modal Header -->
          <div class="px-6 py-5 border-b border-[#46464D]/30 flex items-center justify-between bg-[#19191D]">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-[#D0D4F7]/10 border border-[#D0D4F7]/30 flex items-center justify-center text-[#D0D4F7]">
                <Icon name="lucide:user-plus" class="text-xl" />
              </div>
              <div>
                <h3 class="text-lg font-Sora font-bold text-white">Invite Band Member</h3>
                <p class="text-xs text-gray-400 font-Geist">Browse verified solo artists on TONO to recruit into your lineup</p>
              </div>
            </div>
            <button
              @click="handleClose"
              class="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <Icon name="lucide:x" class="text-lg" />
            </button>
          </div>

          <!-- Alert Feedback -->
          <div v-if="localError || errorMessage" class="px-6 pt-4">
            <div class="p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs sm:text-sm flex items-center gap-2">
              <Icon name="lucide:alert-circle" class="text-base shrink-0" />
              <span>{{ localError || errorMessage }}</span>
            </div>
          </div>

          <div v-if="localSuccess" class="px-6 pt-4">
            <div class="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs sm:text-sm flex items-center gap-2">
              <Icon name="lucide:check-circle" class="text-base shrink-0" />
              <span>{{ localSuccess }}</span>
            </div>
          </div>

          <!-- Modal Body (Scrollable) -->
          <div class="px-6 py-5 overflow-y-auto space-y-6 flex-1 scrollbar-thin scrollbar-thumb-white/10">
            <!-- Step 1: Select Verified Solo Artist -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="block text-xs font-semibold uppercase tracking-wider text-gray-300 font-Geist">
                  1. Select Verified Solo Artist
                </label>
                <span class="text-xs text-gray-500 font-mono">
                  {{ filteredArtists.length }} available
                </span>
              </div>

              <!-- Search Bar -->
              <div class="relative mb-3">
                <Icon name="lucide:search" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base pointer-events-none" />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search artist name, username, or specialty..."
                  class="w-full bg-[#1C1C20] border border-[#46464D]/40 focus:border-[#D0D4F7] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
                />
              </div>

              <!-- Artist List -->
              <div class="border border-[#46464D]/30 rounded-xl max-h-52 overflow-y-auto bg-[#161619] divide-y divide-[#46464D]/20">
                <!-- Loading State -->
                <div v-if="isLoading" class="p-6 text-center text-gray-400 text-xs sm:text-sm flex items-center justify-center gap-2">
                  <Icon name="lucide:loader-2" class="animate-spin text-base text-[#D0D4F7]" />
                  <span>Loading verified solo artists...</span>
                </div>

                <!-- Empty State -->
                <div v-else-if="filteredArtists.length === 0" class="p-6 text-center text-gray-400 text-xs sm:text-sm">
                  <Icon name="lucide:users-round" class="text-3xl text-gray-500 mx-auto mb-2 opacity-50" />
                  <p>No verified solo artists found matching "{{ searchQuery }}".</p>
                </div>

                <!-- Artist Rows -->
                <div
                  v-for="artist in filteredArtists"
                  :key="artist.accountId"
                  @click="selectArtist(artist)"
                  class="p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer group"
                  :class="[
                    selectedArtist?.accountId === artist.accountId
                      ? 'bg-[#D0D4F7]/15 border-l-4 border-l-[#D0D4F7]'
                      : memberStatusMap.has(artist.accountId)
                        ? 'opacity-60 cursor-not-allowed bg-black/10'
                        : 'hover:bg-white/5'
                  ]"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <img
                      v-if="artist.profilePicture"
                      :src="artist.profilePicture"
                      :alt="artist.artistName"
                      class="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-white/10"
                    />
                    <div
                      v-else
                      class="w-10 h-10 rounded-full bg-[#2A2A30] text-gray-300 flex items-center justify-center font-bold text-sm shrink-0 uppercase"
                    >
                      {{ artist.artistName.charAt(0) }}
                    </div>

                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="font-Sora font-semibold text-sm text-white truncate group-hover:text-[#D0D4F7] transition-colors">
                          {{ artist.artistName }}
                        </span>
                        <Icon name="ic:round-verified" class="text-emerald-400 text-sm shrink-0" title="Verified Solo Artist" />
                      </div>
                      <div class="flex items-center gap-2 text-xs text-gray-400">
                        <span class="font-mono">@{{ artist.username }}</span>
                        <span v-if="artist.specialty" class="text-gray-500">• {{ artist.specialty }}</span>
                        <span v-if="artist.city" class="text-gray-500">• {{ artist.city }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Right Status or Selection Indicator -->
                  <div class="shrink-0 flex items-center gap-2">
                    <span
                      v-if="memberStatusMap.get(artist.accountId) === 'Accepted'"
                      class="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium"
                    >
                      Active Member
                    </span>
                    <span
                      v-else-if="memberStatusMap.get(artist.accountId) === 'Pending'"
                      class="text-[11px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium"
                    >
                      Invite Pending
                    </span>
                    <div
                      v-else-if="selectedArtist?.accountId === artist.accountId"
                      class="w-6 h-6 rounded-full bg-[#D0D4F7] text-[#0E0E10] flex items-center justify-center font-bold text-xs"
                    >
                      <Icon name="lucide:check" class="text-sm" />
                    </div>
                    <span
                      v-else
                      class="text-xs text-gray-400 group-hover:text-[#D0D4F7] font-medium hidden sm:inline"
                    >
                      Select
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 2: Role Assignment (Only visible or active when artist selected) -->
            <div class="space-y-3" :class="{ 'opacity-50 pointer-events-none': !selectedArtist }">
              <div class="flex items-center justify-between">
                <label class="block text-xs font-semibold uppercase tracking-wider text-gray-300 font-Geist">
                  2. Band Role / Instrument
                </label>
                <span v-if="normalizedRolePreview" class="text-xs text-[#D0D4F7] font-medium">
                  Normalized: <strong class="text-white">{{ normalizedRolePreview }}</strong>
                </span>
              </div>

              <!-- Role Input -->
              <input
                v-model="roleInput"
                type="text"
                placeholder="e.g. Lead Guitarist, Bassist, Drummer, Keyboardist..."
                class="w-full bg-[#1C1C20] border border-[#46464D]/40 focus:border-[#D0D4F7] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
              />

              <!-- Quick Role Chips -->
              <div>
                <p class="text-[11px] text-gray-400 mb-1.5 font-Geist">Popular roles (click to fill):</p>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="chip in POPULAR_BAND_ROLES"
                    :key="chip"
                    type="button"
                    @click="selectRoleChip(chip)"
                    class="text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer"
                    :class="[
                      normalizedRolePreview === chip
                        ? 'bg-[#D0D4F7] text-[#0E0E10] border-[#D0D4F7] font-semibold'
                        : 'bg-[#1F1F24] text-gray-300 border-white/10 hover:border-white/30 hover:text-white'
                    ]"
                  >
                    {{ chip }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Selected Summary Box -->
            <div
              v-if="selectedArtist"
              class="p-4 rounded-xl bg-[#1E1E24] border border-[#D0D4F7]/30 flex items-center justify-between gap-3 animate-in fade-in duration-200"
            >
              <div class="flex items-center gap-3 min-w-0">
                <img
                  v-if="selectedArtist.profilePicture"
                  :src="selectedArtist.profilePicture"
                  :alt="selectedArtist.artistName"
                  class="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-[#D0D4F7]"
                />
                <div
                  v-else
                  class="w-10 h-10 rounded-full bg-[#2A2A30] text-[#D0D4F7] flex items-center justify-center font-bold text-sm shrink-0"
                >
                  {{ selectedArtist.artistName.charAt(0) }}
                </div>
                <div class="min-w-0">
                  <p class="text-xs text-gray-400">Inviting</p>
                  <p class="text-sm font-Sora font-bold text-white truncate">
                    {{ selectedArtist.artistName }}
                    <span v-if="normalizedRolePreview" class="text-[#D0D4F7] font-normal">
                      as {{ normalizedRolePreview }}
                    </span>
                  </p>
                </div>
              </div>
              <button
                @click="selectedArtist = null"
                class="text-xs text-gray-400 hover:text-red-400 transition-colors p-1"
                title="Change artist"
              >
                Change
              </button>
            </div>
          </div>

          <!-- Modal Footer Actions -->
          <div class="px-6 py-4 border-t border-[#46464D]/30 flex items-center justify-end gap-3 bg-[#19191D]">
            <button
              @click="handleClose"
              type="button"
              class="px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/30 text-gray-300 hover:text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              @click="handleSendInvite"
              type="button"
              :disabled="!selectedArtist || !normalizedRolePreview || isActionLoading"
              class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D0D4F7] hover:bg-white text-[#0E0E10] text-xs sm:text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer group"
            >
              <Icon v-if="isActionLoading" name="lucide:loader-2" class="animate-spin text-base" />
              <Icon v-else name="lucide:send" class="text-base group-hover:translate-x-0.5 transition-transform" />
              <span>Send Invitation</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
