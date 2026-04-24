import { useEffect, useMemo, useState } from 'react'
import { Sidebar } from '@/components/panels/Sidebar'
import { Topbar } from '@/components/panels/Topbar'
import { Footer } from '@/components/panels/Footer'
import { CardFrame } from '@/components/panels/CardFrame'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { Segmented } from '@/components/atoms/Segmented'
import { NodeTable, type SortKey, type SortDir } from '@/components/cards/NodeTable'
import type { KomariNode, KomariPublicConfig, KomariRecord } from '@/types/komari'
import type { GlobalHistoryState } from '@/hooks/useGlobalHistory'
import { resolveRamPercent } from '@/utils/format'

type Theme = 'ran-night' | 'ran-mist'
type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'
type Filter = 'all' | 'on' | 'warn' | 'off'

interface Props {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  theme: Theme
  onTheme: (t: Theme) => void
  siteName?: string
  conn?: Conn
  lastUpdate?: number | null
  /** Reserved for future inline sparklines — currently unused on the table view. */
  history?: GlobalHistoryState
  config?: KomariPublicConfig
  hubTargetUuid?: string
}

/**
 * NodesPage — high-density tabular list of all probes.
 *
 * Trade-off vs Overview: this page sacrifices visual flair (no cards, no
 * sparklines, no traffic chart) in exchange for a single uninterrupted table
 * sortable by any column. Designed for "I have 30 nodes, show me all of them
 * at once and let me sort by CPU".
 *
 * Sort interaction: click a column header to sort by it; click again to flip
 * direction. The default direction depends on the column (e.g. EXPIRE defaults
 * ascending — soonest first; CPU/MEM/etc default descending — hottest first).
 */
export function NodesPage({
  nodes,
  records,
  theme,
  onTheme,
  siteName = '岚 · Komari',
  conn = 'idle',
  lastUpdate,
  config,
  hubTargetUuid,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [group, setGroup] = useState<string>('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('default')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Group options — derived from node.group field.
  const groupOptions = useMemo(() => {
    const seen = new Set<string>()
    let hasUngrouped = false
    for (const n of nodes) {
      if (n.group && n.group.trim()) seen.add(n.group.trim())
      else hasUngrouped = true
    }
    const groups = Array.from(seen).sort((a, b) => a.localeCompare(b))
    if (hasUngrouped) groups.push('未分组')
    if (groups.length < 2) return null
    return [{ value: 'ALL', label: 'ALL' }, ...groups.map((g) => ({ value: g, label: g }))]
  }, [nodes])

  useEffect(() => {
    if (!groupOptions) {
      if (group !== 'ALL') setGroup('ALL')
      return
    }
    if (!groupOptions.some((opt) => opt.value === group)) setGroup('ALL')
  }, [groupOptions, group])

  /**
   * Toggle behavior: clicking the same column flips the direction; clicking a
   * new column resets to that column's natural default (asc for EXPIRE/NAME,
   * desc for percentage and load metrics).
   */
  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    // Defaults match the ColumnSpec.defaultDir in NodeTable, kept in sync here.
    const descByDefault: SortKey[] = ['cpu', 'mem', 'disk', 'load', 'net']
    setSortDir(descByDefault.includes(key) ? 'desc' : 'asc')
  }

  const filtered = useMemo(() => {
    const list = nodes.filter((n) => {
      if (group !== 'ALL') {
        const ng = (n.group ?? '').trim()
        if (group === '未分组' ? ng !== '' : ng !== group) return false
      }
      const r = records[n.uuid]
      if (filter === 'all') return true
      if (filter === 'on') return r?.online === true
      if (filter === 'off') return r?.online !== true
      if (filter === 'warn') return r?.online && (r.cpu ?? 0) > 80
      return true
    })

    const dir = sortDir === 'asc' ? 1 : -1
    const cmp: Record<SortKey, (a: KomariNode, b: KomariNode) => number> = {
      // Admin drag-order — Komari writes panel position into `weight`.
      // Nodes without a weight float to the end and are then name-stable.
      default: (a, b) => {
        const aw = a.weight ?? Number.POSITIVE_INFINITY
        const bw = b.weight ?? Number.POSITIVE_INFINITY
        if (aw !== bw) return aw - bw
        return (a.name ?? '').localeCompare(b.name ?? '')
      },
      name: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
      region: (a, b) => (a.region ?? '').localeCompare(b.region ?? ''),
      cpu: (a, b) => (records[a.uuid]?.cpu ?? 0) - (records[b.uuid]?.cpu ?? 0),
      mem: (a, b) =>
        (resolveRamPercent(records[a.uuid]?.memory_used, records[a.uuid]?.memory_total) ?? 0) -
        (resolveRamPercent(records[b.uuid]?.memory_used, records[b.uuid]?.memory_total) ?? 0),
      disk: (a, b) => {
        const ap =
          records[a.uuid]?.disk_used != null && records[a.uuid]?.disk_total
            ? (records[a.uuid]!.disk_used! / records[a.uuid]!.disk_total!) * 100
            : 0
        const bp =
          records[b.uuid]?.disk_used != null && records[b.uuid]?.disk_total
            ? (records[b.uuid]!.disk_used! / records[b.uuid]!.disk_total!) * 100
            : 0
        return ap - bp
      },
      load: (a, b) => (records[a.uuid]?.load1 ?? 0) - (records[b.uuid]?.load1 ?? 0),
      net: (a, b) => {
        const av = (records[a.uuid]?.network_tx ?? 0) + (records[a.uuid]?.network_rx ?? 0)
        const bv = (records[b.uuid]?.network_tx ?? 0) + (records[b.uuid]?.network_rx ?? 0)
        return av - bv
      },
      expire: (a, b) => {
        const at = a.expired_at ? new Date(a.expired_at).getTime() : Infinity
        const bt = b.expired_at ? new Date(b.expired_at).getTime() : Infinity
        return at - bt
      },
    }
    return [...list].sort((a, b) => cmp[sortKey](a, b) * dir)
  }, [nodes, records, filter, group, sortKey, sortDir])

  const stats = useMemo(() => {
    let online = 0
    for (const n of nodes) if (records[n.uuid]?.online) online++
    return { online, total: nodes.length }
  }, [nodes, records])

  const subtitle = useMemo(() => {
    const regions = new Set(nodes.map((n) => n.region?.split('-')[0]).filter(Boolean))
    return `${nodes.length} NODES · ${regions.size} REGIONS · TABLE VIEW`
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
      <Sidebar active="nodes" hubTargetUuid={hubTargetUuid} />

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
              <Etch>
                BY {sortKey.toUpperCase()} · {sortDir === 'asc' ? '▲' : '▼'}
              </Etch>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

          {/* Group filter — only when 2+ groups exist */}
          {groupOptions && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: -4,
                flexWrap: 'wrap',
              }}
            >
              <Etch>GROUP</Etch>
              <Segmented
                size="sm"
                value={group}
                onChange={(v) => setGroup(v as string)}
                options={groupOptions}
              />
            </div>
          )}

          {/* Table or empty state */}
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
          ) : (
            <NodeTable
              nodes={filtered}
              records={records}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          )}
        </main>

        <Footer config={config} />
      </div>
    </div>
  )
}
