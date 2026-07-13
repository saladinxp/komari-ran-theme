import type { MetricSeries } from '@/api/rpc2'
import type { LoadSeries } from '@/utils/load'

/**
 * Pivot a bulk metric-store response into the per-node bucketed shape the
 * charts already expect.
 *
 * The server has done the bucketing: every series comes back on the same
 * interval with the same point count, so this is a reshape rather than an
 * aggregation. That is the whole point — the browser previously re-bucketed
 * ~2.25MB of raw records by hand on every open.
 *
 * Values, per the metric definitions:
 *   cpu.usage      percent
 *   memory.used/total, disk.used/total   bytes  → converted to percent here,
 *                                                 since that is what the charts
 *                                                 plot (and what the legacy
 *                                                 records/load path produced)
 *   net.in.rate / net.out.rate           bytes/sec
 *   load.average                         float
 */
export function pivotFleetLoad(series: MetricSeries[], buckets: number): Record<string, LoadSeries> {
  const empty = (): number[] => new Array(buckets).fill(0)

  // metric -> entity -> values, resampled onto `buckets` slots.
  const byMetric = new Map<string, Map<string, number[]>>()

  for (const s of series) {
    if (!s.entity_id) continue
    let m = byMetric.get(s.metric_key)
    if (!m) {
      m = new Map()
      byMetric.set(s.metric_key, m)
    }

    // The server returns its own point count; stretch or squeeze it onto our
    // bucket count by index, carrying the last known value across nulls so a
    // sparse series doesn't punch holes in the line.
    const pts = s.points
    const out = empty()
    if (pts.length > 0) {
      let carry = 0
      for (let i = 0; i < buckets; i++) {
        const idx = Math.min(pts.length - 1, Math.floor((i * pts.length) / buckets))
        const v = pts[idx]?.value
        if (v != null) carry = v
        out[i] = carry
      }
    }
    m.set(s.entity_id, out)
  }

  const get = (metric: string, uuid: string): number[] | undefined =>
    byMetric.get(metric)?.get(uuid)

  // Every entity that reported anything at all.
  const uuids = new Set<string>()
  for (const m of byMetric.values()) for (const id of m.keys()) uuids.add(id)

  const result: Record<string, LoadSeries> = {}

  for (const uuid of uuids) {
    const cpu = get('cpu.usage', uuid) ?? empty()
    const memUsed = get('memory.used', uuid)
    const memTotal = get('memory.total', uuid)
    const diskUsed = get('disk.used', uuid)
    const diskTotal = get('disk.total', uuid)

    // bytes → percent, guarding division by a zero/absent total.
    const pct = (used?: number[], total?: number[]): number[] => {
      if (!used || !total) return empty()
      return used.map((u, i) => {
        const t = total[i]
        return t > 0 ? Math.min(100, (u / t) * 100) : 0
      })
    }

    result[uuid] = {
      cpu,
      ram: pct(memUsed, memTotal),
      disk: pct(diskUsed, diskTotal),
      netIn: get('net.in.rate', uuid) ?? empty(),
      netOut: get('net.out.rate', uuid) ?? empty(),
      load: get('load.average', uuid) ?? empty(),
    }
  }

  return result
}
