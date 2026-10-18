import { formatTimeRange12 } from '~/utils/formatTime'

export const useTonoEvents = () => {
  const supabase = useSupabaseClient()
  const db = supabase as any

  /**
   * Checks if an event is currently ongoing today.
   * Supports either an object { Start_Date, End_Date, Start_Time, End_Time } or individual args.
   */
  const isEventHappeningNow = (
    eventOrStartDate?: any,
    endDate?: string | null,
    startTime?: string | null,
    endTime?: string | null
  ): boolean => {
    let sDate = eventOrStartDate
    let eDate = endDate
    let sTime = startTime
    let eTime = endTime

    if (eventOrStartDate && typeof eventOrStartDate === 'object') {
      sDate = eventOrStartDate.Start_Date || eventOrStartDate.Event_Date
      eDate = eventOrStartDate.End_Date || sDate
      sTime = eventOrStartDate.Start_Time
      eTime = eventOrStartDate.End_Time
    }

    if (!sDate) return false
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const finalEnd = eDate || sDate

    // Check if today falls in the date window [startDate, finalEnd]
    if (todayStr < sDate || todayStr > finalEnd) {
      return false
    }

    // If today is the final end date and an end time is provided, verify it hasn't ended yet
    if (todayStr === finalEnd && eTime) {
      const parts = eTime.split(':')
      const endH = parts[0] !== undefined ? Number(parts[0]) : NaN
      const endM = parts[1] !== undefined ? Number(parts[1]) : NaN
      if (!Number.isNaN(endH) && !Number.isNaN(endM)) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes()
        const endMinutes = endH * 60 + endM
        // If current time is after end time, it's finished rather than happening now
        if (currentMinutes > endMinutes) {
          return false
        }
      }
    }

    return true
  }

  /**
   * Checks if an event has already ended / finished.
   * Supports either an object { Start_Date, End_Date, End_Time } or individual args.
   */
  const isEventFinished = (
    eventOrStartDate?: any,
    endDate?: string | null,
    endTime?: string | null
  ): boolean => {
    let sDate = eventOrStartDate
    let eDate = endDate
    let eTime = endTime

    if (eventOrStartDate && typeof eventOrStartDate === 'object') {
      sDate = eventOrStartDate.Start_Date || eventOrStartDate.Event_Date
      eDate = eventOrStartDate.End_Date || sDate
      eTime = eventOrStartDate.End_Time
    }

    if (!sDate) return false
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const finalEnd = eDate || sDate

    // If the calendar end date has passed (yesterday or earlier)
    if (todayStr > finalEnd) {
      return true
    }

    // If today is the end date and endTime has passed
    if (todayStr === finalEnd && eTime) {
      const parts = eTime.split(':')
      const endH = parts[0] !== undefined ? Number(parts[0]) : NaN
      const endM = parts[1] !== undefined ? Number(parts[1]) : NaN
      if (!Number.isNaN(endH) && !Number.isNaN(endM)) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes()
        const endMinutes = endH * 60 + endM
        return currentMinutes >= endMinutes
      }
    }

    return false
  }

  /**
   * Calls the database RPC to mark a job listing and its tied contract as Completed.
   * Falls back to direct updates if RPC is not present.
   */
  const markJobListingCompleted = async (jobId: string) => {
    if (!jobId) throw new Error('Job ID is required')
    try {
      const { data, error } = await db.rpc('mark_job_completed', { p_job_id: jobId })
      if (!error && data?.success !== false) {
        return data || { success: true }
      }
    } catch (rpcErr) {
      console.warn('RPC mark_job_completed execution issue, attempting fallback update:', rpcErr)
    }

    // Fallback: direct update
    const { error: updateErr } = await db
      .from('JOB_LISTING')
      .update({ Status: 'Completed' })
      .eq('Job_ID', jobId)

    if (updateErr) throw updateErr

    await db
      .from('BOOKING_CONTRACT')
      .update({ Status: 'Completed' })
      .eq('Job_ID', jobId)
      .in('Status', ['Confirmed', 'Active'])

    return { success: true }
  }

  return {
    isEventHappeningNow,
    isEventFinished,
    markJobListingCompleted
  }
}
