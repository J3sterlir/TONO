<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

definePageMeta({
  middleware: 'auth'
})

const supabase = useSupabaseClient()
const { fetchCurrentUserProfile } = useTonoAuth()

const account = ref<any>(null)
const isLoading = ref(true)
const contestText = ref('')
const isSubmittingAppeal = ref(false)
const appealSubmitted = ref(false)
const appealError = ref('')
const now = ref(Date.now())

let timer: any = null

onMounted(async () => {
  const { data: authData } = await supabase.auth.getUser()
  if (authData?.user) {
    const profile = await fetchCurrentUserProfile(authData.user.id)
    account.value = profile?.account || null
    if (account.value?.Ban_Contested) {
      appealSubmitted.value = true
    }
  }
  isLoading.value = false

  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

const isPermanentlyBanned = computed(() => account.value?.Is_Banned === true)

const isSuspended = computed(() => {
  if (!account.value?.Is_Suspended || !account.value?.Suspended_Until) return false
  return new Date(account.value.Suspended_Until).getTime() > now.value
})

const formattedExpiration = computed(() => {
  if (!account.value?.Suspended_Until) return ''
  return new Date(account.value.Suspended_Until).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
})

const remainingTimeText = computed(() => {
  if (!account.value?.Suspended_Until) return ''
  const diff = new Date(account.value.Suspended_Until).getTime() - now.value
  if (diff <= 0) return 'Suspension expired. Please refresh the page.'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  if (days > 0) return `${days}d ${hours}h ${minutes}m remaining`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s remaining`
  return `${minutes}m ${seconds}s remaining`
})

const officialReason = computed(() => {
  if (isPermanentlyBanned.value) {
    return account.value?.Ban_Reason || 'Violating community guidelines or platform terms of service.'
  }
  return account.value?.Suspension_Reason || 'Temporary restriction due to platform policy violations.'
})

const strikeLevel = computed(() => {
  return account.value?.Strike_Count || (isPermanentlyBanned.value ? 3 : 1)
})

const handleSubmitAppeal = async () => {
  if (!contestText.value.trim() || isSubmittingAppeal.value) return
  isSubmittingAppeal.value = true
  appealError.value = ''

  try {
    const res = await $fetch<{ success: boolean; message: string }>('/api/user/contest-ban', {
      method: 'POST',
      body: {
        contestMessage: contestText.value.trim()
      }
    })

    if (res?.success) {
      appealSubmitted.value = true
      if (account.value) {
        account.value.Ban_Contested = true
      }
    }
  } catch (err: any) {
    appealError.value = err?.data?.statusMessage || err?.message || 'Failed to submit appeal.'
  } finally {
    isSubmittingAppeal.value = false
  }
}

const handleLogout = async () => {
  await supabase.auth.signOut()
  navigateTo('/Login')
}
</script>

<template>
  <head>
    <title>{{ isPermanentlyBanned ? 'Account Banned' : 'Account Suspended' }} | TONO</title>
  </head>
  <div class="min-h-screen bg-[#0E0E10] text-white flex flex-col items-center justify-center p-4 sm:p-6 font-Geist">
    <div v-if="isLoading" class="flex flex-col items-center gap-3">
      <Icon name="ic:baseline-sync" class="animate-spin text-3xl text-[#D0D4F7]" />
      <span class="text-xs text-[#8E8B94]">Loading account status...</span>
    </div>

    <div
      v-else
      class="max-w-lg w-full bg-[#18181B] border border-[#2A2A2E] p-6 sm:p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 relative overflow-hidden"
    >
      <!-- Top Accent Glow -->
      <div
        class="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full blur-3xl pointer-events-none"
        :class="isPermanentlyBanned ? 'bg-rose-500/20' : 'bg-amber-500/20'"
      ></div>

      <!-- Icon Header -->
      <div
        class="flex justify-center items-center p-4 rounded-2xl border"
        :class="isPermanentlyBanned ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'"
      >
        <Icon :name="isPermanentlyBanned ? 'ic:baseline-lock-person' : 'ic:round-lock-clock'" class="text-4xl" />
      </div>

      <!-- Title & Strike Badge -->
      <div class="flex flex-col items-center text-center gap-1.5">
        <div class="flex items-center gap-2">
          <span
            class="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider border"
            :class="isPermanentlyBanned ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'"
          >
            Strike {{ strikeLevel }} of 3
          </span>
          <span v-if="isSuspended" class="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-indigo-500/15 text-[#D0D4F7] border border-indigo-500/30">
            Time-Limited
          </span>
        </div>

        <h1 class="text-2xl sm:text-3xl font-bold font-Sora text-white mt-1">
          {{ isPermanentlyBanned ? 'Account Permanently Banned' : 'Account Suspended' }}
        </h1>

        <p class="text-xs text-[#8E8B94] max-w-sm mt-0.5">
          Access to TONO features has been restricted in accordance with our community trust and safety guidelines.
        </p>
      </div>

      <!-- Countdown Bar for Suspensions -->
      <div
        v-if="isSuspended"
        class="w-full p-4 rounded-2xl bg-[#131315] border border-amber-500/25 flex flex-col items-center text-center gap-1"
      >
        <span class="text-[11px] uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
          <Icon name="ic:round-lock-clock" class="text-sm" />
          <span>{{ remainingTimeText }}</span>
        </span>
        <span class="text-xs text-gray-400">
          Suspension lifts on <strong class="text-gray-200">{{ formattedExpiration }}</strong>
        </span>
      </div>

      <!-- Official Reason Box -->
      <div class="w-full p-4 rounded-2xl bg-[#131315] border border-[#2A2A2E] text-left">
        <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
          Official Administrative Reason
        </span>
        <p class="text-xs text-gray-200 leading-relaxed italic wrap-break-word">
          "{{ officialReason }}"
        </p>
      </div>

      <!-- Appeals / Contest Section -->
      <div class="w-full flex flex-col gap-3">
        <!-- Already Submitted Appeal State -->
        <div
          v-if="appealSubmitted"
          class="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center flex flex-col items-center gap-1.5"
        >
          <div class="flex items-center gap-1.5 text-xs font-semibold text-[#D0D4F7]">
            <Icon name="ic:baseline-check-box" class="text-base text-emerald-400" />
            <span>Appeal Under Administrative Review</span>
          </div>
          <p class="text-[11px] text-gray-400 max-w-xs leading-relaxed">
            Your statement has been escalated to TONO moderators. If accepted, sanctions will be lifted immediately.
          </p>
        </div>

        <!-- Contest Form -->
        <form v-else @submit.prevent="handleSubmitAppeal" class="flex flex-col gap-2.5">
          <label class="text-xs font-medium text-gray-300 text-left">
            Submit a Formal Appeal / Contest:
          </label>
          <textarea
            v-model="contestText"
            placeholder="Explain respectfully why you believe this sanction should be reconsidered..."
            rows="3"
            maxlength="600"
            class="w-full bg-[#131315] border border-[#2A2A2E] focus:border-[#D0D4F7]/60 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-hidden transition-colors resize-none"
          ></textarea>

          <p v-if="appealError" class="text-xs text-rose-400 text-left">
            {{ appealError }}
          </p>

          <button
            type="submit"
            :disabled="!contestText.trim() || isSubmittingAppeal"
            class="w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
            :class="
              contestText.trim() && !isSubmittingAppeal
                ? 'bg-[#D0D4F7] hover:bg-white text-[#0E0E10] shadow-md'
                : 'bg-[#222226] text-gray-500 cursor-not-allowed'
            "
          >
            <Icon v-if="isSubmittingAppeal" name="ic:baseline-sync" class="animate-spin text-sm" />
            <span>{{ isSubmittingAppeal ? 'Submitting Appeal...' : 'Submit Appeal to Moderators' }}</span>
          </button>
        </form>
      </div>

      <!-- Action Buttons -->
      <div class="w-full pt-2 border-t border-[#2A2A2E] flex items-center justify-between gap-3">
        <button
          type="button"
          @click="handleLogout"
          class="flex-1 py-2.5 px-4 rounded-xl border border-[#46464D]/50 hover:bg-[#202025] text-xs font-medium text-gray-300 hover:text-white transition-colors cursor-pointer text-center"
        >
          Log Out
        </button>

        <NuxtLink
          to="/feedback"
          class="flex-1 py-2.5 px-4 rounded-xl border border-transparent bg-[#1E1E24] hover:bg-[#2A2A30] text-xs font-medium text-[#D0D4F7] transition-colors text-center"
        >
          Contact Support
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
