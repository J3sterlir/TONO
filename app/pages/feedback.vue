<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()

const activeTab = ref<'bug' | 'feedback'>('bug')
const currentUser = ref<any>(null)

// Form fields
const category = ref('')
const severity = ref('Annoying but Usable')
const title = ref('')
const description = ref('')
const stepsToReproduce = ref('')
const guestEmail = ref('')

// State
const isSubmitting = ref(false)
const isSubmitted = ref(false)
const submittedTicketId = ref('')
const errorMessage = ref('')

// Environment Diagnostics
const diagnostics = ref({
  browser: '',
  os: '',
  screenResolution: '',
  url: '',
  language: ''
})

onMounted(async () => {
  if (route.query.tab === 'feedback') {
    activeTab.value = 'feedback'
  } else {
    activeTab.value = 'bug'
  }

  const { data } = await supabase.auth.getUser()
  currentUser.value = data?.user || null

  if (import.meta.client) {
    const userAgent = navigator.userAgent
    diagnostics.value = {
      browser: detectBrowser(userAgent),
      os: detectOS(userAgent),
      screenResolution: `${window.innerWidth}x${window.innerHeight}`,
      url: window.location.href,
      language: navigator.language || 'en'
    }
  }
})

const detectBrowser = (ua: string): string => {
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Edg')) return 'Microsoft Edge'
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Safari')) return 'Safari'
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera'
  return 'Unknown Browser'
}

const detectOS = (ua: string): string => {
  if (ua.includes('Win')) return 'Windows'
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS'
  return 'Unknown OS'
}

const bugCategories = [
  'Audio Player / Streaming',
  'Messages & Chat',
  'Booking Contracts & Calendar',
  'Feed & Community Posts',
  'Artist / Business Profiles',
  'Media / Image Uploads',
  'Account, Login & Auth',
  'Navigation / UI Glitch',
  'Other Bug'
]

const feedbackCategories = [
  'Live Music Discovery',
  'Artist Booking & Contracts',
  'Community & Social Features',
  'Audio Player Experience',
  'Design & User Interface',
  'Mobile Responsiveness',
  'New Feature Idea',
  'Other Suggestion'
]

const categoriesList = computed(() => {
  return activeTab.value === 'bug' ? bugCategories : feedbackCategories
})

const severityLevels = [
  { label: 'Minor Glitch', desc: 'Cosmetic or minor display imperfection' },
  { label: 'Annoying but Usable', desc: 'Feature works but with inconvenience' },
  { label: 'Blocks Workflow', desc: 'Cannot complete a specific booking or action' },
  { label: 'Critical Crash', desc: 'Page crashes or platform is unusable' }
]

