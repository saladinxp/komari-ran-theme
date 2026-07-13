/**
 * Traffic quota — derived purely from Komari's own fields.
 *
 * Komari owns the entire traffic pipeline; the theme only renders it:
 *   - the agent accumulates `network_total_up/down` and resets them on the
 *     day configured by its `--month-rotate` flag,
 *   - the admin sets a per-node threshold (`traffic_limit`, in bytes) and a
 *     comparison mode (`traffic_limit_type`).
 *
 * We invent nothing: no parsing of the free-text `tags` label (users may
 * write anything there — it is decoration, not data), no local accumulation,
 * no guessing at the reset day. A limit of 0 means unlimited, and Komari's
 * own admin UI says as much ("设置为 0 B 禁用"), so we hide the bar entirely.
 */
import type { KomariNode, KomariRecord } from '@/types/komari'

export interface TrafficQuota {
  /** Bytes counted against the limit, per the node's comparison mode. */
  used: number
  /** Threshold in bytes (always > 0 here). */
  limit: number
  /** used / limit, clamped to [0, 1] for bar geometry. */
  ratio: number
  /** Uncapped percentage — may exceed 100 when over quota. */
  percent: number
  /** Comparison mode actually applied. */
  mode: 'max' | 'sum'
  /** Raw cumulative counters, shown alongside the bar. */
  up: number
  down: number
  /** Severity band, drives bar color. */
  level: 'ok' | 'warn' | 'crit'
}

/**
 * Returns undefined when the node has no traffic threshold configured
 * (unlimited) or when the counters have not been reported yet — callers
 * render nothing in that case.
 */
export function computeTrafficQuota(
  node: KomariNode,
  record?: KomariRecord,
): TrafficQuota | undefined {
  const limit = node.traffic_limit ?? 0
  if (!Number.isFinite(limit) || limit <= 0) return undefined

  const up = record?.network_total_up
  const down = record?.network_total_down
  if (up == null && down == null) return undefined

  const u = up ?? 0
  const d = down ?? 0
  const mode: 'max' | 'sum' = node.traffic_limit_type === 'sum' ? 'sum' : 'max'
  const used = mode === 'sum' ? u + d : Math.max(u, d)

  const percent = (used / limit) * 100
  const ratio = Math.min(1, Math.max(0, used / limit))
  const level: TrafficQuota['level'] = percent >= 85 ? 'crit' : percent >= 60 ? 'warn' : 'ok'

  return { used, limit, ratio, percent, mode, up: u, down: d, level }
}

/** Bar fill color for a severity band. */
export function trafficColor(level: TrafficQuota['level']): string {
  if (level === 'crit') return 'var(--signal-bad)'
  if (level === 'warn') return 'var(--signal-warn)'
  return 'var(--signal-good)'
}

/**
 * Percent label, kept readable at both extremes: two decimals while the bar
 * is still a sliver (0.04% reads better than 0%), one below ten, none above.
 */
export function formatTrafficPercent(percent: number): string {
  if (percent > 0 && percent < 1) return `${percent.toFixed(2)}%`
  if (percent < 10) return `${percent.toFixed(1)}%`
  return `${percent.toFixed(0)}%`
}
