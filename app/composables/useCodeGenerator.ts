export const useCodeGenerator = () => {
  const supabase = useSupabaseClient()
  const db = supabase as any

  const getTodayParts = () => {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const year = String(now.getFullYear())
    return { month, day, year }
  }

  const formatSequence = (seq: number): string => {
    // Zero-pad to 2 digits for 1-99, expand naturally for 100+
    return seq < 100 ? String(seq).padStart(2, '0') : String(seq)
  }

  const parseSequenceFromCode = (code: string, prefix: string, mmdd: string, year: string): number | null => {
    // Regex matches e.g. JB-093001-2026 or JB-0930100-2026
    const regex = new RegExp(`^${prefix}-${mmdd}(\\d+)-${year}$`, 'i')
    const match = code.trim().match(regex)
    if (!match || !match[1]) return null
    const parsed = parseInt(match[1], 10)
    return isNaN(parsed) ? null : parsed
  }

  /**
   * Generates the next sequential Job Code for today (e.g. JB-093001-2026, JB-093002-2026)
   */
  const getNextJobCode = async (): Promise<string> => {
    const { month, day, year } = getTodayParts()
    const mmdd = `${month}${day}`
    const prefix = 'JB'

    try {
      // 1. Try server RPC if deployed
      const { data: rpcCode, error: rpcErr } = await db.rpc('get_next_daily_code', { p_prefix: prefix })
      if (!rpcErr && rpcCode && typeof rpcCode === 'string') {
        return rpcCode
      }

      // 2. Fallback to direct table query & sequence parsing
      const { data, error } = await db
        .from('JOB_LISTING')
        .select('Job_Code')
        .ilike('Job_Code', `${prefix}-${mmdd}%-${year}`)

      if (error || !data || data.length === 0) {
        return `${prefix}-${mmdd}01-${year}`
      }

      let maxSeq = 0
      for (const row of data) {
        if (row.Job_Code) {
          const seq = parseSequenceFromCode(row.Job_Code, prefix, mmdd, year)
          if (seq !== null && seq > maxSeq) {
            maxSeq = seq
          }
        }
      }

      return `${prefix}-${mmdd}${formatSequence(maxSeq + 1)}-${year}`
    } catch (e) {
      console.warn('Failed to calculate next daily job code, falling back to 01:', e)
      return `${prefix}-${mmdd}01-${year}`
    }
  }

  /**
   * Generates the next sequential Booking Contract Code for today (e.g. BK-093001-2026, BK-093002-2026)
   */
  const getNextContractCode = async (): Promise<string> => {
    const { month, day, year } = getTodayParts()
    const mmdd = `${month}${day}`
    const prefix = 'BK'

    try {
      // 1. Try server RPC if deployed
      const { data: rpcCode, error: rpcErr } = await db.rpc('get_next_daily_code', { p_prefix: prefix })
      if (!rpcErr && rpcCode && typeof rpcCode === 'string') {
        return rpcCode
      }

      // 2. Fallback to direct table query & sequence parsing
      const { data, error } = await db
        .from('BOOKING_CONTRACT')
        .select('Contract_Code')
        .ilike('Contract_Code', `${prefix}-${mmdd}%-${year}`)

      if (error || !data || data.length === 0) {
        return `${prefix}-${mmdd}01-${year}`
      }

      let maxSeq = 0
      for (const row of data) {
        if (row.Contract_Code) {
          const seq = parseSequenceFromCode(row.Contract_Code, prefix, mmdd, year)
          if (seq !== null && seq > maxSeq) {
            maxSeq = seq
          }
        }
      }

      return `${prefix}-${mmdd}${formatSequence(maxSeq + 1)}-${year}`
    } catch (e) {
      console.warn('Failed to calculate next daily contract code, falling back to 01:', e)
      return `${prefix}-${mmdd}01-${year}`
    }
  }

  return {
    getNextJobCode,
    getNextContractCode,
    formatSequence
  }
}
