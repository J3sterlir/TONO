<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useModerationReport, CONTRACT_REPORT_CATEGORIES } from '~/composables/useModerationReport'

const { isReportModalOpen, reportConfig, closeReportModal } = useModerationReport()

const selectedCategory = ref('')
const description = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')
const successToast = ref('')

useModalScrollLock(() => isReportModalOpen.value)

const profileCategories = [
  'Harassment or Bullying',
  'Impersonation or Fake Account',
  'Spam or Fraud',
  'Inappropriate Profile Picture / Bio',
  'Hate Speech',
  'Other Policy Violation'
]

const messageCategories = [
  'Harassment or Abuse',
  'Spam or Unsolicited Promotion',
  'Contract Breach / Unprofessional Conduct',
  'Extortion or Blackmail',
  'Scam or Phishing',
  'Other'
]

const postCategories = [
  'Inappropriate / Explicit Media',
  'Harassment or Hate Speech',
  'Copyright Infringement',
  'Spam or Misleading Information',
  'Other'
]

const commentCategories = [
  'Harassment or Insult',
  'Hate Speech',
  'Spam',
  'Other'
]

const contractCategories = [
  ...CONTRACT_REPORT_CATEGORIES
]

const availableCategories = computed(() => {
  if (!reportConfig.value) return ['Other']
  switch (reportConfig.value.targetType) {
    case 'Message': return messageCategories
    case 'Post': return postCategories
    case 'Comment': return commentCategories
    case 'Contract': return contractCategories
    case 'Profile':
    default: return profileCategories
  }
})

watch(
  reportConfig,
  (cfg) => {
    if (cfg) {
      selectedCategory.value = cfg.defaultCategory || ''
      description.value = ''
      errorMessage.value = ''
      successToast.value = ''
    }
  },
  { immediate: true }
)

