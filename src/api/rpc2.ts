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
 * Per-task latency distribution, computed server-side (Komari 1.2.6+).
 *
 * The mean alone hides the thing that actually degrades a link: a route with a
 * 46ms average and a 312ms p99 feels broken, while a steady 50ms does not.
 * `p99_p50_ratio` is that jitter, already reduced to one number.
 */
export interface PingQualityStat {
  task_id?: string | number
  name?: string
  tags?: Record<string, string>
  total?: number
  valid?: number
  loss?: number
  min?: number
  max?: number
  avg?: number
  latest?: number
  p50?: number
  p99?: number
  stddev?: number
  p99_p50_ratio?: number
}

export async function fetchPingQuality(uuid: string, hours = 24): Promise<PingQualityStat[]> {
  const r = await rpc2<{ stats?: PingQualityStat[] }>('public:getPingMetricStats', { uuid, hours })
  return r.stats ?? []
}

/**
 * Whole-fleet load history in ONE request (Komari 1.2.6+).
 *
 * The legacy path fetches /api/records/load per node: 18 nodes over 24h is
 * ~2.25MB across 18 requests taking ~5s, and the browser then buckets all of
 * it by hand — which is why opening a dashboard stalled for seconds. The
 * metric store answers the same question in a single call, pre-aggregated
 * server-side: ~0.36MB in ~1.15s, already bucketed.
 *
 * Returns series keyed by metric, each carrying entity_id, so callers can
 * pivot to per-node without a second round trip.
 */
export const FLEET_LOAD_METRICS = [
  'cpu.usage',
  'memory.used',
  'memory.total',
  'disk.used',
  'disk.total',
  'net.in.rate',
  'net.out.rate',
  'load.average',
] as const

export async function queryFleetLoad(
  hours: number,
  maxPoints: number,
  metrics: readonly string[] = FLEET_LOAD_METRICS,
): Promise<MetricSeries[]> {
  return queryMetrics({
    metricKeys: [...metrics],
    // entity_ids omitted → every visible node.
    hours,
    maxPoints,
  })
}

/**
 * The subset a page that charts cpu/memory/network actually needs. Pulling
 * disk and load as well adds ~40% to the payload and the parse time for series
 * that are never read — and parsing blocks the main thread, which is what the
 * user feels as a frozen page.
 */
export const FLEET_LOAD_METRICS_NO_DISK = [
  'cpu.usage',
  'memory.used',
  'memory.total',
  'net.in.rate',
  'net.out.rate',
] as const

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
