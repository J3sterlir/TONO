<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    artistId: string
    activity?: any | null
    initialDate?: string
    activeGigs?: any[]
  }>(),
  {
    activity: null,
    initialDate: '',
    activeGigs: () => []
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
  (e: 'deleted'): void
}>()

useModalScrollLock(() => props.isOpen)

const supabase = useSupabaseClient()
const db = supabase as any

const isSubmitting = ref(false)
const isDeleting = ref(false)
const errorMessage = ref('')

// Form state
const title = ref('')
const isMultipleDays = ref(false)
const startDate = ref('')
const endDate = ref('')
const startTime = ref('09:00')
const endTime = ref('17:00')
const description = ref('')
const hasAcknowledgedConflict = ref(false)

const isEditMode = computed(() => !!props.activity?.Schedule_ID)

// Today formatted as YYYY-MM-DD
const todayStr = computed(() => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
})

// Populate state on open or activity change
watch(
  () => [props.isOpen, props.activity],
  () => {
    if (!props.isOpen) return
    errorMessage.value = ''
    hasAcknowledgedConflict.value = false

    if (props.activity) {
      title.value = props.activity.Title || ''
      startDate.value = props.activity.Start_Date || todayStr.value
      endDate.value = props.activity.End_Date || props.activity.Start_Date || todayStr.value
      isMultipleDays.value = startDate.value !== endDate.value
      startTime.value = props.activity.Start_Time || '09:00'
      endTime.value = props.activity.End_Time || '17:00'
      description.value = props.activity.Description || ''
    } else {
      title.value = ''
      startDate.value = props.initialDate || todayStr.value
      endDate.value = props.initialDate || todayStr.value
      isMultipleDays.value = false
      startTime.value = '09:00'
      endTime.value = '17:00'
      description.value = ''
    }
  },
  { immediate: true }
)

// Sync endDate with startDate if not multiple days
watch(startDate, (newStart) => {
  if (!isMultipleDays.value) {
    endDate.value = newStart
  } else if (endDate.value && endDate.value < newStart) {
    endDate.value = newStart
  }
})

watch(isMultipleDays, (multi) => {
  if (!multi) {
    endDate.value = startDate.value
  }
})

// Realtime Conflict Detection against Active Gigs
const conflictingGigs = computed(() => {
  if (!startDate.value || !startTime.value || !endTime.value) return []
  const effectiveEnd = isMultipleDays.value && endDate.value ? endDate.value : startDate.value

  return (props.activeGigs || []).filter((gig: any) => {
    // Only check active/confirmed gigs
    if (['Cancelled', 'Declined', 'Voided'].includes(gig.Status)) return false

    const gigStart = gig.Start_Date || gig.Event_Date
    const gigEnd = gig.End_Date || gigStart
    if (!gigStart) return false

    // Date range overlap check: (StartA <= EndB) and (EndA >= StartB)
    const datesOverlap = startDate.value <= gigEnd && effectiveEnd >= gigStart
    if (!datesOverlap) return false

    // Time overlap check: (TimeStartA < TimeEndB) and (TimeEndA > TimeStartB)
    const gigStartTime = gig.Start_Time || '00:00'
    const gigEndTime = gig.End_Time || '23:59'
    const timesOverlap = startTime.value < gigEndTime && endTime.value > gigStartTime

    return timesOverlap
  })
})

