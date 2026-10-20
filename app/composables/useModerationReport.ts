import { ref } from 'vue'

export type ModerationTargetType = 'Profile' | 'Message' | 'Post' | 'Comment' | 'Contract'

export const CONTRACT_REPORT_CATEGORIES = [
  'Frequent Cancellation / Last-Minute Modification',
  'Late Cancellation (Within 5 Days)',
  'Unilateral Schedule Modification',
  'No-Show / Breach of Contract',
  'Payment Dispute',
  'Other Contract Violation'
] as const

export interface ModerationReportConfig {
  targetType: ModerationTargetType
  targetId: string
  targetAccountId?: string | null
  targetName?: string | null
  previewText?: string | null
  previewSnippet?: string | null
  previewMedia?: string | null
  defaultCategory?: string | null
}

const isReportModalOpen = ref(false)
const reportConfig = ref<ModerationReportConfig | null>(null)

export const useModerationReport = () => {
  const openReportModal = (config: ModerationReportConfig) => {
    reportConfig.value = config
    isReportModalOpen.value = true
  }

  const closeReportModal = () => {
    isReportModalOpen.value = false
    reportConfig.value = null
  }

  return {
    isReportModalOpen,
    reportConfig,
    openReportModal,
    closeReportModal
  }
}
