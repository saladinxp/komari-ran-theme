import { useMemo, useState } from 'react'
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
import type { KomariNode, KomariRecord } from '@/types/komari'
import type { PingHistory } from '@/api/client'
import { aggregatePingByTarget, hasPingData } from '@/utils/ping'
import { genSeries } from '@/utils/series'
import { formatBytes } from '@/utils/format'

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
  ping?: PingHistory
}

export function OverviewPage({
  nodes,
  records,
  theme,
  onTheme,
  siteName = '岚 · Komari',
  conn = 'idle',
  ping,
}: Props) {
  const [view, setView] = useState<ViewMode>('grid')
  const [filter, setFilter] = useState<Filter>('all')

  const heroStats = useMemo(() => {
    let online = 0
    let warn = 0
    let totalNetTx = 0
    let totalNetRx = 0

    for (const n of nodes) {
      const r = records[n.uuid]
      if (r?.online) {
        online++
        if ((r.cpu ?? 0) > 80) warn++
      }
      totalNetTx += r?.network_total_up ?? 0
      totalNetRx += r?.network_total_down ?? 0
    }

    const totalTraffic = totalNetTx + totalNetRx
    const total = nodes.length
    const trafficStr = formatBytes(totalTraffic)
    const [trafficVal, trafficUnit] = trafficStr.split(' ')

    return [
      {
        label: 'NODES ONLINE',
        code: 'M01',
        value: `${online}/${total}`,
        spark: genSeries(30, 11, 80, 5),
        sparkColor: 'var(--signal-good)',
      },
      {
        label: 'DEGRADED',
        code: 'M02',
        value: String(warn),
        spark: genSeries(30, 12, 30, 15),
        sparkColor: 'var(--signal-warn)',
      },
      {
        label: 'TRAFFIC TOTAL',
        code: 'M03',
        value: trafficVal || '0',
        unit: trafficUnit || 'B',
        spark: genSeries(30, 13, 60, 18),
        sparkColor: 'var(--accent)',
      },
      {
        label: 'REGIONS',
        code: 'M04',
        value: String(
          new Set(nodes.map((n) => n.region?.split('-')[0]).filter(Boolean)).size,
        ),
        spark: genSeries(30, 14, 50, 5),
        sparkColor: 'var(--signal-info)',
      },
    ]
  }, [nodes, records])

  const filteredNodes = useMemo(() => {
    if (filter === 'all') return nodes
    return nodes.filter((n) => {
      const r = records[n.uuid]
      if (filter === 'on') return r?.online === true
      if (filter === 'off') return r?.online !== true
      if (filter === 'warn') return r?.online && (r.cpu ?? 0) > 80
      return true
    })
  }, [nodes, records, filter])

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
  const pingTargets = useMemo(
    () => (ping && hasPingData(ping) ? aggregatePingByTarget(ping, 60, 60 * 60 * 1000, 4) : []),
    [ping],
  )
  const pingSeries = useMemo(
    () => pingTargets.map((t) => ({ data: t.data, label: t.task.name })),
    [pingTargets],
  )

  const trafficSeries = useMemo(() => genSeries(30, 31, 60, 30).map(Math.round), [])

  // sum traffic for the bottom card
  const trafficSummary = useMemo(() => {
    let up = 0
    let down = 0
    for (const r of Object.values(records)) {
      up += r?.network_total_up ?? 0
      down += r?.network_total_down ?? 0
    }
    const peak = Math.max(...trafficSeries)
    return {
      up: formatBytes(up),
      down: formatBytes(down),
      peak: `${peak}`,
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
      <Sidebar active="overview" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          title={siteName}
          subtitle={subtitle}
          theme={theme}
          onTheme={onTheme}
          online={stats.online}
          total={stats.total}
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                <NodeCardCompact
                  key={node.uuid}
                  node={node}
                  record={records[node.uuid]}
                  netSpark={genSeries(40, hashSeed(node.uuid) + 1, 50, 30)}
                  pingSpark={genSeries(28, hashSeed(node.uuid) + 11, 80, 120)}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredNodes.map((node) => (
                <NodeCardRow
                  key={node.uuid}
                  node={node}
                  record={records[node.uuid]}
                  netSpark={genSeries(40, hashSeed(node.uuid) + 1, 50, 30)}
                  pingSpark={genSeries(28, hashSeed(node.uuid) + 11, 80, 120)}
                />
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
                <PingChart series={pingSeries} width={340} height={140} />
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

            <CardFrame title="Traffic · 30D" code="T · 09">
              <BarChart
                data={trafficSeries}
                width={340}
                height={110}
                color="var(--accent)"
                labels={Array.from({ length: 30 }, (_, i) => (i % 5 === 0 ? String(i + 1) : ''))}
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
                    <Numeric value={trafficSummary.peak} unit="GB" size={14} />
                  </div>
                </div>
              </div>
            </CardFrame>
          </div>
        </main>

        <footer
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--edge-engrave)',
            background: 'var(--bg-1)',
            color: 'var(--fg-3)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 'auto',
          }}
        >
          <span>岚 · KOMARI PROBE THEME · v0.3.0</span>
          <span>POWERED BY KOMARI</span>
        </footer>
      </div>
    </div>
  )
}

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
