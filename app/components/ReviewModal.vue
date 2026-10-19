<script setup lang="ts">
import { ref, computed, watch } from 'vue'

defineOptions({
  inheritAttrs: false
})

interface ReviewModalProps {
  isOpen: boolean
  booking?: any | null
  reviewerAccountId?: string | null
  bookingId?: string | null
  contractCode?: string | null
  eventTitle?: string | null
  eventDate?: string | null
  targetName?: string
  targetRole?: string
  targetArtistId?: string | null
  targetBusinessId?: string | null
  targetAccountId?: string | null
}

const props = withDefaults(
  defineProps<ReviewModalProps>(),
  {
    isOpen: false,
    booking: null,
    reviewerAccountId: null,
    bookingId: null,
    contractCode: '',
    eventTitle: 'Live Gig Event',
    eventDate: '',
    targetName: 'Artist / Host',
    targetRole: 'Partner',
    targetArtistId: null,
    targetBusinessId: null,
    targetAccountId: null
  }
)

import { useTonoReviews } from '~/composables/useTonoReviews'

const emit = defineEmits<{
  close: []
  submitted: [review: any]
}>()

useModalScrollLock(() => props.isOpen)

const user = useSupabaseUser()
const { fetchCurrentUserProfile } = useTonoAuth()
const { submitReview, isLoading } = useTonoReviews()

const selectedRating = ref<number>(5)
const hoverRating = ref<number>(0)
const previousRating = ref<number>(5)
const writtenFeedback = ref<string>('')
const formError = ref<string>('')
const formSuccess = ref<string>('')
const currentAccountId = ref<string>('')

const scoreLabels: Record<number, string> = {
  1: 'Very Poor',
  2: 'Poor',
  3: 'Average / Fair',
  4: 'Good / Recommended',
  5: 'Exceptional Performance!'
}

const resolvedBookingId = computed(() => {
  return props.bookingId || props.booking?.Booking_ID || null
})

const resolvedContractCode = computed(() => {
  return props.contractCode || props.booking?.Contract_Code || ''
})

const resolvedEventTitle = computed(() => {
  if (props.eventTitle && props.eventTitle !== 'Live Gig Event') return props.eventTitle
  return props.booking?.JOB_LISTING?.Event_Title || props.booking?.Event_Title || props.booking?.Event_Name || props.eventTitle || 'Live Gig Event'
})

const resolvedEventDate = computed(() => {
  if (props.eventDate) return props.eventDate
  return props.booking?.Start_Date || props.booking?.Event_Date || props.booking?.Date || ''
})

const resolvedTargetName = computed(() => {
  if (props.targetName && props.targetName !== 'Artist / Host' && props.targetName !== 'Performing Artist') {
    return props.targetName
  }
  const artist = props.booking?.ARTIST
  if (artist) {
    return artist.StageName?.[0]?.Artist_Name || artist.BandName?.[0]?.Band_Name || artist.USER_ACCOUNT?.Username || props.targetName || 'Performing Artist'
  }
  const business = props.booking?.BUSINESS_PROFILE || props.booking?.JOB_LISTING?.BUSINESS_PROFILE
  if (business?.Business_Name) {
    return business.Business_Name
  }
  return props.targetName || 'Artist / Host'
})

const resolvedTargetRole = computed(() => {
  if (props.targetRole && props.targetRole !== 'Partner') return props.targetRole
  if (resolvedTargetArtistId.value) return 'Performing Artist'
  if (resolvedTargetBusinessId.value) return 'Venue Host'
  return 'Partner'
})

const resolvedTargetArtistId = computed(() => {
  return props.targetArtistId || props.booking?.Provider_Artist_ID || null
})

const resolvedTargetBusinessId = computed(() => {
  return props.targetBusinessId || props.booking?.Provider_Business_ID || props.booking?.JOB_LISTING?.Posted_By_BUSINESS_ID || null
})

const resolvedTargetAccountId = computed(() => {
  return props.targetAccountId || props.booking?.Requester_Account_ID || null
})

const resolvedReviewerAccountId = computed(() => {
  return props.reviewerAccountId || currentAccountId.value || user.value?.id || ''
})

const activeDisplayRating = computed(() => {
  return hoverRating.value > 0 ? hoverRating.value : selectedRating.value
})

const setHover = (star: number) => {
  if (activeDisplayRating.value !== star) {
    previousRating.value = activeDisplayRating.value
  }
  hoverRating.value = star
}

const handleSelect = (star: number) => {
  previousRating.value = activeDisplayRating.value
  selectedRating.value = star
  hoverRating.value = star
}

const handleMouseLeaveContainer = () => {
  // Retain the last hovered star state so it doesn't jump back to 5
  if (hoverRating.value > 0) {
    previousRating.value = activeDisplayRating.value
    selectedRating.value = hoverRating.value
    hoverRating.value = 0
  }
}

const getStarTransitionStyle = (star: number) => {
  const current = activeDisplayRating.value
  const prev = previousRating.value

  // Staggered incremental skips when stepping up
  if (current > prev && star > prev && star <= current) {
    const step = star - prev
    return {
      transitionDelay: `${step * 35}ms`
    }
  }
  // Staggered incremental skips when stepping down
  if (current < prev && star > current && star <= prev) {
    const step = prev - star
    return {
      transitionDelay: `${step * 35}ms`
    }
  }
  return {
    transitionDelay: '0ms'
  }
}

