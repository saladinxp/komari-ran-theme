/**
 * Ping history — metric store first, legacy REST as fallback.
 *
 * Shapes the new metric-store series back into the existing `PingHistory`
 * contract so every consumer upstream stays untouched. Two things come for
 * free once we are on the new store:
 *
 *   - `hours` is honoured again (the legacy endpoint returns only "today"
 *     after a 1.2.6 migration, whatever window you ask for),
 *   - `ping.loss` arrives as a real server-side series, so we no longer have
 *     to reverse-derive per-bucket loss from sample density.
 *
 * Loss is exposed separately in `lossByTask` rather than smuggled into the
 * latency records: a bucket's loss ratio is not a latency sample, and past
 * versions conflated the two out of necessity.
 */
import { fetchNodePingHistory, type PingHistory, type PingTask } from '@/api/client'
import { queryMetrics, rpc2, supportsMetricStore, type MetricSeries } from '@/api/rpc2'

/** Per-task loss ratio series, aligned to the latency buckets. */
export interface LossPoint {
  time: string
  /** Loss as a percentage (0..100); null for empty buckets. */
  loss: number | null
}

export interface PingHistoryPlus extends PingHistory {
  /** task_id -> loss series, aligned to `records`. Empty on the legacy path. */
  lossByTask: Record<number, LossPoint[]>
  /**
   * Un-aggregated samples over the live meter's short window only.
   *
   * Kept strictly apart from `records`: the two are at different grains (raw
   * 30s probes vs. server buckets of 60s or wider) and merging them produces a
   * visibly uneven bar strip — dense where the raw samples land, gappy where
   * only aggregated buckets exist. Charts read `records`; the live meter reads
   * `liveRecords`. Empty when raw data was not requested or unavailable.
   */
  liveRecords: PingHistory['records']
  /** task_id -> loss series aligned to `liveRecords`. */
  liveLossByTask: Record<number, LossPoint[]>
  /** True when the data came from the 1.2.6+ metric store. */
  fromMetricStore: boolean
}

interface PublicPingTask {
  id: number
  name: string
  type?: string
  interval?: number
}

/** Task names live outside the metric series (which only carry task_id tags). */
let taskCache: Promise<PublicPingTask[]> | null = null
function fetchPingTasks(): Promise<PublicPingTask[]> {
  if (!taskCache) {
    taskCache = rpc2<PublicPingTask[]>('public:getPublicPingTasks', {}).catch(() => [])
  }
  return taskCache
}

const EMPTY: PingHistoryPlus = {
  count: 0,
  tasks: [],
  records: [],
  lossByTask: {},
  liveRecords: [],
  liveLossByTask: {},
  fromMetricStore: false,
}

/**
 * Fetch ping history for one node over `hours`.
 *
 * `maxPoints` caps each task's series; the server downsamples to fit, so a
 * 7-day window costs no more than an hour.
 */
export async function fetchNodePing(
  uuid: string,
  hours = 1,
  maxPoints = 500,
  opts?: {
    /**
     * Fetch un-aggregated samples over an explicit window (minutes back from
     * now). The metric store's minimum bucket is 60s, so the 30-min live meter
     * — which wants one bar per 30s probe — must bypass aggregation or it can
     * only ever fill half its slots.
     */
    rawWindowMinutes?: number
    /**
     * Skip the aggregated range entirely. The node list draws only the live
     * meter; the charted series is a detail-page concern, and pulling it for
     * every card costs ~48KB and a server-side time-series aggregation each,
     * which is precisely what makes the first paint stall.
     */
    liveOnly?: boolean
  },
): Promise<PingHistoryPlus> {
  if (await supportsMetricStore()) {
    try {
      return await fetchFromMetricStore(uuid, hours, maxPoints, opts?.rawWindowMinutes, opts?.liveOnly)
    } catch {
      // fall through to legacy
    }
  }
  // Legacy REST returns raw per-probe records, so they serve both consumers —
  // that grain is exactly what the live meter wants.
  const legacy = await fetchNodePingHistory(uuid, hours)
  return {
    ...legacy,
    lossByTask: {},
    liveRecords: legacy.records,
    liveLossByTask: {},
    fromMetricStore: false,
  }
}

interface PingTaskStats {
  task_id?: string | number
  tags?: Record<string, string>
  loss?: number
  avg?: number
  min?: number
  max?: number
}

