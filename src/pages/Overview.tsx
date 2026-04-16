import { useMemo, useState } from 'react'
import { Sidebar } from '@/components/panels/Sidebar'
import { Topbar } from '@/components/panels/Topbar'
import { HeroStats } from '@/components/panels/HeroStats'
import { NodeCardCompact } from '@/components/cards/NodeCardCompact'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { Segmented } from '@/components/atoms/Segmented'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { genSeries } from '@/utils/series'
import { formatBytes } from '@/utils/format'

type Theme = 'ran-night' | 'ran-mist'
type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'
type ViewMode = 'grid' | 'row' | 'detail'
type Filter = 'all' | 'on' | 'warn' | 'off'

interface Props {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  theme: Theme
  onTheme: (t: Theme) => void
  siteName?: string
  conn?: Conn
}

export function OverviewPage({
  nodes,
  records,
  theme,
  onTheme,
  siteName = '岚 · Komari',
  conn = 'idle',
}: Props) {
  const [view, setView] = useState<ViewMode>('grid')
  const [filter, setFilter] = useState<Filter>('all')

  // ── derive stats from real records ──
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
        value: formatBytes(totalTraffic).split(' ')[0] || '0',
        unit: formatBytes(totalTraffic).split(' ')[1] || 'B',
        spark: genSeries(30, 13, 60, 18),
        sparkColor: 'var(--accent)',
      },
      {
        label: 'REGIONS',
        code: 'M04',
        value: String(new Set(nodes.map((n) => n.region?.split('-')[0]).filter(Boolean)).size),
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

  const viewLabel = view === 'grid' ? 'GRID · COMPACT' : view === 'row' ? 'LIST · ROW' : 'DETAIL · FOCUS'

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
                  { value: 'detail', label: 'DETAIL' },
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
          ) : (
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
          )}
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
          <span>岚 · KOMARI PROBE THEME · v0.2.0</span>
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
