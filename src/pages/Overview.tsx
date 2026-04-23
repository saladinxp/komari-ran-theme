import { useEffect, useMemo, useState } from 'react'
import { Sidebar } from '@/components/panels/Sidebar'
import { Topbar } from '@/components/panels/Topbar'
import { HeroStats } from '@/components/panels/HeroStats'
import { CardFrame } from '@/components/panels/CardFrame'
import { AlertsList, type AlertItem } from '@/components/panels/AlertsList'
import { NodeCardCompact } from '@/components/cards/NodeCardCompact'
import { NodeCardRow } from '@/components/cards/NodeCardRow'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { Segmented } from '@/components/atoms/Segmented'
import { Numeric } from '@/components/atoms/Numeric'
import { PingChart } from '@/components/charts/PingChart'
import { BarChart } from '@/components/charts/BarChart'
import { Footer } from '@/components/panels/Footer'
import { hashFor } from '@/router/route'
import type { KomariNode, KomariPublicConfig, KomariRecord } from '@/types/komari'
import type { PingHistory } from '@/api/client'
import type { GlobalHistoryState } from '@/hooks/useGlobalHistory'
import { aggregatePingByTarget, hasPingData } from '@/utils/ping'
import { formatBytes, formatBps } from '@/utils/format'

type Theme = 'ran-night' | 'ran-mist'
type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'
type ViewMode = 'grid' | 'row'
type Filter = 'all' | 'on' | 'warn' | 'off'

interface Props {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  theme: Theme
  onTheme: (t: Theme) => void
  siteName?: string
  conn?: Conn
  lastUpdate?: number | null
  ping?: PingHistory
  history?: GlobalHistoryState
  config?: KomariPublicConfig
  hubTargetUuid?: string
}