const handleSubmit = async () => {
  errorMessage.value = ''
  if (!category.value) {
    errorMessage.value = 'Please select a category.'
    return
  }
  if (!title.value.trim()) {
    errorMessage.value = 'Please enter a summary title.'
    return
  }
  if (!description.value.trim()) {
    errorMessage.value = 'Please provide details.'
    return
  }

  isSubmitting.value = true

  try {
    const combinedDescription = activeTab.value === 'bug' && stepsToReproduce.value.trim()
      ? `${title.value.trim()}\n\n${description.value.trim()}\n\n-- Steps to Reproduce --\n${stepsToReproduce.value.trim()}`
      : `${title.value.trim()}\n\n${description.value.trim()}`

    const response = await $fetch<{ success: boolean; reportId?: string; message?: string }>('/api/reports/create', {
      method: 'POST',
      body: {
        targetType: activeTab.value === 'bug' ? 'Bug' : 'Feedback',
        category: category.value,
        description: combinedDescription,
        reporterEmail: !currentUser.value ? guestEmail.value.trim() : undefined,
        diagnostics: {
          ...diagnostics.value,
          severity: activeTab.value === 'bug' ? severity.value : undefined,
          targetTab: activeTab.value
        }
      }
    })

    if (response?.success) {
      isSubmitted.value = true
      submittedTicketId.value = response.reportId || ''
    }
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.message || 'Failed to submit. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

const resetForm = () => {
  isSubmitted.value = false
  title.value = ''
  description.value = ''
  stepsToReproduce.value = ''
  category.value = ''
  errorMessage.value = ''
}
</script>

<template>
  <div class="min-h-screen bg-[#0E0E10] text-white flex flex-col font-Geist">
    <!-- Navigation Header -->
    <header class="w-full bg-[#131315]/90 backdrop-blur-md border-b border-[#2A2A2E] px-6 sm:px-10 py-4 flex items-center justify-between sticky top-0 z-30">
      <div class="flex items-center gap-3">
        <button
          @click="router.back()"
          class="flex p-2 rounded-xl bg-[#1C1C1F] hover:bg-[#26262B] border border-[#2E2E34] text-gray-300 hover:text-white transition-colors cursor-pointer"
          title="Go Back"
        >
          <Icon name="ic:baseline-arrow-back" class="text-lg" />
        </button>
        <div>
          <h1 class="font-Sora font-bold text-base sm:text-lg text-white">Feedback & Bug Reporting</h1>
          <p class="text-[11px] text-[#8E8B94]">Help us improve TONO for artists, businesses, and music fans</p>
        </div>
      </div>

      <NuxtLink
        to="/"
        class="text-xs font-semibold px-4 py-2 rounded-xl bg-[#1E1E24] hover:bg-[#282830] border border-[#2E2E34] text-gray-200 transition-colors"
      >
        Home
      </NuxtLink>
    </header>

    <main class="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <!-- Success State -->
      <div
        v-if="isSubmitted"
        class="p-8 sm:p-12 rounded-3xl bg-[#131315] border border-emerald-500/30 text-center flex flex-col items-center gap-4 shadow-2xl"
      >
        <div class="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-3xl">
          <Icon name="ic:baseline-check-box" />
        </div>
        <h2 class="text-2xl font-bold font-Sora text-white">Thank You for Your Submission!</h2>
        <p class="text-xs sm:text-sm text-gray-300 max-w-md leading-relaxed">
          {{ activeTab === 'bug'
            ? 'Your bug report has been logged with client diagnostics. Our engineering team is reviewing it.'
            : 'Your suggestions have been sent to our product team. Thank you for helping shape the future of TONO!'
          }}
        </p>

        <div v-if="submittedTicketId" class="px-3 py-1.5 rounded-xl bg-[#1C1C1F] border border-[#2E2E34] text-[11px] font-mono text-gray-400">
          Ticket Reference: <span class="text-[#D0D4F7]">{{ submittedTicketId.slice(0, 8) }}</span>
        </div>

        <div class="flex items-center gap-3 mt-4">
          <button
            @click="resetForm"
            class="px-5 py-2.5 rounded-xl bg-[#1E1E24] hover:bg-[#26262C] border border-[#2E2E34] text-xs font-semibold text-gray-200 cursor-pointer transition-colors"
          >
            Submit Another Ticket
          </button>
          <NuxtLink
            to="/userhome"
            class="px-5 py-2.5 rounded-xl bg-[#D0D4F7] hover:bg-white text-[#0E0E10] text-xs font-semibold cursor-pointer transition-colors shadow-md"
          >
            Return to Discover
          </NuxtLink>
        </div>
      </div>

      <!-- Main Form Container -->
      <div v-else class="bg-[#131315] border border-[#2A2A2E] rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col gap-6">
        <!-- Mode Switcher -->
        <div class="grid grid-cols-2 gap-2 p-1 bg-[#1C1C1F] rounded-2xl border border-[#2E2E34]">
          <button
            type="button"
            @click="activeTab = 'bug'; category = ''"
            class="py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
            :class="
              activeTab === 'bug'
                ? 'bg-[#D0D4F7] text-[#0E0E10] shadow-sm'
                : 'text-gray-400 hover:text-white'
            "
          >
            <Icon name="ic:baseline-bug-report" class="text-lg" />
            <span>Report a Bug</span>
          </button>

          <button
            type="button"
            @click="activeTab = 'feedback'; category = ''"
            class="py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
            :class="
              activeTab === 'feedback'
                ? 'bg-[#D0D4F7] text-[#0E0E10] shadow-sm'
                : 'text-gray-400 hover:text-white'
            "
          >
            <Icon name="ic:baseline-lightbulb" class="text-lg" />
            <span>General Feedback</span>
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="flex flex-col gap-5">
          <!-- Category Selector -->
          <div class="flex flex-col gap-1.5 text-left">
            <label class="text-xs font-semibold text-gray-300">
              {{ activeTab === 'bug' ? 'What area is affected?' : 'What area is your feedback about?' }}
            </label>
            <select
              v-model="category"
              class="w-full bg-[#18181B] border border-[#2E2E34] focus:border-[#D0D4F7]/60 rounded-xl p-3 text-xs text-white focus:outline-hidden transition-colors"
            >
              <option value="" disabled>Select a category...</option>
              <option v-for="cat in categoriesList" :key="cat" :value="cat">
                {{ cat }}
              </option>
            </select>
          </div>

          <!-- Severity Level (Bug reports only) -->
          <div v-if="activeTab === 'bug'" class="flex flex-col gap-2 text-left">
            <label class="text-xs font-semibold text-gray-300">Severity Level</label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                v-for="sev in severityLevels"
                :key="sev.label"
                type="button"
                @click="severity = sev.label"
                class="p-3 rounded-xl border text-left flex flex-col gap-0.5 transition-all cursor-pointer"
                :class="
                  severity === sev.label
                    ? 'bg-[#D0D4F7]/10 border-[#D0D4F7] text-white shadow-xs'
                    : 'bg-[#18181B] border-[#2E2E34] text-gray-400 hover:text-white hover:bg-[#202025]'
                "
              >
                <span class="text-xs font-semibold" :class="severity === sev.label ? 'text-[#D0D4F7]' : 'text-gray-300'">
                  {{ sev.label }}
                </span>
                <span class="text-[10.5px] text-gray-500">{{ sev.desc }}</span>
              </button>
            </div>
          </div>

          <!-- Issue Summary Title -->
          <div class="flex flex-col gap-1.5 text-left">
            <label class="text-xs font-semibold text-gray-300">
              {{ activeTab === 'bug' ? 'Bug Summary / Title' : 'Feedback Topic / Idea' }}
            </label>
            <input
              v-model="title"
              type="text"
              maxlength="120"
              :placeholder="activeTab === 'bug' ? 'e.g. Song audio pauses unexpectedly when navigating tabs' : 'e.g. Add quick preview for artist playlist on gig search'"
              class="w-full bg-[#18181B] border border-[#2E2E34] focus:border-[#D0D4F7]/60 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-hidden transition-colors"
            />
          </div>

          <!-- Description -->
          <div class="flex flex-col gap-1.5 text-left">
            <label class="text-xs font-semibold text-gray-300">
              {{ activeTab === 'bug' ? 'Detailed Explanation' : 'Your Thoughts & Suggestions' }}
            </label>
            <textarea
              v-model="description"
              rows="4"
              maxlength="1000"
              :placeholder="activeTab === 'bug' ? 'Describe what happened, what you expected to happen, and any relevant error messages...' : 'Tell us what would make TONO better for your workflow or experience...'"
              class="w-full bg-[#18181B] border border-[#2E2E34] focus:border-[#D0D4F7]/60 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-hidden transition-colors resize-none"
            ></textarea>
          </div>

          <!-- Steps to reproduce (Bugs only) -->
          <div v-if="activeTab === 'bug'" class="flex flex-col gap-1.5 text-left">
            <label class="text-xs font-semibold text-gray-300">
              Steps to Reproduce <span class="text-[11px] font-normal text-gray-500">(Optional but helpful)</span>
            </label>
            <textarea
              v-model="stepsToReproduce"
              rows="3"
              maxlength="600"
              placeholder="1. Go to Artist profile&#10;2. Click play on song&#10;3. Switch to Community tab"
              class="w-full bg-[#18181B] border border-[#2E2E34] focus:border-[#D0D4F7]/60 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-hidden transition-colors resize-none font-mono"
            ></textarea>
          </div>

          <!-- Guest Email Input if not logged in -->
          <div v-if="!currentUser" class="flex flex-col gap-1.5 text-left">
            <label class="text-xs font-semibold text-gray-300">
              Your Email Address <span class="text-[11px] font-normal text-gray-500">(Optional for follow-up)</span>
            </label>
            <input
              v-model="guestEmail"
              type="email"
              placeholder="you@example.com"
              class="w-full bg-[#18181B] border border-[#2E2E34] focus:border-[#D0D4F7]/60 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-hidden transition-colors"
            />
          </div>

          <!-- Diagnostics Info Pill -->
          <div class="p-3 rounded-2xl bg-[#161618] border border-[#2E2E34] flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400">
            <div class="flex items-center gap-1.5">
              <Icon name="ic:baseline-devices" class="text-sm text-[#D0D4F7]" />
              <span>Environment diagnostics will be attached:</span>
            </div>
            <div class="font-mono text-gray-300">
              {{ diagnostics.browser }} • {{ diagnostics.os }} ({{ diagnostics.screenResolution }})
            </div>
          </div>

          <!-- Error Feedback -->
          <div v-if="errorMessage" class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs text-left">
            {{ errorMessage }}
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isSubmitting"
            class="w-full py-3 px-6 rounded-2xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            :class="
              isSubmitting
                ? 'bg-[#26262B] text-gray-500 cursor-not-allowed'
                : 'bg-[#D0D4F7] hover:bg-white text-[#0E0E10]'
            "
          >
            <Icon v-if="isSubmitting" name="ic:baseline-sync" class="animate-spin text-base" />
            <Icon v-else :name="activeTab === 'bug' ? 'ic:baseline-bug-report' : 'ic:baseline-lightbulb'" class="text-base" />
            <span>{{ isSubmitting ? 'Submitting Ticket...' : (activeTab === 'bug' ? 'Submit Bug Report' : 'Send Feedback') }}</span>
          </button>
        </form>
      </div>
    </main>
  </div>
</template>
