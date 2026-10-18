<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTonoReviews } from '~/composables/useTonoReviews'

const props = withDefaults(
  defineProps<{
    score?: number | null
    totalReviews?: number
    penalty?: number | null
    targetArtistId?: string | null
    targetBusinessId?: string | null
    targetAccountId?: string | null
    inline?: boolean
    showSanctionBadge?: boolean
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    score: null,
    totalReviews: 0,
    penalty: 0,
    targetArtistId: null,
    targetBusinessId: null,
    targetAccountId: null,
    inline: false,
    showSanctionBadge: true,
    size: 'sm'
  }
)

const { fetchRatingForAccount, fetchRatingForArtist, fetchRatingForBusiness } = useTonoReviews()
const fetchedRating = ref<{ score: number | null; totalReviews: number; penalty: number } | null>(null)

const loadTargetRating = async () => {
  if (props.score !== null && props.score !== undefined) return

  if (props.targetArtistId) {
    const res = await fetchRatingForArtist(props.targetArtistId)
    if (res) {
      fetchedRating.value = {
        score: res.final_rating,
        totalReviews: res.total_reviews,
        penalty: res.Penalty_Rating_Deduction ?? 0
      }
    }
  } else if (props.targetBusinessId) {
    const res = await fetchRatingForBusiness(props.targetBusinessId)
    if (res) {
      fetchedRating.value = {
        score: res.final_rating,
        totalReviews: res.total_reviews,
        penalty: res.Penalty_Rating_Deduction ?? 0
      }
    }
  } else if (props.targetAccountId) {
    const res = await fetchRatingForAccount(props.targetAccountId)
    if (res) {
      fetchedRating.value = {
        score: res.final_rating,
        totalReviews: res.total_reviews,
        penalty: res.Penalty_Rating_Deduction ?? 0
      }
    }
  }
}

onMounted(() => {
  loadTargetRating()
})

watch(
  () => [props.targetArtistId, props.targetBusinessId, props.targetAccountId, props.score],
  () => {
    loadTargetRating()
  }
)

const effectiveScore = computed(() => {
  if (props.score !== null && props.score !== undefined) return props.score
  return fetchedRating.value?.score ?? null
})

const effectiveTotalReviews = computed(() => {
  if (props.totalReviews && props.totalReviews > 0) return props.totalReviews
  return fetchedRating.value?.totalReviews ?? 0
})

const effectivePenalty = computed(() => {
  if (props.penalty && props.penalty > 0) return props.penalty
  return fetchedRating.value?.penalty ?? 0
})

const hasReviews = computed(() => {
  return effectiveTotalReviews.value > 0 && effectiveScore.value !== null && effectiveScore.value !== undefined
})

const displayScore = computed(() => {
  if (!hasReviews.value || effectiveScore.value === null || effectiveScore.value === undefined) return null
  return Number(effectiveScore.value).toFixed(1)
})

const starsCount = computed(() => {
  const num = Number(effectiveScore.value) || 0
  return {
    full: Math.floor(num),
    half: num % 1 >= 0.5 ? 1 : 0,
    empty: 5 - Math.floor(num) - (num % 1 >= 0.5 ? 1 : 0)
  }
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'lg':
      return {
        text: 'text-base font-bold',
        stars: 'text-lg',
        count: 'text-xs',
        badge: 'text-xs px-2.5 py-1'
      }
    case 'md':
      return {
        text: 'text-sm font-semibold',
        stars: 'text-sm',
        count: 'text-xs',
        badge: 'text-[11px] px-2 py-0.5'
      }
    default:
      return {
        text: 'text-xs font-semibold',
        stars: 'text-xs',
        count: 'text-[11px]',
        badge: 'text-[10px] px-1.5 py-0.5'
      }
  }
})
</script>

<template>
  <div class="inline-flex items-center gap-1.5 font-Sora select-none">
    <!-- State 1: Zero reviews -->
    <template v-if="!hasReviews">
      <div
        v-if="inline"
        class="inline-flex items-center gap-1 text-gray-400 font-medium"
        :class="sizeClasses.count"
      >
        <Icon name="ic:outline-star-outline" class="text-gray-500" :class="sizeClasses.stars" />
        <span>No reviews yet</span>
      </div>
      <div
        v-else
        class="inline-flex items-center gap-1.5 rounded-full bg-[#1C1C1F] border border-[#2A2A2E] text-gray-400 font-medium"
        :class="sizeClasses.badge"
      >
        <Icon name="ic:outline-star-outline" class="text-gray-500 text-xs" />
        <span>No reviews yet</span>
      </div>
    </template>

    <!-- State 2: Has reviews -->
    <template v-else>
      <div class="flex items-center gap-1">
        <!-- Numerical score -->
        <span class="text-amber-400 font-bold" :class="sizeClasses.text">
          {{ displayScore }}
        </span>

        <!-- Star glyphs -->
        <div class="flex items-center text-amber-400" :class="sizeClasses.stars">
          <Icon
            v-for="i in starsCount.full"
            :key="`full-${i}`"
            name="ic:baseline-star"
          />
          <Icon
            v-if="starsCount.half"
            name="ic:baseline-star-half"
          />
          <Icon
            v-for="i in starsCount.empty"
            :key="`empty-${i}`"
            name="ic:baseline-star-outline"
            class="text-gray-600"
          />
        </div>

        <!-- Total review count -->
        <span class="text-gray-400" :class="sizeClasses.count">
          ({{ effectiveTotalReviews }} {{ effectiveTotalReviews === 1 ? 'review' : 'reviews' }})
        </span>
      </div>

      <!-- Sanction indicator if penalty was applied -->
      <span
        v-if="showSanctionBadge && effectivePenalty && Number(effectivePenalty) > 0"
        class="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/30"
        title="Rating deduction applied due to platform penalty / cancellation sanctions"
      >
        -{{ Number(effectivePenalty).toFixed(1) }} Sanction
      </span>
    </template>
  </div>
</template>
