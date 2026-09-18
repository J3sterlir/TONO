/**
 * Computes initials for a milestone or achievement title to use as a fallback badge.
 * e.g., "Battle of the Bands 2025" -> "BB"
 * e.g., "Grammy Award" -> "GA"
 * e.g., "Champion" -> "CH"
 */
export const getMilestoneInitials = (title?: string | null): string => {
  if (!title || !title.trim()) return '🏆'

  const stopWords = new Set(['of', 'the', 'and', 'in', 'on', 'at', 'for', 'to', 'a', 'an', 'by', '&'])
  const cleanTitle = title.trim().replace(/[^\w\s-]/g, '')
  const words = cleanTitle.split(/\s+/).filter(Boolean)

  if (words.length === 0) return '🏆'

  // Filter out common noise/stop words if there are multiple words
  const significantWords = words.filter((w) => !stopWords.has(w.toLowerCase()))
  const targetWords = significantWords.length >= 2 ? significantWords : words

  const first = targetWords[0]
  if (!first) return '🏆'

  if (targetWords.length === 1) {
    return first.slice(0, 2).toUpperCase()
  }

  const second = targetWords[1]
  if (!second) {
    return first.slice(0, 2).toUpperCase()
  }

  const c1 = first.charAt(0)
  const c2 = second.charAt(0)
  return (c1 + c2).toUpperCase() || '🏆'
}
