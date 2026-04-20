import { useEffect, useState } from 'react'
import { fetchNodeLoadHistory, fetchPingHistory, type LoadHistory, type PingHistory } from '@/api/client'
import { bucketLoadHistory } from '@/utils/load'

/**
 * useGlobalHistory — fetches per-node load history for ALL probes (in parallel,
 * concurrency-capped) plus the global ping history once, and exposes:
 *
 *   - byNode: map uuid → bucketed series (60 slots over `windowMs`)
 *   - aggregate: summed network in/out + averaged cpu/ram/disk across all nodes
 *   - ping: raw global ping history (for components that want by-target slicing)
 *   - loading: true while initial fetch is in flight
 *
 * Refreshes every `refreshMs` (default 60s). Only re-fires the fetch when the set
 * of node uuids changes (sorted+joined as cache key) or window changes.
 *
 * Concurrency: max CONCURRENCY simultaneous /api/records/load calls — Komari can
 * handle a few but not 50 at once.
 */

const CONCURRENCY = 6
const BUCKETS = 60

export interface PerNodeSeries {
  cpu: number[]
  ram: number[]
  disk: number[]
  netIn: number[]
  netOut: number[]
  load: number[]
}

export interface AggregateSeries {
  /** Summed net_in across all nodes per bucket (bytes/s) */
  netIn: number[]
  /** Summed net_out across all nodes per bucket (bytes/s) */
  netOut: number[]
  /** Mean cpu % across reporting nodes per bucket */
  cpuMean: number[]
  /** Mean ram % across reporting nodes per bucket */
  ramMean: number[]
  /** Number of nodes that reported data per bucket */
  nodeCount: number[]
}

export interface GlobalHistoryState {
  byNode: Record<string, PerNodeSeries>
  /** Per-node ping series — bucketed mean latency over windowMs (60 slots). */
  pingByNode: Record<string, number[]>
  aggregate: AggregateSeries
  ping: PingHistory
  loading: boolean
}

const EMPTY_PING: PingHistory = { count: 0, tasks: [], records: [] }

function emptyAggregate(): AggregateSeries {
  return {
    netIn: new Array(BUCKETS).fill(0),
    netOut: new Array(BUCKETS).fill(0),
    cpuMean: new Array(BUCKETS).fill(0),
    ramMean: new Array(BUCKETS).fill(0),
    nodeCount: new Array(BUCKETS).fill(0),
  }
}

/** Run async work in batches of `limit` to cap concurrency. */
async function pmap<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  limit: number,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      out[i] = await worker(items[i])
    }
  })
  await Promise.all(runners)
  return out
}

export function useGlobalHistory(
  uuids: string[],
  hours = 1,
  refreshMs = 60_000,
): GlobalHistoryState {
  const [state, setState] = useState<GlobalHistoryState>({
    byNode: {},
    pingByNode: {},
    aggregate: emptyAggregate(),
    ping: EMPTY_PING,
    loading: true,
  })

  // Stable cache key — same uuids in any order should hit cache the same way.
  const key = [...uuids].sort().join(',') + `|h=${hours}`

  useEffect(() => {
    if (uuids.length === 0) {
      setState({
        byNode: {},
        pingByNode: {},
        aggregate: emptyAggregate(),
        ping: EMPTY_PING,
        loading: false,
      })
      return
    }
    let cancelled = false

    const refresh = async () => {
      const windowMs = hours * 60 * 60 * 1000

      // Kick off ping in parallel; load fans out per-node.
      const pingPromise = fetchPingHistory(hours).catch(() => EMPTY_PING)

      const histories = await pmap(
        uuids,
        async (uuid): Promise<{ uuid: string; history: LoadHistory }> => {
          try {
            const history = await fetchNodeLoadHistory(uuid, hours)
            return { uuid, history }
          } catch {
            return { uuid, history: { count: 0, records: [] } }
          }
        },
        CONCURRENCY,
      )

      if (cancelled) return

      const byNode: Record<string, PerNodeSeries> = {}
      const agg = emptyAggregate()
      // For mean calculation we accumulate sums + per-bucket counts of reporting nodes.
      const cpuSum = new Array(BUCKETS).fill(0)
      const ramSum = new Array(BUCKETS).fill(0)
      const cpuCount = new Array(BUCKETS).fill(0)
      const ramCount = new Array(BUCKETS).fill(0)

      for (const { uuid, history } of histories) {
        const series = bucketLoadHistory(history, BUCKETS, windowMs)
        byNode[uuid] = series

        for (let i = 0; i < BUCKETS; i++) {
          if (series.netIn[i] > 0 || series.netOut[i] > 0 || series.cpu[i] > 0) {
            agg.netIn[i] += series.netIn[i]
            agg.netOut[i] += series.netOut[i]
            agg.nodeCount[i] += 1
            if (series.cpu[i] > 0) {
              cpuSum[i] += series.cpu[i]
              cpuCount[i] += 1
            }
            if (series.ram[i] > 0) {
              ramSum[i] += series.ram[i]
              ramCount[i] += 1
            }
          }
        }
      }

      for (let i = 0; i < BUCKETS; i++) {
        agg.cpuMean[i] = cpuCount[i] > 0 ? cpuSum[i] / cpuCount[i] : 0
        agg.ramMean[i] = ramCount[i] > 0 ? ramSum[i] / ramCount[i] : 0
      }

      const ping = await pingPromise
      if (cancelled) return

      // Bucket ping records per-client into 60 mean-latency slots.
      const pingByNode: Record<string, number[]> = {}
      if (ping.records.length > 0) {
        const now = Date.now()
        const start = now - windowMs
        const bucketMs = windowMs / BUCKETS
        // Per-uuid: sums + counts to compute means.
        const acc: Record<string, { sum: number[]; cnt: number[] }> = {}
        for (const uuid of uuids) {
          acc[uuid] = { sum: new Array(BUCKETS).fill(0), cnt: new Array(BUCKETS).fill(0) }
        }
        for (const r of ping.records) {
          if (!r.client || !acc[r.client]) continue
          const t = new Date(r.time).getTime()
          if (!Number.isFinite(t) || t < start) continue
          const idx = Math.min(BUCKETS - 1, Math.max(0, Math.floor((t - start) / bucketMs)))
          // Treat 0/negative ping (timeout/error sentinel) as no-data; otherwise it
          // drags the mean toward 0 and the sparkline lies.
          if (r.value > 0) {
            acc[r.client].sum[idx] += r.value
            acc[r.client].cnt[idx] += 1
          }
        }
        for (const uuid of uuids) {
          const { sum, cnt } = acc[uuid]
          pingByNode[uuid] = sum.map((s, i) => (cnt[i] > 0 ? s / cnt[i] : 0))
        }
      } else {
        for (const uuid of uuids) {
          pingByNode[uuid] = new Array(BUCKETS).fill(0)
        }
      }

      setState({ byNode, pingByNode, aggregate: agg, ping, loading: false })
    }

    setState((prev) => ({ ...prev, loading: prev.loading || Object.keys(prev.byNode).length === 0 }))
    refresh()
    const t = setInterval(refresh, refreshMs)

    return () => {
      cancelled = true
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshMs])

  return state
}
