<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    artistName?: string
    artistAvatar?: string | null
    artistType?: string
  }>(),
  {
    artistName: 'Featured Artist',
    artistAvatar: null,
    artistType: 'Solo Artist'
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (
    e: 'submit',
    payload: {
      eventDate: string
      startTime: string
      endTime: string
      venueLocation: string
      agreedFee: number | null
      songLineup: string
      requiredEquipment: string
      isRushBooking: boolean
    }
  ): void
}>()

// Form States
const eventDate = ref('')
const startTime = ref('')
const endTime = ref('')
const venueLocation = ref('')
const agreedFee = ref<number | null>(null)
const songLineup = ref('')
const requiredEquipment = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')

// Date formatter (YYYY-MM-DD) using local time
const formatDate = (d: Date): string => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Calculate minimum date (today in YYYY-MM-DD)
const todayStr = computed(() => formatDate(new Date()))

// Reset form when modal opens
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      errorMessage.value = ''
      isSubmitting.value = false
      if (!eventDate.value) {
        // Default to tomorrow
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        eventDate.value = formatDate(tomorrow)
      }
      if (!startTime.value) startTime.value = '19:00'
      if (!endTime.value) endTime.value = '22:00'
    }
  },
  { immediate: true }
)

// Rush Booking calculation: <= 5 days from today
const isRushBooking = computed(() => {
  if (!eventDate.value) return false
  const target = new Date(eventDate.value + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffTime = target.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays >= 0 && diffDays <= 5
})

// Validation
const isFormValid = computed(() => {
  return (
    eventDate.value.trim().length > 0 &&
    startTime.value.trim().length > 0 &&
    endTime.value.trim().length > 0 &&
    venueLocation.value.trim().length > 0
  )
})

const handleSubmit = () => {
  errorMessage.value = ''

  if (!isFormValid.value) {
    errorMessage.value = 'Please fill out all required fields marked with *'
    return
  }

  // Validate start time is before end time
  if (startTime.value >= endTime.value) {
    errorMessage.value = 'End time must be after start time'
    return
  }

  isSubmitting.value = true

  emit('submit', {
    eventDate: eventDate.value,
    startTime: startTime.value,
    endTime: endTime.value,
    venueLocation: venueLocation.value.trim(),
    agreedFee: agreedFee.value ? Number(agreedFee.value) : null,
    songLineup: songLineup.value.trim(),
    requiredEquipment: requiredEquipment.value.trim(),
    isRushBooking: isRushBooking.value
  })

  // Simulated quick submission delay for UI feedback
  setTimeout(() => {
    isSubmitting.value = false
    emit('close')
  }, 400)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md transition-opacity">
      <div
        class="relative w-full max-w-2xl bg-[#131315] border border-[#46464D]/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white animate-in fade-in zoom-in-95 duration-200">
        
        <!-- Header -->
        <div class="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-[#46464D]/40 shrink-0 bg-[#161619]">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-[#1E1E24] border border-[#46464D]/60 flex items-center justify-center overflow-hidden shrink-0">
              <img
                v-if="artistAvatar"
                :src="artistAvatar"
                :alt="artistName"
                class="w-full h-full object-cover" />
              <Icon v-else name="ic:outline-music-note" class="text-xl text-[#D0D4F7]" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="font-Sora font-semibold text-base sm:text-lg text-white">
                  Direct Booking Request
                </h2>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#D0D4F7]/10 border border-[#D0D4F7]/20 text-[#D0D4F7]">
                  {{ artistType }}
                </span>
              </div>
              <p class="text-xs text-gray-400 font-Geist">
                Booking <span class="text-gray-200 font-medium">@{{ artistName }}</span> for an event
              </p>
            </div>
          </div>

          <button
            @click="$emit('close')"
            class="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Close">
            <Icon name="ic:round-close" class="text-xl" />
          </button>
        </div>

        <!-- Scrollable Form Body -->
        <div class="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5 scrollbar-thin">
          
          <!-- ⚡ Rush Booking Warning Banner -->
          <div
            v-if="isRushBooking"
            class="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs sm:text-sm animate-in fade-in duration-200">
            <Icon name="ic:baseline-bolt" class="text-xl text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span class="font-semibold text-amber-300 block mb-0.5">Rush Gig Notice (Due in &le; 5 Days)</span>
              <p class="text-amber-200/90 leading-relaxed text-[11px] sm:text-xs">
                This event is scheduled on short notice. The artist will be flagged with an urgent rush notification to review your request promptly.
              </p>
            </div>
          </div>

          <!-- Date & Time Row -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <!-- Event Date -->
            <div>
              <label class="block text-xs font-semibold text-gray-200 mb-1.5 font-Sora">
                Event Date <span class="text-[#D0D4F7]">*</span>
              </label>
              <input
                type="date"
                v-model="eventDate"
                :min="todayStr"
                class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all" />
            </div>

            <!-- Start Time -->
            <div>
              <label class="block text-xs font-semibold text-gray-200 mb-1.5 font-Sora">
                Start Time <span class="text-[#D0D4F7]">*</span>
              </label>
              <input
                type="time"
                v-model="startTime"
                class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all" />
            </div>

            <!-- End Time -->
            <div>
              <label class="block text-xs font-semibold text-gray-200 mb-1.5 font-Sora">
                End Time <span class="text-[#D0D4F7]">*</span>
              </label>
              <input
                type="time"
                v-model="endTime"
                class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all" />
            </div>
          </div>

          <!-- Venue / Location Input -->
          <div>
            <label class="block text-xs font-semibold text-gray-200 mb-1.5 font-Sora">
              Venue / Complete Location <span class="text-[#D0D4F7]">*</span>
            </label>
            <div class="relative">
              <Icon name="ic:baseline-location-on" class="absolute left-3.5 top-3 text-base text-[#D0D4F7]" />
              <input
                type="text"
                v-model="venueLocation"
                maxlength="150"
                placeholder="e.g. Avenue Plaza Hotel, Magsaysay Ave, Naga City"
                class="w-full pl-10 pr-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all" />
            </div>
          </div>

          <!-- Proposed Budget / Fee -->
          <div>
            <label class="block text-xs font-semibold text-gray-200 mb-1.5 font-Sora">
              Proposed Budget / Fee (PHP ₱) <span class="text-gray-400 font-normal text-xs">(Optional)</span>
            </label>
            <div class="relative">
              <span class="absolute left-3.5 top-2.5 text-sm font-semibold text-gray-400">₱</span>
              <input
                type="number"
                v-model="agreedFee"
                min="0"
                step="500"
                placeholder="e.g. 5000"
                class="w-full pl-8 pr-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all" />
            </div>
          </div>

          <!-- Song Lineup & Special Requests -->
          <div>
            <label class="block text-xs font-semibold text-gray-200 mb-1.5 font-Sora">
              Song Lineup & Preferences <span class="text-gray-400 font-normal text-xs">(Optional)</span>
            </label>
            <textarea
              v-model="songLineup"
              rows="3"
              maxlength="500"
              placeholder="e.g. Acoustic OPM hits, 90s alternative covers, and special entrance song..."
              class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all resize-none"></textarea>
          </div>

          <!-- Equipment & Tech Notes -->
          <div>
            <label class="block text-xs font-semibold text-gray-200 mb-1.5 font-Sora">
              Equipment & Technical Setup <span class="text-gray-400 font-normal text-xs">(Optional)</span>
            </label>
            <textarea
              v-model="requiredEquipment"
              rows="2"
              maxlength="300"
              placeholder="e.g. Venue provides basic sound system and 2 microphones. Artist brings own instruments."
              class="w-full px-3.5 py-2.5 bg-[#1E1E24] border border-[#46464D]/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-[#D0D4F7] focus:ring-1 focus:ring-[#D0D4F7] transition-all resize-none"></textarea>
          </div>

          <!-- Error Message Display -->
          <div v-if="errorMessage" class="p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs flex items-center gap-2">
            <Icon name="ic:round-error-outline" class="text-base shrink-0" />
            <span>{{ errorMessage }}</span>
          </div>

        </div>

        <!-- Footer Actions -->
        <div class="px-5 sm:px-7 py-4 border-t border-[#46464D]/40 bg-[#161619] flex items-center justify-between shrink-0">
          <button
            type="button"
            @click="$emit('close')"
            class="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
            Cancel
          </button>

          <button
            type="button"
            @click="handleSubmit"
            :disabled="!isFormValid || isSubmitting"
            class="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#D0D4F7] hover:bg-white text-[#0E0E10] font-semibold text-xs sm:text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
            <Icon v-if="isSubmitting" name="ic:baseline-sync" class="animate-spin text-base" />
            <Icon v-else name="ic:baseline-send" class="text-base" />
            <span>{{ isSubmitting ? 'Sending Request...' : 'Send Booking Request' }}</span>
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>
