/**
 * Time formatting utilities to standardize 12-hour clock representations across TONO forms and views.
 */

/**
 * Converts a 24-hour time string ("19:00", "09:30:00") or any valid time into standard 12-hour clock format ("7:00 PM", "9:30 AM").
 */
export const formatTime12 = (timeStr?: string | null): string => {
  if (!timeStr || !timeStr.trim()) return ''
  const trimmed = timeStr.trim()

  // If already in 12-hour format with AM/PM (e.g. "7:00 PM", "07:30 am")
  if (/(am|pm)$/i.test(trimmed)) {
    return trimmed.toUpperCase()
  }

  
  // Parse HH:mm or HH:mm:ss
  const parts = trimmed.split(':')
  const hourPart = parts[0]
  const minutePart = parts[1]

  if (hourPart !== undefined && minutePart !== undefined) {
    const hours = parseInt(hourPart, 10)
    const minutes = parseInt(minutePart, 10)

    if (!isNaN(hours) && !isNaN(minutes)) {
      const period = hours >= 12 ? 'PM' : 'AM'
      const h12 = hours % 12 === 0 ? 12 : hours % 12
      const mStr = String(minutes).padStart(2, '0')
      return `${h12}:${mStr} ${period}`
    }
  }


  return trimmed
}

/**
 * Formats a start and end time pair into a standard 12-hour range string (e.g. "7:00 PM - 10:00 PM").
 */
export const formatTimeRange12 = (startTime?: string | null, endTime?: string | null): string => {
  const start = formatTime12(startTime)
  const end = formatTime12(endTime)
  if (start && end) return `${start} - ${end}`
  if (start) return start
  if (end) return end
  return ''
}
