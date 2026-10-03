/**
 * Normalizes band instrument/role strings to clean Title Case.
 * Handles single roles, multi-word roles, and slash-separated roles.
 * e.g.
 *   "DrumMer" -> "Drummer"
 *   "lead guitarist" -> "Lead Guitarist"
 *   "bassist/backing vocals" -> "Bassist / Backing Vocals"
 *   "KEYBOARDIST" -> "Keyboardist"
 */
export function normalizeRole(role?: string | null): string {
  if (!role || typeof role !== 'string') return ''
  const trimmed = role.trim()
  if (!trimmed) return ''

  // If role contains slashes, normalize each side
  if (trimmed.includes('/')) {
    return trimmed
      .split('/')
      .map(part => normalizeRole(part))
      .filter(Boolean)
      .join(' / ')
  }

  // Split words by whitespace
  return trimmed
    .split(/\s+/)
    .map(word => {
      if (!word) return ''
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

/**
 * Predefined popular band roles for quick selection chips
 */
export const POPULAR_BAND_ROLES = [
  'Vocalist',
  'Lead Guitarist',
  'Rhythm Guitarist',
  'Bassist',
  'Drummer',
  'Keyboardist',
  'Percussionist',
  'Saxophonist',
  'Backing Vocals',
  'Producer / DJ'
]
