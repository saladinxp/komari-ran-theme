/**
 * RPC2 / metric-store client (Komari >= 1.2.6).
 *
 * 1.2.6 moved history into a new metric store. The legacy REST endpoints
 * (/api/records/ping, common:getRecords) still answer, but they read the old
 * tables — after the migration those only hold the current day, so anything
 * older silently disappears. The real data lives behind `public:queryMetrics`,
 * which also serves it pre-downsampled and, crucially, exposes `ping.loss` as
 * a first-class series instead of forcing us to infer loss from gaps in the
 * sample density.
 *
 * Everything here degrades quietly: on any failure the caller falls back to
 * the legacy REST path, so older Komari installs keep working unchanged.
 * The legacy path is scheduled for removal a couple of versions out.
 */
import { apiBase } from '@/api/client'

interface RpcError {
  code: number
  message: string
}

interface RpcResponse<T> {
  result?: T
  error?: RpcError
}

/** POST a single JSON-RPC 2.0 call to /api/rpc2. Throws on RPC-level errors. */
export async function rpc2<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${apiBase()}/api/rpc2`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) throw new Error(`rpc2 ${method}: HTTP ${res.status}`)
  const body = (await res.json()) as RpcResponse<T>
  if (body.error) throw new Error(`rpc2 ${method}: ${body.error.message}`)
  if (body.result === undefined) throw new Error(`rpc2 ${method}: empty result`)
  return body.result
}

export interface MetricPoint {
  time: string
  /** null for empty buckets, and for ping latency when the probe failed. */
  value: number | null
}

export interface MetricSeries {
  metric_key: string
  entity_id: string
  tags?: Record<string, string>
  interval_seconds?: number
  points: MetricPoint[]
}

interface MetricQueryResp {
  series: MetricSeries[]
  count: number
}

/**
 * Query one or more metric series. `max_points` caps each series — the server
 * downsamples to fit, so a 30-day window costs the same as an hour.
 */
export async function queryMetrics(opts: {
  metricKeys: string[]
  entityId?: string
  entityIds?: string[]
  /** Relative window. Ignored when `start` is given. */
  hours?: number
  /** Explicit window start (RFC3339). Enables sub-hour ranges. */
  start?: string
  maxPoints?: number
  /**
   * When false, the server returns raw samples instead of aggregated buckets.
   * The store's minimum bucket width is 60s, so a 30s probe interval can only
   * be recovered by turning aggregation off.
   */
  downsample?: boolean
}): Promise<MetricSeries[]> {
  const params: Record<string, unknown> = {
    metric_keys: opts.metricKeys,
    max_points: opts.maxPoints ?? 500,
  }
  if (opts.start) params.start = opts.start
  else params.hours = opts.hours ?? 1
  if (opts.downsample === false) params.downsample = false
  if (opts.entityId) params.entity_id = opts.entityId
  if (opts.entityIds) params.entity_ids = opts.entityIds

  const resp = await queryMetricsRaw(params)
  return resp.series ?? []
}

async function queryMetricsRaw(params: Record<string, unknown>): Promise<MetricQueryResp> {
  return rpc2<MetricQueryResp>('public:queryMetrics', params)
}

/**
 * Probe support once per page load. The legacy endpoints answer on every
 * version, so we cannot tell old from new by their success alone — we ask the
 * metric store directly and cache the verdict.
 */
let metricStoreSupport: Promise<boolean> | null = null

export function supportsMetricStore(): Promise<boolean> {
  if (!metricStoreSupport) {
    metricStoreSupport = rpc2<unknown[]>('public:listMetricDefinitions', {})
      .then((defs) => Array.isArray(defs) && defs.length > 0)
      .catch(() => false)
  }
  return metricStoreSupport
}
