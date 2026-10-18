<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useTonoReviews, type FeedbackReviewItem } from '~/composables/useTonoReviews'

const props = withDefaults(
  defineProps<{
    targetArtistId?: string | null
    targetBusinessId?: string | null
    targetAccountId?: string | null
    emptyMessage?: string
  }>(),
  {
    targetArtistId: null,
    targetBusinessId: null,
    targetAccountId: null,
    emptyMessage: ''
  }
)

const { fetchReviewsForTarget, isLoading, error } = useTonoReviews()
const reviews = ref<FeedbackReviewItem[]>([])

const loadReviews = async () => {
  if (!props.targetArtistId && !props.targetBusinessId && !props.targetAccountId) {
    reviews.value = []
    return
  }

  reviews.value = await fetchReviewsForTarget({
    artistId: props.targetArtistId || undefined,
    businessId: props.targetBusinessId || undefined,
    accountId: props.targetAccountId || undefined
  })
}

onMounted(() => {
  loadReviews()
})

watch(
  () => [props.targetArtistId, props.targetBusinessId, props.targetAccountId],
  () => {
    loadReviews()
  }
)

const formatReviewDate = (dateStr?: string | null) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return dateStr
  }
}

const getReviewStars = (score: number | string | null | undefined) => {
  const num = Math.min(5, Math.max(0, Number(score) || 0))
  const full = Math.floor(num)
  const half = num % 1 >= 0.5 ? 1 : 0
  const empty = Math.max(0, 5 - full - half)
  return { full, half, empty }
}
</script>

<template>
  <div class="space-y-4 font-Sora">
    <!-- Loading State -->
    <div v-if="isLoading" class="space-y-3 animate-pulse">
      <div v-for="i in 3" :key="i" class="h-28 bg-[#1C1C1F] rounded-2xl border border-[#2A2A2E]"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="p-4 rounded-2xl bg-red-950/20 border border-red-500/30 text-red-300 text-xs text-center">
      {{ error }}
    </div>

    <!-- Empty State -->
    <div
      v-else-if="reviews.length === 0"
      class="text-center py-16 px-4 bg-[#141416]/50 border border-dashed border-[#2A2A2E] rounded-2xl space-y-3"
    >
      <Icon name="ic:outline-rate-review" class="text-4xl text-gray-500 mx-auto" />
      <h3 class="text-base font-semibold text-white">No Reviews Yet</h3>
      <p class="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
        {{ emptyMessage }}
      </p>
    </div>

    <!-- Reviews List -->
    <div v-else class="flex flex-wrap gap-4">
      <div
        v-for="rev in reviews"
        :key="rev.Review_ID"
        class="bg-[#1C1C1F]/80 border border-[#2A2A2E] hover:border-[#3A3A3C] rounded-2xl p-5 space-y-3 transition-colors shadow-sm w-fit max-w-xl"
      >
        <div class="flex items-center gap-3">
          <!-- Reviewer Avatar -->
          <div class="w-10 h-10 rounded-full bg-[#2A2A2E] overflow-hidden shrink-0 border border-[#3A3A3C]">
            <img
              v-if="rev.Reviewer?.Profile_Picture"
              :src="rev.Reviewer.Profile_Picture"
              :alt="rev.Reviewer.Username || 'Reviewer'"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-gray-400 font-bold text-xs uppercase">
              {{ (rev.Reviewer?.Username || 'U').charAt(0) }}
            </div>
          </div>

          <!-- Reviewer Info: Username, 5-Star Rating, and Date -->
          <div class="min-w-0">
            <h4 class="text-sm font-bold text-white leading-tight mb-1 truncate">
              {{ rev.Reviewer?.Username || 'Verified User' }}
            </h4>
            <div class="flex items-center gap-2 flex-wrap">
              <!-- Rating Stars (Always 5 Stars Total) -->
              <div class="flex items-center gap-0.5 text-amber-400 text-sm">
                <span class="font-bold text-xs mr-1 text-amber-400">{{ (Number(rev.Rating_Score) || 0).toFixed(1) }}</span>
                <!-- Filled Stars -->
                <Icon
                  v-for="s in getReviewStars(rev.Rating_Score).full"
                  :key="`${rev.Review_ID}-full-${s}`"
                  name="ic:baseline-star"
                  class="text-amber-400"
                />
                <!-- Half Star -->
                <Icon
                  v-if="getReviewStars(rev.Rating_Score).half"
                  name="ic:baseline-star-half"
                  class="text-amber-400"
                />
                <!-- Empty / Unshaded Stars -->
                <Icon
                  v-for="e in getReviewStars(rev.Rating_Score).empty"
                  :key="`${rev.Review_ID}-empty-${e}`"
                  name="ic:baseline-star-outline"
                  class="text-gray-600"
                />
              </div>

              <!-- Date Separator & Review Date -->
              <span class="text-gray-600 text-xs font-mono">|</span>
              <span class="text-[11px] text-gray-400 font-mono">
                {{ formatReviewDate(rev.Created_At) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Written Feedback -->
        <p
          v-if="rev.Written_Feedback"
          class="text-xs text-gray-300 leading-relaxed pl-13 font-normal wrap-break-word"
        >
          "{{ rev.Written_Feedback }}"
        </p>
      </div>
    </div>
  </div>
</template>
