// =============================================================================
// Server Telemetry Middleware
// Tracks in-memory request volume, status codes, and success rate for API endpoints.
// =============================================================================

interface TelemetryState {
  totalRequests: number
  successRequests: number
  clientErrors: number
  serverErrors: number
  startedAt: number
}

const state: TelemetryState = {
  totalRequests: 0,
  successRequests: 0,
  clientErrors: 0,
  serverErrors: 0,
  startedAt: Date.now()
}

export const getTelemetryState = () => {
  const total = state.totalRequests
  const success = state.successRequests
  const successRate = total > 0 ? Number(((success / total) * 100).toFixed(1)) : 100.0
  return {
    totalRequests: total,
    successRequests: success,
    clientErrors: state.clientErrors,
    serverErrors: state.serverErrors,
    successRate,
    uptimeSeconds: Math.floor((Date.now() - state.startedAt) / 1000)
  }
}

export default defineEventHandler((event) => {
  const path = event.path || event.node.req.url || ''

  // Only track API and RPC requests
  if (!path.startsWith('/api')) {
    return
  }

  state.totalRequests++

  // Track outcome when HTTP response finishes
  event.node.res.on('finish', () => {
    const statusCode = event.node.res.statusCode || 200
    if (statusCode < 400) {
      state.successRequests++
    } else if (statusCode < 500) {
      state.clientErrors++
    } else {
      state.serverErrors++
    }
  })
})