async function fetchFromMetricStore(
  uuid: string,
  hours: number,
  maxPoints: number,
  rawWindowMinutes?: number,
  liveOnly?: boolean,
): Promise<PingHistoryPlus> {
  const wantsRaw = rawWindowMinutes != null && rawWindowMinutes > 0

  const [series, liveSeries, taskDefs, stats] = await Promise.all([
    // Full requested range, server-aggregated — what the charts plot. Skipped
    // for list views, which draw no chart: each of these is a server-side
    // aggregation returning ~48KB, and fanning one out per card is precisely
    // what stalls the first paint.
    liveOnly
      ? Promise.resolve([] as MetricSeries[])
      : queryMetrics({
          metricKeys: ['ping.latency_ms', 'ping.loss'],
          entityId: uuid,
          hours,
          maxPoints,
        }),
    // The live meter needs un-aggregated 30s samples, but only over its own
    // short window. That is a *separate* query — folding it into the one above
    // (by passing `start`) would truncate the charts to 30 minutes, which is
    // exactly the regression this replaces.
    wantsRaw
      ? queryMetrics({
          metricKeys: ['ping.latency_ms', 'ping.loss'],
          entityId: uuid,
          start: new Date(Date.now() - rawWindowMinutes * 60_000).toISOString(),
          downsample: false,
          maxPoints: 500,
        }).catch(() => [] as MetricSeries[])
      : Promise.resolve([] as MetricSeries[]),
    fetchPingTasks(),
    // Server-computed avg/loss per task. The headline latency/loss readout on
    // each card reads these off the task objects, so they must be populated —
    // otherwise loss silently reports 0.
    rpc2<{ stats?: PingTaskStats[] }>('public:getPingMetricStats', { uuid, hours })
      .then((r) => r.stats ?? [])
      .catch(() => [] as PingTaskStats[]),
  ])

  const statsByTask = new Map<number, PingTaskStats>()
  for (const st of stats) {
    const id = Number(st.task_id ?? st.tags?.task_id)
    if (Number.isFinite(id)) statsByTask.set(id, st)
  }

  if (series.length === 0 && liveSeries.length === 0) {
    throw new Error('metric store returned no ping series')
  }

  const nameById = new Map(taskDefs.map((t) => [t.id, t]))
  const seenTasks = new Set<number>()

  /** Split one query's series into latency records + per-task loss. */
  const parse = (list: MetricSeries[]) => {
    const records: PingHistory['records'] = []
    const lossByTask: Record<number, LossPoint[]> = {}

    for (const s of list) {
      const taskId = Number(s.tags?.task_id)
      if (!Number.isFinite(taskId)) continue
      seenTasks.add(taskId)

      if (s.metric_key === 'ping.latency_ms') {
        for (const p of s.points) {
          // A null bucket means the server aggregated no sample into that slot
          // — "no data", NOT "the probe failed". Emitting the legacy -1
          // sentinel here would paint every empty bucket as a dropped packet.
          if (p.value == null) continue
          records.push({ task_id: taskId, time: p.time, value: p.value })
        }
      } else if (s.metric_key === 'ping.loss') {
        // Aggregated: a 0..1 ratio per bucket. Raw: 0 or 1 per probe. Both
        // scale to percent identically — a raw failure is 100% loss for that
        // one probe.
        lossByTask[taskId] = s.points.map((p) => ({
          time: p.time,
          loss: p.value == null ? null : p.value * 100,
        }))
      }
    }

    records.sort((a, b) => a.time.localeCompare(b.time))
    return { records, lossByTask }
  }

  const charted = parse(series)
  const live = parse(liveSeries)

  const tasks: PingTask[] = [...seenTasks].map((id) => {
    const def = nameById.get(id)
    const st = statsByTask.get(id)
    return {
      id,
      name: def?.name ?? `Task ${id}`,
      type: def?.type,
      interval: def?.interval,
      avg: st?.avg,
      loss: st?.loss,
      min: st?.min,
      max: st?.max,
    } as PingTask
  })

  return {
    count: charted.records.length,
    tasks,
    records: charted.records,
    lossByTask: charted.lossByTask,
    liveRecords: live.records,
    liveLossByTask: live.lossByTask,
    fromMetricStore: true,
  }
}

export { EMPTY as EMPTY_PING_PLUS }
