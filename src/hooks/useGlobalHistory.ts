import { useEffect, useState } from 'react'
import { fetchNodeLoadHistory, type LoadHistory, type PingHistory, type PingTask, type PingRecord } from '@/api/client'
import { fetchNodePing, EMPTY_PING_PLUS, type PingHistoryPlus } from '@/api/ping'
import { bucketLoadHistory } from '@/utils/load'
import { pivotFleetLoad } from '@/utils/fleetLoad'
import { queryFleetLoad, supportsMetricStore, FLEET_LOAD_METRICS_NO_DISK } from '@/api/rpc2'

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

/**
 * The live ping/loss meter always renders the last 30 minutes across BUCKETS
 * slots, regardless of the chart range — it shows short-term fluctuation, not
 * a smoothed long average. At a 30s probe interval that is one sample per slot.
 */
const PING_WINDOW_MINUTES = 30

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

/** Per-node ping summary derived from the primary (lowest-id) ping task. */
export interface PingNodeStats {
  /** Average latency (ms) of the primary task across the queried window. */
  avg?: number
  /** Loss percent (0..100) of the primary task across the queried window. */
  loss: number
  /** Display name of the primary task (for tooltips / debug). */
  taskName?: string
}

export interface GlobalHistoryState {
  byNode: Record<string, PerNodeSeries>
  /** Per-node ping series — bucketed mean latency over windowMs (60 slots). */
  pingByNode: Record<string, number[]>
  /**
   * Per-node per-bucket packet-loss percent (0..100), aligned 1:1 with
   * pingByNode buckets. Derived from sample-count vs. expected-count
   * (bucketMs / probe interval). -1 means "interval unknown / can't compute".
   */
  pingLossByNode: Record<string, number[]>
  /** Per-node ping stats — current latency + loss percent. */
  pingStatsByNode: Record<string, PingNodeStats>
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
  /**
   * When false, the hook is paused — it doesn't fetch and returns an
   * empty state. Lets callers conditionally fire a hook based on UI
   * state (e.g. only pull 30d data when the user actually zooms to 30d).
   */
  enabled = true,
  /**
   * List views draw only the live meter, never a ping chart. Setting this
   * skips the aggregated ping range — one server-side aggregation and ~48KB
   * per node that would otherwise be fetched, parsed and thrown away, all
   * during the first paint.
   */
  liveOnly = false,
  /**
   * Skip ping entirely. Overview and Traffic chart cpu/ram/network and never
   * touch a ping field — yet each was still firing two ping requests per node
   * (raw samples + stats) and discarding every byte. At 18 nodes that is 36
   * round trips and 36 responses to parse, on a page that cannot display them.
   */
  skipPing = false,
  /**
   * Skip the disk/load series in the bulk query. They are ~40% of the payload
   * and the parse cost, and pages that only chart cpu/memory/network never
   * read them.
   */
  skipDiskLoad = false,
): GlobalHistoryState {
  const [state, setState] = useState<GlobalHistoryState>({
    byNode: {},
    pingByNode: {},
    pingLossByNode: {},
    pingStatsByNode: {},
    aggregate: emptyAggregate(),
    ping: EMPTY_PING,
    loading: true,
  })

  // Stable cache key — same uuids in any order should hit cache the same way.
  const key = [...uuids].sort().join(',') + `|h=${hours}`

  useEffect(() => {
    if (!enabled) {
      setState({
        byNode: {},
        pingByNode: {},
        pingLossByNode: {},
        pingStatsByNode: {},
        aggregate: emptyAggregate(),
        ping: EMPTY_PING,
        loading: false,
      })
      return
    }
    if (uuids.length === 0) {
      setState({
        byNode: {},
        pingByNode: {},
        pingLossByNode: {},
        pingStatsByNode: {},
        aggregate: emptyAggregate(),
        ping: EMPTY_PING,
        loading: false,
      })
      return
    }
    let cancelled = false

    const refresh = async () => {
      const windowMs = hours * 60 * 60 * 1000

      // Load history: one bulk query for the whole fleet when the metric store
      // is available. The legacy path fetches /api/records/load per node —
      // 18 nodes over 24h is ~2.25MB across 18 requests taking ~5s, which the
      // browser then buckets by hand. That fan-out is what stalled the first
      // paint. The store answers the same question pre-aggregated in one call:
      // ~0.36MB, ~1.15s, already bucketed.
      const bulkLoad = (await supportsMetricStore())
        ? await queryFleetLoad(
            hours,
            BUCKETS,
            skipDiskLoad ? FLEET_LOAD_METRICS_NO_DISK : undefined,
          )
            .then((series) => pivotFleetLoad(series, BUCKETS))
            .catch(() => undefined)
        : undefined

      // Ping still goes per-node: it is split per ping task, which the bulk
      // shape doesn't carry. `liveOnly` already trims it to the raw window for
      // views that draw no ping chart.
      const histories = await pmap(
        uuids,
        async (
          uuid,
        ): Promise<{ uuid: string; load: LoadHistory; ping: PingHistoryPlus }> => {
          const [load, ping] = await Promise.all([
            // Skip the legacy per-node fetch entirely when the bulk query
            // already covered this node.
            bulkLoad?.[uuid]
              ? Promise.resolve({ count: 0, records: [] } as LoadHistory)
              : fetchNodeLoadHistory(uuid, hours).catch(
                  () => ({ count: 0, records: [] }) as LoadHistory,
                ),
            // The live meter renders a 30-min window at 60 slots — one bar per
            // 30s probe. The metric store's minimum aggregation bucket is 60s,
            // so asking for the `hours` window would only ever half-fill it.
            // Request the raw samples over exactly the window we draw.
            skipPing
              ? Promise.resolve(EMPTY_PING_PLUS)
              : fetchNodePing(uuid, hours, 500, {
                  rawWindowMinutes: PING_WINDOW_MINUTES,
                  liveOnly,
                }).catch(() => EMPTY_PING_PLUS),
          ])
          return { uuid, load, ping }
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

      for (const { uuid, load } of histories) {
        // Server-bucketed when the bulk query covered this node; hand-bucketed
        // from raw records only on the legacy path.
        const series = bulkLoad?.[uuid] ?? bucketLoadHistory(load, BUCKETS, windowMs)
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

      // Merge per-node ping into a single PingHistory + per-node ms series.
      // Strategy: pick the "primary" task per node — the task with the lowest
      // id (= earliest created in Komari admin = first row in the latency
      // monitor list) — and surface its backend-computed avg/loss as the
      // node's headline latency/loss readout. The sparkline is filtered to
      // the same primary task so the bar chart and the headline number agree.
      // Other tasks are still preserved in the merged PingHistory so
      // NodeDetail can plot all targets separately.
      const tasksById = new Map<number, PingTask>()
      const allRecords: PingRecord[] = []
      const pingByNode: Record<string, number[]> = {}
      const pingLossByNode: Record<string, number[]> = {}
      const pingStatsByNode: Record<string, PingNodeStats> = {}
      // The ping/loss meter shows the most recent probes laid out in order —
      // it is a strip of samples, not a time axis. See the render block below.
      for (const { uuid, ping } of histories) {
        for (const t of ping.tasks ?? []) {
          if (!tasksById.has(t.id)) tasksById.set(t.id, t)
        }

        // Pick this node's primary target — lowest-id task that this node
        // actually has data for (samples present in the window).
        const tasksSorted = [...(ping.tasks ?? [])].sort((a, b) => a.id - b.id)
        const primary = tasksSorted[0]
        const primaryId = primary?.id

        // Charts consume the full aggregated range.
        for (const r of ping.records ?? []) {
          // Stamp client onto the merged record so the global view can split by node.
          allRecords.push({ ...r, client: r.client ?? uuid })
        }

        // The live meter consumes the raw short-window samples instead. These
        // are a uniform 30s grain — one per slot — whereas the charted series
        // is bucketed at 60s or wider. Bucketing the two together yields a
        // visibly uneven strip: dense where raw samples land, gappy elsewhere.
        // Legacy installs return per-probe records anyway, so liveRecords
        // falls back to records there.
        const liveSource =
          ping.liveRecords && ping.liveRecords.length > 0 ? ping.liveRecords : (ping.records ?? [])
        const liveLoss =
          ping.liveRecords && ping.liveRecords.length > 0
            ? ping.liveLossByTask
            : ping.lossByTask

        // Per-bucket packet loss %, reverse-derived from sample density:
        //   expected samples per bucket = bucketMs / (interval * 1000)
        //   loss% = (1 - actual/expected) * 100
        // CRITICAL: buckets *outside* the node's actual data span (before its
        // first sample, or after its last — e.g. the current still-filling
        // bucket) must NOT count as loss. Those are "no data yet", not a
        // dropped probe. We mark them -1 so the meter renders them empty
        // instead of a false full-loss bar. Only GAPS *between* real samples
        // are genuine packet loss.
        // The live meter is a strip of the most recent probes — not a time
        // axis. Bucketing raw samples into a fixed 30-min window leaves the
        // left third permanently blank, because the metric store caps raw
        // queries at ~38 points (~19 min at a 30s interval) no matter how wide
        // the window. So lay the samples out in order instead: every slot is a
        // real probe, the strip is uniformly dense, and it adapts to whatever
        // the server actually returns.
        //
        // Legacy installs return per-probe records too, so this path serves
        // them identically.
        const primaryLive = liveSource
          .filter((r) => primaryId != null && r.task_id === primaryId)
          .sort((a, b) => a.time.localeCompare(b.time))
          .slice(-BUCKETS)

        const lossAt = new Map<string, number | null>()
        for (const lp of liveLoss?.[primaryId ?? -1] ?? []) lossAt.set(lp.time, lp.loss)

        if (primaryLive.length > 0) {
          pingByNode[uuid] = primaryLive.map((r) => (r.value > 0 ? r.value : 0))
          pingLossByNode[uuid] = primaryLive.map((r) => {
            const l = lossAt.get(r.time)
            if (l != null) return l
            // No loss datum for this probe: a non-positive latency is the
            // failure sentinel, anything else succeeded.
            return r.value > 0 ? 0 : 100
          })
        } else {
          pingByNode[uuid] = []
          pingLossByNode[uuid] = []
        }

        // Headline number: trust backend's avg/loss for the primary task.
        // These are pre-computed per node per task across the queried window,
        // so they're accurate and free.
        if (primary) {
          pingStatsByNode[uuid] = {
            avg: typeof primary.avg === 'number' ? primary.avg : undefined,
            loss: typeof primary.loss === 'number' ? primary.loss : 0,
            taskName: primary.name,
          }
        } else {
          pingStatsByNode[uuid] = { loss: 0 }
        }
      }
      const ping: PingHistory = {
        count: allRecords.length,
        tasks: Array.from(tasksById.values()).sort((a, b) => a.id - b.id),
        records: allRecords,
      }

      setState({ byNode, pingByNode, pingLossByNode, pingStatsByNode, aggregate: agg, ping, loading: false })
    }

    setState((prev) => ({ ...prev, loading: prev.loading || Object.keys(prev.byNode).length === 0 }))
    refresh()
    const t = setInterval(refresh, refreshMs)

    return () => {
      cancelled = true
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hours, refreshMs, enabled, liveOnly, skipPing, skipDiskLoad])

  return state
}
