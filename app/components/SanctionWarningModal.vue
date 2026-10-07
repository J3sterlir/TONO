<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    actionType?: 'cancel' | 'modify'
    targetType?: 'job' | 'contract'
    itemTitle?: string
    startDate?: string
  }>(),
  {
    actionType: 'cancel',
    targetType: 'job',
    itemTitle: 'Gig / Event',
    startDate: ''
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', reason: string, isLate: boolean): void
}>()

const isAcknowledged = ref(false)
const cancellationReason = ref('')
const isSubmitting = ref(false)

// Disable background scroll while modal is open
useModalScrollLock(() => props.isOpen)

const daysRemaining = computed(() => {
  if (!props.startDate) return 0
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(props.startDate)
  target.setHours(0, 0, 0, 0)
  const diffTime = target.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

const isLate = computed(() => {
  if (!props.startDate) return false
  return daysRemaining.value <= 5 && daysRemaining.value >= 0
})

// Reset state when modal opens
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      // For standard non-late cancellations, auto-acknowledge so user can confirm easily
      isAcknowledged.value = !isLate.value
      cancellationReason.value = ''
      isSubmitting.value = false
    }
  }
)

const canConfirm = computed(() => {
  if (isSubmitting.value) return false
  if (isLate.value) {
    return isAcknowledged.value
  }
  return true
})

