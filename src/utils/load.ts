import type { LoadHistory, LoadRecord } from '@/api/client'

/**
 * Bucket load records into evenly-spaced slots over the last `windowMs`.
 * Returns numeric arrays for each metric (already ordered chronologically),
 * with zero-fill for empty slots.
 */
export interface LoadSeries {
  cpu: number[]
  ram: number[]
  disk: number[]
  netIn: number[]
  netOut: number[]
  load: number[]
}

export function bucketLoadHistory(
  history: LoadHistory,
  buckets = 60,
  windowMs = 60 * 60 * 1000,
): LoadSeries {
  const empty = (): number[] => new Array(buckets).fill(0)
  const counts = empty()
  const series: LoadSeries = {
    cpu: empty(),
    ram: empty(),
    disk: empty(),
    netIn: empty(),
    netOut: empty(),
    load: empty(),
  }

  if (!history?.records?.length) return series

  const now = Date.now()
  const start = now - windowMs
  const bucketMs = windowMs / buckets

  // Aggregate sums + counts
  const sums: LoadSeries = {
    cpu: empty(),
    ram: empty(),
    disk: empty(),
    netIn: empty(),
    netOut: empty(),
    load: empty(),
  }

  for (const r of history.records) {
    const t = new Date(r.time).getTime()
    if (!Number.isFinite(t) || t < start) continue
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor((t - start) / bucketMs)))
    counts[idx] += 1
    if (r.cpu != null) sums.cpu[idx] += r.cpu
    if (r.ram != null) sums.ram[idx] += r.ram
    if (r.disk != null) sums.disk[idx] += r.disk
    if (r.net_in != null) sums.netIn[idx] += r.net_in
    if (r.net_out != null) sums.netOut[idx] += r.net_out
    if (r.load != null) sums.load[idx] += r.load
  }

  for (let i = 0; i < buckets; i++) {
    const n = counts[i]
    if (n > 0) {
      series.cpu[i] = sums.cpu[i] / n
      series.ram[i] = sums.ram[i] / n
      series.disk[i] = sums.disk[i] / n
      series.netIn[i] = sums.netIn[i] / n
      series.netOut[i] = sums.netOut[i] / n
      series.load[i] = sums.load[i] / n
    }
  }

  return series
}

/** True if history has any records we can plot. */
export function hasLoadData(h: LoadHistory): boolean {
  return (h?.records?.length ?? 0) > 0
}

export type { LoadHistory, LoadRecord }