export function OverviewPage({
  nodes,
  records,
  theme,
  onTheme,
  siteName = '岚 · Komari',
  conn = 'idle',
  lastUpdate,
  ping,
  history,
  config,
  hubTargetUuid,
}: Props) {
  const [view, setView] = useState<ViewMode>('grid')
  const [filter, setFilter] = useState<Filter>('all')
  const [group, setGroup] = useState<string>('ALL')

  // Group options — derived from node.group field (user-defined grouping in Komari admin).
  // Nodes without a group land in "未分组" so they're never invisible.
  const groupOptions = useMemo(() => {
    const seen = new Set<string>()
    let hasUngrouped = false
    for (const n of nodes) {
      if (n.group && n.group.trim()) seen.add(n.group.trim())
      else hasUngrouped = true
    }
    const groups = Array.from(seen).sort((a, b) => a.localeCompare(b))
    if (hasUngrouped) groups.push('未分组')
    // Only show the picker when there are at least two distinct groups.
    if (groups.length < 2) return null
    return [{ value: 'ALL', label: 'ALL' }, ...groups.map((g) => ({ value: g, label: g }))]
  }, [nodes])

  // Reset group selection if the chosen group disappears from the list.
  useEffect(() => {
    if (!groupOptions) {
      if (group !== 'ALL') setGroup('ALL')
      return
    }
    if (!groupOptions.some((opt) => opt.value === group)) setGroup('ALL')
  }, [groupOptions, group])

  const heroStats = useMemo(() => {
    let online = 0
    let liveTx = 0 // bytes/sec across the fleet
    let liveRx = 0
    let totalNetTx = 0 // since-boot cumulative
    let totalNetRx = 0

    for (const n of nodes) {
      const r = records[n.uuid]
      if (r?.online) online++
      liveTx += r?.network_tx ?? 0
      liveRx += r?.network_rx ?? 0
      totalNetTx += r?.network_total_up ?? 0
      totalNetRx += r?.network_total_down ?? 0
    }

    const totalTraffic = totalNetTx + totalNetRx
    const total = nodes.length
    const trafficStr = formatBytes(totalTraffic)
    const [trafficVal, trafficUnit] = trafficStr.split(' ')
    const txStr = formatBps(liveTx).split(' ')
    const rxStr = formatBps(liveRx).split(' ')

    // ── derive sparklines from real history ──
    const agg = history?.aggregate
    // online over time: bucket node-count (≈ # nodes that reported in that bucket)
    const onlineSpark = agg?.nodeCount ?? []
    // tx/rx per-bucket, summed across nodes (bytes/sec)
    const txSpark = agg?.netOut ?? []
    const rxSpark = agg?.netIn ?? []
    // total throughput rhythm — combined
    const trafficSpark = agg ? agg.netIn.map((v, i) => v + (agg.netOut[i] ?? 0)) : []

    return [
      {
        label: 'NODES ONLINE',
        code: 'M01',
        value: `${online}/${total}`,
        spark: onlineSpark,
        sparkColor: 'var(--signal-good)',
      },
      {
        label: '↑ TX RATE',
        code: 'M02',
        value: txStr[0] || '0',
        // formatBps returns e.g. "1.23 MB/s"; HeroStats prepends a space before unit,
        // strip "/s" so the cell reads "1.23 MB" with a tiny "/s" implied by the label.
        unit: (txStr[1] || 'B/s').replace('/s', ''),
        spark: txSpark,
        sparkColor: 'var(--accent-bright)',
      },
      {
        label: '↓ RX RATE',
        code: 'M03',
        value: rxStr[0] || '0',
        unit: (rxStr[1] || 'B/s').replace('/s', ''),
        spark: rxSpark,
        sparkColor: 'var(--signal-good)',
      },
      {
        label: 'TRAFFIC TOTAL',
        code: 'M04',
        value: trafficVal || '0',
        unit: trafficUnit || 'B',
        spark: trafficSpark,
        sparkColor: 'var(--accent)',
      },
    ]
  }, [nodes, records, history])

  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      // Group filter
      if (group !== 'ALL') {
        const ng = (n.group ?? '').trim()
        if (group === '未分组' ? ng !== '' : ng !== group) return false
      }
      // Status filter
      if (filter === 'all') return true
      const r = records[n.uuid]
      if (filter === 'on') return r?.online === true
      if (filter === 'off') return r?.online !== true
      if (filter === 'warn') return r?.online && (r.cpu ?? 0) > 80
      return true
    })
  }, [nodes, records, filter, group])

  const stats = useMemo(() => {
    let online = 0
    for (const n of nodes) {
      if (records[n.uuid]?.online) online++
    }
    return { online, total: nodes.length }
  }, [nodes, records])

  const subtitle = useMemo(() => {
    const regions = new Set(nodes.map((n) => n.region?.split('-')[0]).filter(Boolean))
    return `CLUSTER · ${nodes.length} NODES / ${regions.size} REGIONS`
  }, [nodes])

  // ── derive bottom rail data from real records ──
  const alerts = useMemo<AlertItem[]>(() => {
    const out: AlertItem[] = []
    let i = 1
    for (const n of nodes) {
      const r = records[n.uuid]
      if (!r) continue
      if (r.online === false) {
        out.push({
          code: `A·${String(i++).padStart(2, '0')}`,
          level: 'bad',
          levelLabel: 'OFFLINE',
          message: `${n.name} · 探针离线`,
          target: n.region ?? n.uuid.slice(0, 8),
          time: 'now',
        })
      } else if ((r.cpu ?? 0) > 90) {
        out.push({
          code: `A·${String(i++).padStart(2, '0')}`,
          level: 'bad',
          levelLabel: 'CRIT',
          message: `${n.name} · CPU ${Math.round(r.cpu ?? 0)}%`,
          target: n.region ?? n.uuid.slice(0, 8),
          time: 'live',
        })
      } else if ((r.cpu ?? 0) > 80) {
        out.push({
          code: `A·${String(i++).padStart(2, '0')}`,
          level: 'warn',
          levelLabel: 'WARN',
          message: `${n.name} · CPU ${Math.round(r.cpu ?? 0)}%`,
          target: n.region ?? n.uuid.slice(0, 8),
          time: 'live',
        })
      } else if ((r.loss ?? 0) > 5) {
        out.push({
          code: `A·${String(i++).padStart(2, '0')}`,
          level: 'warn',
          levelLabel: 'LOSS',
          message: `${n.name} · 丢包 ${(r.loss ?? 0).toFixed(1)}%`,
          target: n.region ?? n.uuid.slice(0, 8),
          time: 'live',
        })
      }
      if (out.length >= 6) break
    }
    return out
  }, [nodes, records])

  // ── Ping series — global mean latency per target, derived from records/ping ──
  // Prefer history.ping (per-node fan-out, properly merged) over the old `ping`
  // prop which comes from the unreliable global /api/records/ping endpoint that
  // many Komari deployments respond to with empty `tasks`.
  const pingSrc = history?.ping ?? ping
  const pingTargets = useMemo(
    () => (pingSrc && hasPingData(pingSrc) ? aggregatePingByTarget(pingSrc, 60, 60 * 60 * 1000, 4) : []),
    [pingSrc],
  )
  const pingSeries = useMemo(
    () => pingTargets.map((t) => ({ data: t.data, label: t.task.name })),
    [pingTargets],
  )

  // Per-bucket midpoint timestamps for chart tooltips (1H window, 60 buckets).
  const bucketTimes = useMemo(() => {
    const now = Date.now()
    const start = now - 60 * 60 * 1000
    const stepMs = (60 * 60 * 1000) / 60
    return Array.from({ length: 60 }, (_, i) => Math.round(start + (i + 0.5) * stepMs))
  }, [])

  // Traffic series — last hour of summed bytes/s (net_in + net_out) across all nodes.
  const trafficSeries = useMemo(() => {
    const agg = history?.aggregate
    if (!agg) return new Array(60).fill(0)
    return agg.netIn.map((v, i) => Math.round(v + (agg.netOut[i] ?? 0)))
  }, [history])

  // sum traffic for the bottom card
  const trafficSummary = useMemo(() => {
    let up = 0
    let down = 0
    for (const r of Object.values(records)) {
      up += r?.network_total_up ?? 0
      down += r?.network_total_down ?? 0
    }
    const peak = Math.max(...trafficSeries, 0)
    const peakStr = formatBytes(peak)
    const [peakVal, peakUnit] = peakStr.split(' ')
    return {
      up: formatBytes(up),
      down: formatBytes(down),
      peak: peakVal || '0',
      peakUnit: peakUnit || 'B/s',
    }
  }, [records, trafficSeries])

  const viewLabel = view === 'grid' ? 'GRID · COMPACT' : 'LIST · ROW'

  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--bg-0)',
        color: 'var(--fg-0)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Sidebar active="overview" hubTargetUuid={hubTargetUuid} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          title={siteName}
          subtitle={subtitle}
          theme={theme}
          onTheme={onTheme}
          online={stats.online}
          total={stats.total}
          lastUpdate={lastUpdate}
          conn={conn}
        />

        <main style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <HeroStats stats={heroStats} />

          {/* Nodes control bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: 'var(--fg-0)',
                }}
              >
                Nodes
              </h3>
              <SerialPlate>N · {String(nodes.length).padStart(2, '0')}</SerialPlate>
              <Etch>{viewLabel}</Etch>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {groupOptions && (
                <>
                  <Etch>GROUP</Etch>
                  <Segmented
                    size="sm"
                    value={group}
                    onChange={(v) => setGroup(v as string)}
                    options={groupOptions}
                  />
                  <span
                    style={{
                      width: 1,
                      height: 14,
                      background: 'var(--edge-engrave)',
                      margin: '0 2px',
                    }}
                  />
                </>
              )}
              <Segmented
                size="sm"
                value={view}
                onChange={(v) => setView(v as ViewMode)}
                options={[
                  { value: 'grid', label: 'GRID' },
                  { value: 'row', label: 'ROW' },
                ]}
              />
              <Segmented
                size="sm"
                value={filter}
                onChange={(v) => setFilter(v as Filter)}
                options={[
                  { value: 'all', label: 'ALL' },
                  { value: 'on', label: 'ONLINE' },
                  { value: 'warn', label: 'DEGR' },
                  { value: 'off', label: 'OFF' },
                ]}
              />
            </div>
          </div>

          {/* Group filter moved into the controls row above */}

          {/* Cards */}
          {filteredNodes.length === 0 ? (
            <div
              style={{
                padding: 80,
                textAlign: 'center',
                color: 'var(--fg-2)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                background: 'var(--bg-inset)',
                border: '1px solid var(--edge-engrave)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {nodes.length === 0
                ? conn === 'open'
                  ? 'NO PROBES CONFIGURED'
                  : 'CONNECTING TO PROBE NETWORK …'
                : 'NO PROBES MATCH FILTER'}
            </div>
          ) : view === 'grid' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 14,
              }}
            >
              {filteredNodes.map((node) => (
                <a
                  key={node.uuid}
                  href={hashFor({ name: 'nodes', uuid: node.uuid })}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <NodeCardCompact
                    node={node}
                    record={records[node.uuid]}
                    netSpark={history?.byNode[node.uuid]?.netOut ?? []}
                    pingSpark={history?.pingByNode[node.uuid] ?? []}
                  />
                </a>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredNodes.map((node) => (
                <a
                  key={node.uuid}
                  href={hashFor({ name: 'nodes', uuid: node.uuid })}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <NodeCardRow
                    node={node}
                    record={records[node.uuid]}
                    netSpark={history?.byNode[node.uuid]?.netOut ?? []}
                    pingSpark={history?.pingByNode[node.uuid] ?? []}
                  />
                </a>
              ))}
            </div>
          )}

          {/* Bottom rail — Alerts / Ping / Traffic */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 16,
            }}
          >
            <CardFrame
              title="Active Alerts"
              code={`A · ${String(alerts.length).padStart(2, '0')}`}
              action={<Etch>RT</Etch>}
              inset
            >
              <AlertsList alerts={alerts} />
            </CardFrame>

            <CardFrame
              title="测速点延迟 · 1H"
              code="P · 06"
              action={
                <Etch>
                  {pingSeries.length > 0
                    ? `${pingSeries.length} TARGET${pingSeries.length === 1 ? '' : 'S'}`
                    : 'NO TARGETS'}
                </Etch>
              }
            >
              {pingSeries.length > 0 ? (
                <PingChart series={pingSeries} width={340} height={140} times={bucketTimes} />
              ) : (
                <div
                  style={{
                    padding: '40px 16px',
                    textAlign: 'center',
                    color: 'var(--fg-3)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    lineHeight: 1.6,
                  }}
                >
                  尚未配置测速点
                  <br />
                  <span style={{ fontSize: 9, color: 'var(--fg-3)', opacity: 0.7 }}>
                    add ping tasks in komari admin
                  </span>
                </div>
              )}
            </CardFrame>

            <CardFrame title="Traffic · 1H" code="T · 09">
              <BarChart
                data={trafficSeries}
                width={340}
                height={110}
                color="var(--accent)"
                labels={Array.from({ length: 60 }, (_, i) =>
                  i === 0 ? '-60m' : i === 30 ? '-30m' : i === 59 ? 'now' : '',
                )}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px solid var(--edge-engrave)',
                  gap: 8,
                }}
              >
                <div>
                  <Etch>↑ TOTAL</Etch>
                  <div>
                    <Numeric value={trafficSummary.up.split(' ')[0]} unit={trafficSummary.up.split(' ')[1]} size={14} />
                  </div>
                </div>
                <div>
                  <Etch>↓ TOTAL</Etch>
                  <div>
                    <Numeric value={trafficSummary.down.split(' ')[0]} unit={trafficSummary.down.split(' ')[1]} size={14} />
                  </div>
                </div>
                <div>
                  <Etch>PEAK</Etch>
                  <div>
                    <Numeric value={trafficSummary.peak} unit={trafficSummary.peakUnit} size={14} />
                  </div>
                </div>
              </div>
            </CardFrame>
          </div>
        </main>

        <Footer config={config} />
      </div>
    </div>
  )
}