const handleConfirm = () => {
  if (isLate.value && !isAcknowledged.value) return
  isSubmitting.value = true
  const defaultReason = isLate.value
    ? `Late ${props.actionType} within 5 days of scheduled event`
    : `Standard ${props.actionType} in advance`
  emit('confirm', cancellationReason.value.trim() || defaultReason, isLate.value)
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 h-full">
    <!-- Backdrop -->
    <div
      class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in"
      @click="emit('close')"
    ></div>

    <!-- Modal Card -->
    <div
      class="relative w-full max-w-lg bg-[#131315] border rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6 text-white z-10 font-Sora animate-in zoom-in-95 duration-200"
      :class="isLate ? 'border-amber-500/40' : 'border-[#2A2A2E]'"
    >
      <!-- Header -->
      <div class="flex items-start gap-4">
        <!-- Icon -->
        <div
          v-if="isLate"
          class="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0"
        >
          <Icon name="ic:baseline-warning-amber" class="text-2xl text-amber-400 animate-pulse" />
        </div>
        <div
          v-else
          class="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0"
        >
          <Icon name="ic:baseline-event-note" class="text-2xl text-blue-400" />
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <!-- Late 5-Day Badge -->
            <span
              v-if="isLate"
              class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30"
            >
              5-Day Proximity Warning
            </span>
            <!-- Standard Cancellation Badge -->
            <span
              v-else-if="daysRemaining > 5"
              class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30"
            >
              Standard Notice
            </span>
            <!-- Past Event Badge -->
            <span
              v-else
              class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-gray-500/20 text-gray-300 border border-gray-500/30"
            >
              Past Event
            </span>

            <span v-if="daysRemaining >= 0" class="text-xs text-gray-400 font-mono">
              Due in {{ daysRemaining }} {{ daysRemaining === 1 ? 'day' : 'days' }}
            </span>
          </div>

          <h2 class="text-xl font-bold text-white mt-1">
            {{ actionType === 'cancel' ? 'Cancel' : 'Modify' }} {{ targetType === 'job' ? 'Job Listing' : 'Booking Contract' }}?
          </h2>
          <p class="text-xs text-[#D0D4F7] truncate mt-0.5 font-medium">
            {{ itemTitle }}
          </p>
        </div>

        <button
          type="button"
          @click="emit('close')"
          class="text-gray-400 hover:text-white transition-colors cursor-pointer p-1"
        >
          <Icon name="ic:round-close" class="text-xl" />
        </button>
      </div>

      <!-- Policy Notice Box: Late Sanction vs Standard Cancellation -->
      <div
        v-if="isLate"
        class="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2 text-xs leading-relaxed text-amber-200/90"
      >
        <p class="font-semibold text-amber-300 flex items-center gap-1.5">
          <Icon name="ic:baseline-warning" class="text-base shrink-0 text-amber-400" />
          <span>Late Cancellation / Modification Policy</span>
        </p>
        <p class="text-gray-300">
          This event is scheduled within the next <strong>5 days</strong> (due in {{ daysRemaining }} {{ daysRemaining === 1 ? 'day' : 'days' }}). Short-notice cancellations disrupt performer schedules, logistics, and partner venue preparations.
        </p>
        <p class="text-amber-200">
          <strong>Important:</strong> Proceeding with this late {{ actionType }} will be logged and may incur platform sanctions or affect your reliability score.
        </p>
      </div>

      <div
        v-else
        class="p-4 rounded-xl bg-[#1C1C1F] border border-[#2A2A2E] space-y-2 text-xs leading-relaxed text-gray-300"
      >
        <p class="font-semibold text-blue-300 flex items-center gap-1.5">
          <Icon name="ic:baseline-check-circle" class="text-base shrink-0 text-blue-400" />
          <span>Standard Cancellation Notice</span>
        </p>
        <p class="text-gray-400">
          This gig is scheduled in <strong>{{ daysRemaining }} days</strong>, which is outside the 5-day proximity threshold. Cancelling now frees up performance slots without late penalty sanctions.
        </p>
      </div>

      <!-- Reason Input -->
      <div class="space-y-1.5">
        <label class="block text-xs font-mono tracking-wider text-gray-300 uppercase">
          Reason for {{ actionType === 'cancel' ? 'Cancellation' : 'Modification' }}
          <span v-if="isLate" class="text-amber-400 font-bold">(Required for late actions)</span>
          <span v-else class="text-gray-500 font-normal">(Optional)</span>
        </label>
        <textarea
          v-model="cancellationReason"
          rows="3"
          :placeholder="isLate ? 'Please explain why you need to cancel within 5 days...' : 'Optional notes on cancellation reason...'"
          class="w-full bg-[#18181B] border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition-colors resize-none"
          :class="isLate ? 'border-[#3A3A3C] focus:border-amber-500/60' : 'border-[#3A3A3C] focus:border-blue-500/60'"
        ></textarea>
      </div>

      <!-- Acknowledgment Checkbox (Only for Late Sanctions) -->
      <label v-if="isLate" class="flex items-start gap-3 cursor-pointer select-none group">
        <input
          type="checkbox"
          v-model="isAcknowledged"
          class="mt-0.5 rounded border-[#46464D] text-amber-500 focus:ring-amber-500 bg-[#1C1C1F] cursor-pointer"
        />
        <span class="text-xs text-gray-300 group-hover:text-white transition-colors">
          I understand that this event is within 5 days and acknowledge the potential platform sanctions for short-notice {{ actionType }}.
        </span>
      </label>

      <!-- Action Buttons -->
      <div class="flex items-center justify-end gap-3 pt-2 border-t border-[#2A2A2E]">
        <button
          type="button"
          @click="emit('close')"
          class="px-5 py-2.5 rounded-full text-xs font-medium border border-[#46464D] text-gray-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
        >
          Keep Booking
        </button>
        <button
          type="button"
          @click="handleConfirm"
          :disabled="!canConfirm"
          class="px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          :class="isLate ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30' : 'bg-[#D0D4F7] hover:bg-white text-[#131315] shadow'"
        >
          <Icon v-if="isSubmitting" name="ic:baseline-sync" class="animate-spin text-sm" />
          <span>{{ isLate ? `Proceed with Late ${actionType === 'cancel' ? 'Cancellation' : 'Modification'}` : `Confirm ${actionType === 'cancel' ? 'Cancellation' : 'Modification'}` }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