const handleSubmit = async () => {
  if (!reportConfig.value) return
  errorMessage.value = ''

  if (!selectedCategory.value) {
    errorMessage.value = 'Please select a reason category.'
    return
  }

  if (!description.value.trim()) {
    errorMessage.value = 'Please provide details describing the issue.'
    return
  }

  isSubmitting.value = true

  try {
    const response = await $fetch<{ success: boolean; message: string }>('/api/reports/create', {
      method: 'POST',
      body: {
        targetType: reportConfig.value.targetType,
        targetId: reportConfig.value.targetId,
        targetAccountId: reportConfig.value.targetAccountId || null,
        targetName: reportConfig.value.targetName || null,
        category: selectedCategory.value,
        description: description.value.trim(),
        previewSnippet: reportConfig.value.previewSnippet || null,
        previewText: reportConfig.value.previewText || null,
        previewMedia: reportConfig.value.previewMedia || null
      }
    })

    if (response?.success) {
      successToast.value = response.message || 'Report submitted successfully.'
      setTimeout(() => {
        closeReportModal()
        successToast.value = ''
      }, 1500)
    }
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.message || 'Failed to submit report. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}
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
        v-if="isReportModalOpen && reportConfig"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
          @click="closeReportModal"
        />

        <!-- Modal Dialog -->
        <div
          class="relative z-10 w-full max-w-lg bg-[#18181B] border border-[#2A2A2E] rounded-3xl shadow-2xl flex flex-col overflow-hidden font-Geist text-white"
          @click.stop
        >
          <!-- Top Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-[#2A2A2E] bg-[#141416]">
            <div class="flex items-center gap-2.5">
              <div class="flex p-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                <Icon name="ic:round-flag" class="text-lg" />
              </div>
              <div>
                <h3 class="text-sm font-semibold font-Sora text-white">
                  Report {{ reportConfig.targetType }}
                </h3>
              </div>
            </div>

            <button
              @click="closeReportModal"
              class="p-1 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Icon name="ic:round-close" class="text-xl" />
            </button>
          </div>

          <!-- Success Banner -->
          <div
            v-if="successToast"
            class="m-6 p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center flex flex-col items-center gap-2"
          >
            <Icon name="ic:baseline-check-box" class="text-3xl text-emerald-400" />
            <h4 class="text-sm font-semibold text-white">Report Received</h4>
            <p class="text-xs text-gray-300">{{ successToast }}</p>
          </div>

          <!-- Report Form Body -->
          <form v-else @submit.prevent="handleSubmit" class="p-6 flex flex-col gap-4">
            <!-- Contextual Target Preview Snippet -->
            <div class="p-3.5 rounded-2xl bg-[#131315] border border-[#2A2A2E] flex flex-col gap-1 text-left">
              <span class="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                <span>Target {{ reportConfig.targetType }}</span>
                <span v-if="reportConfig.targetName" class="text-[#D0D4F7]">by {{ reportConfig.targetName }}</span>
              </span>

              <!-- If Profile: Dedicated Public Profile Preview -->
              <div v-if="reportConfig.targetType === 'Profile'" class="pt-0.5 space-y-1">
                <div class="flex items-center gap-2 text-xs text-[#D0D4F7] font-mono bg-[#18181D] px-2.5 py-1.5 rounded-lg border border-[#2E2E36]">
                  <Icon name="ic:round-public" class="text-sm shrink-0 text-[#D0D4F7]" />
                  <span class="truncate">Public Profile: {{ reportConfig.previewSnippet || reportConfig.previewText || (reportConfig.targetName ? `@${reportConfig.targetName}` : 'Live Profile') }}</span>
                </div>
              </div>

              <!-- Other types (Contract, Message, Post, Comment) -->
              <div v-else-if="reportConfig.previewText || reportConfig.previewSnippet" class="space-y-0.5">
                <p v-if="reportConfig.previewText" class="text-xs font-semibold text-white">
                  {{ reportConfig.previewText }}
                </p>
                <p
                  v-if="reportConfig.previewSnippet && reportConfig.previewSnippet !== reportConfig.previewText"
                  class="text-xs text-gray-300 line-clamp-3 leading-relaxed italic wrap-break-word"
                >
                  "{{ reportConfig.previewSnippet }}"
                </p>
              </div>
              <div v-if="reportConfig.previewMedia" class="mt-1 w-20 h-20 rounded-xl overflow-hidden border border-white/10">
                <img :src="reportConfig.previewMedia" alt="Reported Media" class="w-full h-full object-cover" />
              </div>
            </div>

            <!-- Category Dropdown -->
            <div class="flex flex-col gap-1.5 text-left">
              <label class="text-xs font-semibold text-gray-300">
                Why are you reporting this {{ reportConfig.targetType.toLowerCase() }}?
              </label>
              <select
                v-model="selectedCategory"
                class="w-full bg-[#131315] border border-[#2E2E34] focus:border-[#D0D4F7]/60 rounded-xl p-3 text-xs text-white focus:outline-hidden transition-colors"
              >
                <option value="" disabled>Select reason...</option>
                <option v-for="cat in availableCategories" :key="cat" :value="cat">
                  {{ cat }}
                </option>
              </select>
            </div>

            <!-- Detailed Explanation Textarea -->
            <div class="flex flex-col gap-1.5 text-left">
              <label class="text-xs font-semibold text-gray-300">
                Provide additional context:
              </label>
              <textarea
                v-model="description"
                rows="4"
                maxlength="500"
                placeholder="Explain what violates platform rules or caused this report..."
                class="w-full bg-[#131315] border border-[#2E2E34] focus:border-[#D0D4F7]/60 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-hidden transition-colors resize-none"
              ></textarea>
            </div>

            <!-- Evidence Integrity Note -->
            <div class="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-gray-300 flex items-start gap-2 text-left">
              <Icon name="ic:round-lock-clock" class="text-base text-[#D0D4F7] shrink-0 mt-0.5" />
              <span>
                TONO automatically preserves an immutable snapshot of this content. Editing or deleting it afterwards will not remove the evidence.
              </span>
            </div>

            <!-- Error message if any -->
            <p v-if="errorMessage" class="text-xs text-rose-400 text-left">
              {{ errorMessage }}
            </p>

            <!-- Actions Footer -->
            <div class="pt-2 border-t border-[#2A2A2E] flex items-center justify-end gap-3">
              <button
                type="button"
                @click="closeReportModal"
                class="px-4 py-2.5 rounded-xl border border-[#3A3A40] hover:bg-[#202025] text-xs font-semibold text-gray-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                :disabled="isSubmitting"
                class="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-60"
              >
                <Icon v-if="isSubmitting" name="ic:baseline-sync" class="animate-spin text-sm" />
                <Icon v-else name="ic:round-flag" class="text-sm" />
                <span>{{ isSubmitting ? 'Submitting Report...' : 'Submit Report' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
