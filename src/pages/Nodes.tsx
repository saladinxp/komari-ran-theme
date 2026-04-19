import { useMemo, useState } from 'react'
import { Sidebar } from '@/components/panels/Sidebar'
import { Topbar } from '@/components/panels/Topbar'
import { CardFrame } from '@/components/panels/CardFrame'
import { NodeCardRow } from '@/components/cards/NodeCardRow'
import { NodeCardCompact } from '@/components/cards/NodeCardCompact'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { Segmented } from '@/components/atoms/Segmented'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { genSeries } from '@/utils/series'
import { resolveRamPercent } from '@/utils/format'
import { hashFor } from '@/router/route'
import { Footer } from '@/components/panels/Footer'

type Theme = 'ran-night' | 'ran-mist'
type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'
type Filter = 'all' | 'on' | 'warn' | 'off'
type View = 'grid' | 'row'
type SortBy = 'name' | 'region' | 'cpu' | 'mem' | 'load' | 'expire'

interface Props {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  theme: Theme
  onTheme: (t: Theme) => void
  siteName?: string
  conn?: Conn
  lastUpdate?: number | null
}

export function NodesPage({
  nodes,
  records,
  theme,
  onTheme,
  siteName = '岚 · Komari',
  conn = 'idle',
  lastUpdate,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [view, setView] = useState<View>('grid')

  const filtered = useMemo(() => {
    const list = nodes.filter((n) => {
      const r = records[n.uuid]
      if (filter === 'all') return true
      if (filter === 'on') return r?.online === true
      if (filter === 'off') return r?.online !== true
      if (filter === 'warn') return r?.online && (r.cpu ?? 0) > 80
      return true
    })

    const sortFn: Record<SortBy, (a: KomariNode, b: KomariNode) => number> = {
      name: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
      region: (a, b) => (a.region ?? '').localeCompare(b.region ?? ''),
      cpu: (a, b) => (records[b.uuid]?.cpu ?? 0) - (records[a.uuid]?.cpu ?? 0),
      mem: (a, b) =>
        (resolveRamPercent(records[b.uuid]?.memory_used, records[b.uuid]?.memory_total) ?? 0) -
        (resolveRamPercent(records[a.uuid]?.memory_used, records[a.uuid]?.memory_total) ?? 0),
      load: (a, b) => (records[b.uuid]?.load1 ?? 0) - (records[a.uuid]?.load1 ?? 0),
      expire: (a, b) => {
        const at = a.expired_at ? new Date(a.expired_at).getTime() : Infinity
        const bt = b.expired_at ? new Date(b.expired_at).getTime() : Infinity
        return at - bt
      },
    }
    return [...list].sort(sortFn[sortBy])
  }, [nodes, records, filter, sortBy])

  const stats = useMemo(() => {
    let online = 0
    for (const n of nodes) if (records[n.uuid]?.online) online++
    return { online, total: nodes.length }
  }, [nodes, records])

  const subtitle = useMemo(() => {
    const regions = new Set(nodes.map((n) => n.region?.split('-')[0]).filter(Boolean))
    return `${nodes.length} NODES · ${regions.size} REGIONS · LIST VIEW`
  }, [nodes])

  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--bg-0)',
        color: 'var(--fg-0)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Sidebar active="nodes" />

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
          {/* Header bar */}
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
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: 'var(--fg-0)',
                }}
              >
                Nodes
              </h2>
              <SerialPlate>{`SHOWN ${filtered.length}/${nodes.length}`}</SerialPlate>
              <Etch>{view === 'grid' ? 'GRID' : 'ROW'} · BY {sortBy.toUpperCase()}</Etch>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Segmented
                size="sm"
                value={view}
                onChange={(v) => setView(v as View)}
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
              <Segmented
                size="sm"
                value={sortBy}
                onChange={(v) => setSortBy(v as SortBy)}
                options={[
                  { value: 'name', label: 'NAME' },
                  { value: 'region', label: 'REGION' },
                  { value: 'cpu', label: 'CPU' },
                  { value: 'mem', label: 'MEM' },
                  { value: 'load', label: 'LOAD' },
                  { value: 'expire', label: 'EXPIRE' },
                ]}
              />
            </div>
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <CardFrame title="No probes" code="∅">
              <div
                style={{
                  padding: '30px 16px',
                  textAlign: 'center',
                  color: 'var(--fg-3)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}
              >
                {nodes.length === 0 ? 'NO NODES CONFIGURED' : 'NO NODES MATCH FILTER'}
              </div>
            </CardFrame>
          ) : view === 'grid' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 14,
              }}
            >
              {filtered.map((node) => (
                <a
                  key={node.uuid}
                  href={hashFor({ name: 'nodes', uuid: node.uuid })}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <NodeCardCompact
                    node={node}
                    record={records[node.uuid]}
                    netSpark={genSeries(40, hashSeed(node.uuid) + 1, 50, 30)}
                    pingSpark={genSeries(28, hashSeed(node.uuid) + 11, 80, 120)}
                  />
                </a>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map((node) => (
                <a
                  key={node.uuid}
                  href={hashFor({ name: 'nodes', uuid: node.uuid })}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'block',
                  }}
                >
                  <NodeCardRow
                    node={node}
                    record={records[node.uuid]}
                    netSpark={genSeries(40, hashSeed(node.uuid) + 1, 50, 30)}
                    pingSpark={genSeries(28, hashSeed(node.uuid) + 11, 80, 120)}
                  />
                </a>
              ))}
            </div>
          )}
        </main>

        <Footer />
      </div>
    </div>
  )
}

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
