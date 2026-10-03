/**
 * Post Helper Utilities for TONO
 * Handles relative time formatting, composite middle-dot post timestamps,
 * and compact number counting.
 */

/**
 * Returns a concise relative duration string (e.g., 24s ago, 5m ago, 2h ago, 3d ago, 2mo ago, 1y ago)
 */
export const formatPostRelativeTime = (timestamp: string | Date | null | undefined): string => {
  if (!timestamp) return 'just now'

  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  if (isNaN(date.getTime())) return 'just now'

  const now = new Date()
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000))

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours}h ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 30) {
    return `${diffInDays}d ago`
  }

  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`
  }

  const diffInYears = Math.floor(diffInDays / 365)
  return `${diffInYears}y ago`
}

/**
 * Formats a post creation timestamp into Date · Time · RelativeTime
 * Example: "Oct 3, 2026 · 1:45 PM · 5m ago"
 */
export const formatPostTimestamp = (timestamp: string | Date | null | undefined): string => {
  if (!timestamp) return ''

  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  if (isNaN(date.getTime())) return ''

  // Format Date: e.g. "Oct 3, 2026"
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)

  // Format Time: e.g. "1:45 PM"
  const formattedTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)

  // Relative duration
  const relative = formatPostRelativeTime(date)

  return `${formattedDate} · ${formattedTime} · ${relative}`
}

/**
 * Formats numeric counters into compact notation (e.g. 1.2k, 25k, 1M)
 */
export const formatCount = (count: number | null | undefined): string => {
  if (count === null || count === undefined || isNaN(count)) return '0'
  if (count < 1000) return count.toString()

  if (count < 1000000) {
    const formatted = (count / 1000).toFixed(1)
    return `${formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted}k`
  }

  const formatted = (count / 1000000).toFixed(1)
  return `${formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted}M`
}
