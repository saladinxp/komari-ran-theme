import { useEffect, useState } from 'react'
import { fetchPingQuality, queryMetrics, supportsMetricStore, type PingQualityStat } from '@/api/rpc2'

export interface NodeTelemetry {
  /** Per-ping-task latency distribution. Empty on Komari < 1.2.6. */
  quality: PingQualityStat[]
  /** Bucketed history over the requested window. */
  tcp: number[]
  udp: number[]
  proc: number[]
  /** Latest reading of each, or undefined when unreported. */
  tcpNow?: number
  udpNow?: number
  procNow?: number
  /** Mean TCP across the window — the baseline a spike is judged against. */
  tcpMean?: number
  loading: boolean
  /** False when the backend predates the metric store; panels then hide. */
  supported: boolean
}

const EMPTY: NodeTelemetry = {
  quality: [],
  tcp: [],
  udp: [],
  proc: [],
  loading: true,
  supported: false,
}

function values(points: { value: number | null }[]): number[] {
  return points.filter((p) => p.value != null).map((p) => p.value as number)
}

/**
 * Telemetry the metric store exposes but the dashboard never surfaced:
 * latency distribution (p50/p99/jitter) and connection/process counts.
 *
 * Both are diagnostic rather than decorative — a link whose p99 dwarfs its p50
 * is degrading even while the mean looks fine, and a TCP count several times
 * its own baseline is the first sign of a scan, a leak, or a flood.
 */
export function useNodeTelemetry(uuid: string, hours = 24, refreshMs = 60_000): NodeTelemetry {
  const [state, setState] = useState<NodeTelemetry>(EMPTY)

  useEffect(() => {
    if (!uuid) return
    let cancelled = false

    const refresh = async () => {
      if (!(await supportsMetricStore())) {
        if (!cancelled) setState({ ...EMPTY, loading: false, supported: false })
        return
      }

      const [quality, series] = await Promise.all([
        fetchPingQuality(uuid, hours).catch(() => [] as PingQualityStat[]),
        queryMetrics({
          metricKeys: ['connections.tcp', 'connections.udp', 'process.count'],
          entityId: uuid,
          hours,
          maxPoints: 60,
        }).catch(() => []),
      ])

      if (cancelled) return

      const pick = (key: string) => {
        const s = series.find((x) => x.metric_key === key)
        return s ? values(s.points) : []
      }
      const tcp = pick('connections.tcp')
      const udp = pick('connections.udp')
      const proc = pick('process.count')
      const last = (a: number[]) => (a.length > 0 ? a[a.length - 1] : undefined)

      setState({
        quality,
        tcp,
        udp,
        proc,
        tcpNow: last(tcp),
        udpNow: last(udp),
        procNow: last(proc),
        tcpMean: tcp.length > 0 ? tcp.reduce((a, b) => a + b, 0) / tcp.length : undefined,
        loading: false,
        supported: true,
      })
    }

    setState((prev) => ({ ...prev, loading: true }))
    refresh()
    const t = setInterval(refresh, refreshMs)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [uuid, hours, refreshMs])

  return state
}
