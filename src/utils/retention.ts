import type { KomariPublicConfig } from '@/types/komari'

/**
 * A time window option that can be filtered by retention.
 * Any object with an `hours` field works — keeps callers free to add fields.
 */
interface HasHours {
  hours: number
}

/** Default retention assumption when /api/public doesn't expose one (24h). */
const DEFAULT_RETENTION_HOURS = 24

/** Read the metric retention window (in hours) from the public config. */
export function getRecordRetentionHours(config: KomariPublicConfig | undefined): number {
  const v = config?.record_preserve_time
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
  return DEFAULT_RETENTION_HOURS
}

/** Read the ping retention window (in hours) from the public config. */
export function getPingRetentionHours(config: KomariPublicConfig | undefined): number {
  const v = config?.ping_record_preserve_time
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
  // Komari falls back to record retention if ping isn't set explicitly.
  return getRecordRetentionHours(config)
}

/**
 * Filter time-window options against an upper retention bound.
 *
 * Always keeps at least the smallest window so the UI never collapses to zero
 * options on a misconfigured / unreachable backend. The 1H window is virtually
 * always within retention so this is safe.
 */
export function filterWindowsByRetention<T extends HasHours>(
  windows: T[],
  retentionHours: number,
): T[] {
  if (!Number.isFinite(retentionHours) || retentionHours <= 0) return windows
  const allowed = windows.filter((w) => w.hours <= retentionHours)
  return allowed.length > 0 ? allowed : windows.slice(0, 1)
}