watch(
  () => props.isOpen,
  async (open) => {
    if (open) {
      selectedRating.value = 5
      hoverRating.value = 0
      previousRating.value = 5
      writtenFeedback.value = ''
      formError.value = ''
      formSuccess.value = ''

      try {
        const profile = await fetchCurrentUserProfile()
        if (profile?.account) {
          currentAccountId.value = profile.account.ACCOUNT_ID
        }
      } catch (err) {
        console.warn('Failed to load user account for review modal:', err)
      }
    }
  },
  { immediate: true }
)

const handleSubmit = async () => {
  formError.value = ''
  formSuccess.value = ''

  const reviewerId = resolvedReviewerAccountId.value
  if (!reviewerId) {
    formError.value = 'Please sign in to submit a review.'
    return
  }

  if (selectedRating.value < 1 || selectedRating.value > 5) {
    formError.value = 'Please select a star rating between 1 and 5.'
    return
  }

  try {
    const result = await submitReview({
      bookingId: resolvedBookingId.value,
      reviewerAccountId: reviewerId,
      targetArtistId: resolvedTargetArtistId.value,
      targetBusinessId: resolvedTargetBusinessId.value,
      targetAccountId: resolvedTargetAccountId.value,
      ratingScore: selectedRating.value,
      writtenFeedback: writtenFeedback.value
    })

    formSuccess.value = 'Thank you! Your review has been submitted successfully.'
    emit('submitted', result)

    setTimeout(() => {
      emit('close')
    }, 1200)
  } catch (err: any) {
    formError.value = err.message || 'Failed to submit review. You may have already reviewed this gig.'
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      @click.self="emit('close')"
    >
      <div
        class="bg-[#1C1C1F] border border-[#2A2A2E] rounded-2xl max-w-lg w-full p-6 sm:p-7 space-y-6 shadow-2xl relative font-Sora text-white"
      >
        <!-- Close Button -->
        <button
          type="button"
          @click="emit('close')"
          class="absolute top-5 right-5 text-gray-400 hover:text-white transition-colors cursor-pointer p-1"
        >
          <Icon name="ic:round-close" class="text-xl" />
        </button>

        <!-- Header -->
        <div class="space-y-1">
          <span class="text-[10px] font-mono text-[#D0D4F7] uppercase tracking-wider">
            Gig Completion Feedback • {{ resolvedContractCode || 'DIRECT-BOOKING' }}
          </span>
          <h2 class="text-xl sm:text-2xl font-bold tracking-tight">
            Rate &amp; Review {{ resolvedTargetName }}
          </h2>
          <p class="text-xs text-gray-400">
            Share your experience for <span class="text-gray-200 font-medium">{{ resolvedEventTitle }}</span>
            <span v-if="resolvedEventDate"> on {{ resolvedEventDate }}</span>.
          </p>
        </div>

        <!-- 5-Star Interactive Picker -->
        <div
          class="flex flex-col items-center justify-center py-4 bg-[#141416] border border-[#2A2A2E] rounded-xl space-y-2 select-none"
          @mouseleave="handleMouseLeaveContainer"
        >
          <div class="flex items-center gap-1 sm:gap-1.5 p-1">
            <button
              v-for="star in 5"
              :key="star"
              type="button"
              class="relative p-1 sm:p-1.5 cursor-pointer focus:outline-none transition-transform duration-150 ease-out hover:scale-115 active:scale-90"
              @mouseenter="setHover(star)"
              @click="handleSelect(star)"
            >
              <Icon
                :name="star <= activeDisplayRating ? 'ic:baseline-star' : 'ic:baseline-star-outline'"
                class="text-3xl sm:text-4xl transition-all duration-200 ease-out"
                :class="star <= activeDisplayRating
                  ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.45)]'
                  : 'text-gray-600 hover:text-gray-400'"
                :style="getStarTransitionStyle(star)"
              />
            </button>
          </div>
          <span class="text-xs font-semibold text-amber-300 transition-colors duration-200">
            {{ scoreLabels[activeDisplayRating] || `${activeDisplayRating} Stars` }}
          </span>
        </div>

        <!-- Written Feedback -->
        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs">
            <label for="review-feedback" class="font-medium text-gray-300">
              Written Testimonial <span class="text-gray-500 font-normal">(Optional)</span>
            </label>
            <span class="text-[10px] text-gray-500 font-mono">{{ writtenFeedback.length }}/500</span>
          </div>
          <textarea
            id="review-feedback"
            v-model="writtenFeedback"
            maxlength="500"
            rows="3"
            placeholder="Tell other hosts and artists about their punctuality, sound quality, communication, and professionalism..."
            class="w-full bg-[#141416] border border-[#3A3A3C] focus:border-[#D0D4F7] rounded-xl p-3.5 text-xs text-white placeholder-gray-500 outline-none resize-none leading-relaxed transition-colors"
          ></textarea>
        </div>

        <!-- Alerts -->
        <div v-if="formError" class="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
          <Icon name="ic:outline-error-outline" class="text-base text-red-400 shrink-0" />
          <span>{{ formError }}</span>
        </div>

        <div v-if="formSuccess" class="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
          <Icon name="ic:outline-check-circle" class="text-base text-emerald-400 shrink-0" />
          <span>{{ formSuccess }}</span>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            @click="emit('close')"
            :disabled="isLoading"
            class="px-4 py-2 rounded-full text-xs font-medium text-gray-400 hover:text-white border border-[#3A3A3C] hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="handleSubmit"
            :disabled="isLoading"
            class="px-6 py-2 rounded-full text-xs font-bold text-[#131315] bg-[#D0D4F7] hover:bg-white transition-all cursor-pointer disabled:opacity-50 shadow flex items-center gap-1.5"
          >
            <Icon v-if="isLoading" name="ic:baseline-sync" class="animate-spin text-sm" />
            <span>{{ isLoading ? 'Submitting...' : 'Submit Review' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
