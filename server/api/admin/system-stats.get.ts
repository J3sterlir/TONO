import { createClient } from '@supabase/supabase-js'
import { getTelemetryState } from '../../middleware/telemetry'

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export default defineEventHandler(async (event) => {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NUXT_SUPABASE_SECRET_KEY

  if (!supabaseUrl || !serviceKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase configuration is missing.'
    })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // 1. DATABASE HEALTH & LATENCY CHECK
  const dbStart = performance.now()
  let dbStatus: 'Operational' | 'Degraded' | 'Down' = 'Operational'
  let dbError: string | null = null

  try {
    const { error } = await supabaseAdmin
      .from('ADMIN_ACCOUNT')
      .select('ADMIN_ID')
      .limit(1)

    if (error) {
      dbStatus = 'Degraded'
      dbError = error.message
    }
  } catch (err: any) {
    dbStatus = 'Down'
    dbError = err.message
  }

  const dbLatencyMs = Math.round(performance.now() - dbStart)

  // 2. STORAGE BUCKET USAGE (via get_storage_bucket_stats RPC + storage.listBuckets)
  const defaultBuckets = ['avatars', 'covers', 'posts', 'portfolio', 'songs']
  const bucketMap: Record<string, { fileCount: number; bytes: number }> = {}

  for (const b of defaultBuckets) {
    bucketMap[b] = { fileCount: 0, bytes: 0 }
  }

  try {
    const { data: rpcStats, error: rpcErr } = await supabaseAdmin.rpc('get_storage_bucket_stats')
    if (!rpcErr && Array.isArray(rpcStats)) {
      for (const row of rpcStats) {
        const id = String(row.bucket_id).toLowerCase()
        bucketMap[id] = {
          fileCount: Number(row.file_count || 0),
          bytes: Number(row.total_bytes || 0)
        }
      }
    } else {
      // Fallback: list buckets and query metadata if RPC isn't permitted
      const { data: buckets } = await supabaseAdmin.storage.listBuckets()
      if (buckets) {
        for (const b of buckets) {
          const id = b.name.toLowerCase()
          if (!bucketMap[id]) {
            bucketMap[id] = { fileCount: 0, bytes: 0 }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Storage stats aggregation warning:', e)
  }

  let totalUsedBytes = 0
  const bucketList = Object.entries(bucketMap).map(([name, data]) => {
    totalUsedBytes += data.bytes
    return {
      name,
      fileCount: data.fileCount,
      bytes: data.bytes,
      formattedSize: formatBytes(data.bytes)
    }
  })

  // Supabase standard quota: 1.00 GB (1,073,741,824 bytes)
  const quotaBytes = Number(process.env.STORAGE_QUOTA_BYTES) || 1024 * 1024 * 1024
  const freeBytes = Math.max(0, quotaBytes - totalUsedBytes)
  const usedPercent = Math.min(100, Number(((totalUsedBytes / quotaBytes) * 100).toFixed(1)))

  // 3. PLATFORM WORKFLOW REQUESTS (Tags, Bookings, Verifications)
  let tagRequests = { total: 0, accepted: 0, rejected: 0, pending: 0, acceptanceRate: 100 }
  let bookingRequests = { total: 0, activeConfirmed: 0, completed: 0, cancelled: 0, fulfillmentRate: 100 }
  let verificationQueue = { total: 0, verified: 0, unverified: 0, verificationRate: 100 }

  try {
    // A. Tag Requests
    const { data: tagsData } = await supabaseAdmin
      .from('TAG_REQUEST')
      .select('Status')

    if (tagsData) {
      tagRequests.total = tagsData.length
      tagRequests.pending = tagsData.filter((t) => t.Status === 'Pending').length
      tagRequests.accepted = tagsData.filter((t) => t.Status === 'Accepted').length
      tagRequests.rejected = tagsData.filter((t) => t.Status === 'Rejected').length
      const resolvedTags = tagRequests.accepted + tagRequests.rejected
      tagRequests.acceptanceRate = resolvedTags > 0
        ? Number(((tagRequests.accepted / resolvedTags) * 100).toFixed(1))
        : 100.0
    }

    // B. Booking Requests
    const { data: bookingData } = await supabaseAdmin
      .from('BOOKING')
      .select('Status')

    if (bookingData) {
      bookingRequests.total = bookingData.length
      bookingRequests.completed = bookingData.filter((b) => b.Status === 'Completed').length
      bookingRequests.activeConfirmed = bookingData.filter((b) => ['Confirmed', 'Active'].includes(b.Status)).length
      bookingRequests.cancelled = bookingData.filter((b) => ['Cancelled', 'Declined'].includes(b.Status)).length
      const fulfilled = bookingRequests.completed + bookingRequests.activeConfirmed
      bookingRequests.fulfillmentRate = bookingRequests.total > 0
        ? Number(((fulfilled / bookingRequests.total) * 100).toFixed(1))
        : 100.0
    }

    // C. Artist Verification Stats
    const { data: artistData } = await supabaseAdmin
      .from('ARTIST')
      .select('Is_Verified')

    if (artistData) {
      verificationQueue.total = artistData.length
      verificationQueue.verified = artistData.filter((a) => a.Is_Verified === true).length
      verificationQueue.unverified = artistData.filter((a) => !a.Is_Verified).length
      verificationQueue.verificationRate = verificationQueue.total > 0
        ? Number(((verificationQueue.verified / verificationQueue.total) * 100).toFixed(1))
        : 100.0
    }
  } catch (err: any) {
    console.warn('Platform requests calculation warning:', err.message)
  }

  // 4. API SERVER TELEMETRY
  const apiTelemetry = getTelemetryState()

  return {
    success: true,
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
      error: dbError,
      engine: 'Supabase PostgreSQL'
    },
    storage: {
      usedBytes: totalUsedBytes,
      freeBytes,
      quotaBytes,
      usedPercent,
      formattedUsed: formatBytes(totalUsedBytes),
      formattedFree: formatBytes(freeBytes),
      formattedQuota: formatBytes(quotaBytes),
      buckets: bucketList
    },
    requests: {
      api: apiTelemetry,
      workflows: {
        tags: tagRequests,
        bookings: bookingRequests,
        verifications: verificationQueue
      }
    }
  }
})