const handleSave = async () => {
  if (!title.value.trim()) {
    errorMessage.value = 'Please enter a title for your custom activity.'
    return
  }
  if (!startDate.value) {
    errorMessage.value = 'Please select a date.'
    return
  }
  if (startTime.value >= endTime.value) {
    errorMessage.value = 'End time must be later than start time.'
    return
  }
  if (conflictingGigs.value.length > 0 && !hasAcknowledgedConflict.value) {
    errorMessage.value = 'Please confirm acknowledgment of your existing gig schedule conflict before saving.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  const finalEndDate = isMultipleDays.value && endDate.value ? endDate.value : startDate.value

  try {
    const payload = {
      Artist_ID: props.artistId,
      Title: title.value.trim(),
      Start_Date: startDate.value,
      End_Date: finalEndDate,
      Start_Time: startTime.value,
      End_Time: endTime.value,
      Description: description.value.trim() || null
    }

    if (isEditMode.value) {
      const { error } = await db
        .from('ARTIST_CUSTOM_SCHEDULE')
        .update(payload)
        .eq('Schedule_ID', props.activity.Schedule_ID)

      if (error) throw error
    } else {
      const { error } = await db
        .from('ARTIST_CUSTOM_SCHEDULE')
        .insert(payload)

      if (error) throw error
    }

    emit('saved')
    emit('close')
  } catch (err: any) {
    console.error('Failed to save custom activity:', err)
    errorMessage.value = err.message || 'Failed to save custom activity. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

const handleDelete = async () => {
  if (!isEditMode.value || !props.activity?.Schedule_ID) return
  if (!window.confirm(`Delete custom activity "${props.activity.Title}"? This will free up this schedule slot for client bookings.`)) {
    return
  }

  isDeleting.value = true
  errorMessage.value = ''

  try {
    const { error } = await db
      .from('ARTIST_CUSTOM_SCHEDULE')
      .delete()
      .eq('Schedule_ID', props.activity.Schedule_ID)

    if (error) throw error

    emit('deleted')
    emit('close')
  } catch (err: any) {
    console.error('Failed to delete custom activity:', err)
    errorMessage.value = err.message || 'Failed to delete activity.'
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="emit('close')"></div>

    <!-- Modal Content -->
    <div
      class="relative w-full max-w-lg bg-[#131315] border border-[#2A2A2E]/80 rounded-2xl sm:rounded-3xl p-5 sm:p-7 space-y-5 text-white font-Sora z-10 my-auto shadow-2xl animate-in zoom-in-95 duration-200"
      @click.stop
    >
      <!-- Header -->
      <div class="flex items-start justify-between gap-4 border-b border-[#2A2A2E] pb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-[#D0D4F7]/10 border border-[#D0D4F7]/30 flex items-center justify-center text-[#D0D4F7] shrink-0">
            <Icon :name="isEditMode ? 'ic:outline-edit-calendar' : 'ic:baseline-add-circle-outline'" class="text-xl" />
          </div>
          <div>
            <h3 class="text-lg sm:text-xl font-bold text-white tracking-tight">
              {{ isEditMode ? 'Edit Custom Activity' : 'Add Custom Activity' }}
            </h3>
            <p class="text-xs text-gray-400 mt-0.5">
              Personal rehearsals, studio sessions, or blocked calendar dates.
            </p>
          </div>
        </div>

        <button
          type="button"
          @click="emit('close')"
          class="flex text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
        >
          <Icon name="ic:round-close" class="text-xl" />
        </button>
      </div>

      <!-- Error Alert -->
      <div
        v-if="errorMessage"
        class="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-center justify-between"
      >
        <div class="flex items-center gap-2">
          <Icon name="ic:baseline-error" class="text-base text-red-400 shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>
        <button type="button" @click="errorMessage = ''" class="text-gray-400 hover:text-white cursor-pointer">
          <Icon name="ic:round-close" class="text-base" />
        </button>
      </div>

      <!-- Schedule Conflict Warning Notification -->
      <div
        v-if="conflictingGigs.length > 0"
        class="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs space-y-2 animate-in fade-in"
      >
        <div class="flex items-start gap-2.5">
          <Icon name="ic:baseline-warning" class="text-lg text-amber-400 shrink-0 mt-0.5" />
          <div class="space-y-1">
            <p class="font-bold text-white">Active Gig Schedule Conflict</p>
            <p class="text-[11px] text-amber-300/90 leading-relaxed">
              You already have an active gig/booking during this time:
            </p>
            <ul class="list-disc list-inside space-y-0.5 text-[11px] font-mono text-amber-200">
              <li v-for="cg in conflictingGigs" :key="cg.Booking_ID">
                <span class="font-bold text-white">{{ cg.JOB_LISTING?.Event_Title || cg.Contract_Code || 'Gig' }}</span>
                ({{ cg.Start_Time || 'TBA' }} - {{ cg.End_Time || 'TBA' }})
              </li>
            </ul>
          </div>
        </div>

        <label class="flex items-center gap-2 pt-1 border-t border-amber-500/20 cursor-pointer select-none">
          <input
            v-model="hasAcknowledgedConflict"
            type="checkbox"
            class="rounded border-amber-500/50 bg-[#1C1C1F] text-[#D0D4F7] focus:ring-0 cursor-pointer"
          />
          <span class="text-[11px] text-gray-300">I understand this activity overlaps with my confirmed gig.</span>
        </label>
      </div>

      <!-- Form Inputs -->
      <form @submit.prevent="handleSave" class="space-y-4 text-xs font-Sora">
        <!-- Title -->
        <div class="space-y-1.5">
          <label class="text-[11px] font-mono uppercase tracking-wider text-gray-300 block">
            Activity Title <span class="text-red-400">*</span>
          </label>
          <input
            v-model="title"
            type="text"
            required
            placeholder="e.g. Band Rehearsal, Studio Recording, Personal Leave"
            class="w-full px-3.5 py-2.5 rounded-xl bg-[#1C1C1F] border border-[#2A2A2E] text-white placeholder-gray-500 focus:outline-none focus:border-[#D0D4F7] transition-all text-xs"
          />
        </div>

        <!-- Date Mode Toggle -->
        <div class="flex items-center justify-between py-1 border-y border-[#2A2A2E]/60">
          <span class="text-xs text-gray-300 font-medium">Multiple Days / Date Range</span>
          <button
            type="button"
            @click="isMultipleDays = !isMultipleDays"
            class="relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
            :class="isMultipleDays ? 'bg-[#D0D4F7]' : 'bg-[#2A2A2E]'"
          >
            <span
              class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-[#131315] shadow-lg ring-0 transition duration-200 ease-in-out"
              :class="isMultipleDays ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>

        <!-- Dates -->
        <div class="grid gap-3" :class="isMultipleDays ? 'grid-cols-2' : 'grid-cols-1'">
          <div class="space-y-1.5">
            <label class="text-[11px] font-mono uppercase tracking-wider text-gray-400 block">
              {{ isMultipleDays ? 'Start Date' : 'Date' }} <span class="text-red-400">*</span>
            </label>
            <input
              v-model="startDate"
              type="date"
              required
              class="w-full px-3 py-2 rounded-xl bg-[#1C1C1F] border border-[#2A2A2E] text-white focus:outline-none focus:border-[#D0D4F7] transition-all text-xs font-mono"
            />
          </div>

          <div v-if="isMultipleDays" class="space-y-1.5">
            <label class="text-[11px] font-mono uppercase tracking-wider text-gray-400 block">
              End Date <span class="text-red-400">*</span>
            </label>
            <input
              v-model="endDate"
              type="date"
              required
              :min="startDate"
              class="w-full px-3 py-2 rounded-xl bg-[#1C1C1F] border border-[#2A2A2E] text-white focus:outline-none focus:border-[#D0D4F7] transition-all text-xs font-mono"
            />
          </div>
        </div>

        <!-- Times -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="text-[11px] font-mono uppercase tracking-wider text-gray-400 block">
              Start Time <span class="text-red-400">*</span>
            </label>
            <input
              v-model="startTime"
              type="time"
              required
              class="w-full px-3 py-2 rounded-xl bg-[#1C1C1F] border border-[#2A2A2E] text-white focus:outline-none focus:border-[#D0D4F7] transition-all text-xs font-mono"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-[11px] font-mono uppercase tracking-wider text-gray-400 block">
              End Time <span class="text-red-400">*</span>
            </label>
            <input
              v-model="endTime"
              type="time"
              required
              class="w-full px-3 py-2 rounded-xl bg-[#1C1C1F] border border-[#2A2A2E] text-white focus:outline-none focus:border-[#D0D4F7] transition-all text-xs font-mono"
            />
          </div>
        </div>

        <!-- Description -->
        <div class="space-y-1.5">
          <label class="text-[11px] font-mono uppercase tracking-wider text-gray-400 block">
            Notes / Description (Optional)
          </label>
          <textarea
            v-model="description"
            rows="2"
            placeholder="Private notes about this activity..."
            class="w-full px-3.5 py-2.5 rounded-xl bg-[#1C1C1F] border border-[#2A2A2E] text-white placeholder-gray-500 focus:outline-none focus:border-[#D0D4F7] transition-all text-xs resize-none"
          ></textarea>
        </div>

        <!-- Action Footer -->
        <div class="flex items-center justify-between pt-3 border-t border-[#2A2A2E]">
          <!-- Delete button (only in edit mode) -->
          <div>
            <button
              v-if="isEditMode"
              type="button"
              :disabled="isDeleting || isSubmitting"
              @click="handleDelete"
              class="px-3.5 py-2 rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/10 hover:border-red-500/60 transition-all text-xs font-medium cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Icon v-if="isDeleting" name="ic:baseline-sync" class="animate-spin text-sm" />
              <Icon v-else name="ic:baseline-delete" class="text-sm" />
              <span>Delete</span>
            </button>
          </div>

          <!-- Cancel & Save -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="emit('close')"
              class="px-4 py-2 rounded-xl border border-[#3A3A3C] hover:border-gray-400 text-gray-300 hover:text-white transition-all text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isSubmitting || isDeleting"
              class="px-5 py-2 rounded-xl bg-[#D0D4F7] hover:bg-white text-[#0E0E10] font-bold transition-all text-xs cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              <Icon v-if="isSubmitting" name="ic:baseline-sync" class="animate-spin text-sm" />
              <Icon v-else name="ic:round-check" class="text-sm" />
              <span>{{ isEditMode ? 'Update Activity' : 'Save Activity' }}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>
