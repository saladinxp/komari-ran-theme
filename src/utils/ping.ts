import type { PingHistory, PingRecord, PingTask } from '@/api/client'

export interface PingTargetSeries {
  task: PingTask
  /** Time bucket → average latency (ms) across all probing nodes */
  data: number[]
  /** Most recent ms value (latest bucket with data) */
  latest?: number
}

/**
 * Aggregate global ping history into one series per target (task).
 *
 * Each target is monitored by N probe nodes — for each time bucket we average
 * across the nodes that reported, giving a "global mean latency" view.
 *
 * Returns up to `maxTargets` series, sorted by task id.
 */
export function aggregatePingByTarget(
  history: PingHistory,
  buckets = 60,
  windowMs = 60 * 60 * 1000,
  maxTargets = 4,
): PingTargetSeries[] {
  const { tasks, records } = history
  if (!tasks?.length || !records?.length) return []

  const now = Date.now()
  const start = now - windowMs
  const bucketMs = windowMs / buckets

  // Build per-task buckets of summed latency + sample count
  const byTask = new Map<number, { sum: number[]; n: number[] }>()
  for (const t of tasks) {
    byTask.set(t.id, { sum: new Array(buckets).fill(0), n: new Array(buckets).fill(0) })
  }

  for (const r of records) {
    const slot = byTask.get(r.task_id)
    if (!slot) continue
    const t = new Date(r.time).getTime()
    if (!Number.isFinite(t) || t < start) continue
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor((t - start) / bucketMs)))
    if (Number.isFinite(r.value) && r.value >= 0) {
      slot.sum[idx] += r.value
      slot.n[idx] += 1
    }
  }

  // Average each bucket; pick latest non-empty for `latest`
  const out: PingTargetSeries[] = []
  const sortedTasks = [...tasks].sort((a, b) => a.id - b.id).slice(0, maxTargets)

  for (const task of sortedTasks) {
    const slot = byTask.get(task.id)
    if (!slot) continue

    const data = slot.sum.map((s, i) => (slot.n[i] > 0 ? s / slot.n[i] : 0))
    let latest: number | undefined
    for (let i = data.length - 1; i >= 0; i--) {
      if (slot.n[i] > 0) {
        latest = data[i]
        break
      }
    }
    out.push({ task, data, latest })
  }

  return out
}

/** Quickly check if a PingHistory contains any data we can plot. */
export function hasPingData(h: PingHistory): boolean {
  return (h?.tasks?.length ?? 0) > 0 && (h?.records?.length ?? 0) > 0
}

// Local re-export so callers can import only from here
export type { PingHistory, PingRecord, PingTask }
