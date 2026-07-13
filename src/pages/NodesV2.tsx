/**
 * NodesV2 — v2.0 redesigned Nodes page, aligned to reference design.
 *
 * Layout:
 *
 *   ┌─ Topbar ─────────────────────────────────────────────────────┐
 *   │ Nodes title  · INVENTORY · 18 NODES · TABLE + GRID           │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ Search [Regions ▾] [Statuses ▾] [Providers/Groups ▾] [OS ▾]  │
 *   │ [More Filters]                  [Export][Refresh][Bulk ▾]    │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │  ▣ TOTAL  ● ONLINE  ○ DEGRADED  ● OFFLINE  ⏱ EXPIRING  ⚡ LOAD │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ View: [GRID|TABLE|COMPACT]                                   │
 *   ├──────────────────────────────────┬───────────────────────────┤
 *   │                                  │                           │
 *   │     Main list                    │  NodeDetailSidePanel      │
 *   │     (grid / table / compact)     │  (sticky, default first)  │
 *   │                                  │                           │
 *   ├──────────────────────────────────┴───────────────────────────┤
 *   │   Showing 1–18 of 18    PER PAGE: 20 | 50 | 100   ← prev next │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Mobile: side panel is hidden (falls back to NodeDetailDrawer pop-up).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PingHistory } from '@/api/client'
import { Sidebar } from '@/components/panels/Sidebar'
import { Topbar } from '@/components/panels/Topbar'
import { Footer } from '@/components/panels/Footer'
import type { Theme } from '@/components/atoms/ThemePicker'
import type {
  KomariNode,
  KomariRecord,
  KomariPublicConfig,
} from '@/types/komari'
import { useMobileDrawer, useIsMobile } from '@/hooks/useMediaQuery'
import { useGlobalHistory } from '@/hooks/useGlobalHistory'
import { useSearchQuery, nodeMatchesQuery } from '@/hooks/useSearchQuery'

import { useAggregateStats, isRecordDegraded } from '@/hooks/v2'

import {
  AggregateBar,
  MultiFilterRow,
  type FilterSpec,
  ViewModeSwitcher,
  useNodeViewMode,
  NodesPageActionBar,
  NodeCard,
  NodeRowTable,
  NodeDetailDrawer,
  NodeDetailSidePanel,
  SystemStatusFooter,
} from '@/components/v2'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { contentFs } from '@/utils/fontScale'

type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'

interface Props {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  theme: Theme
  onTheme: (t: Theme) => void
  siteName?: string
  conn?: Conn
  lastUpdate?: number | null
  ping?: PingHistory
  config?: KomariPublicConfig
  hubTargetUuid?: string
  viewVersion?: 'v1' | 'v2'
  onViewVersionChange?: (v: 'v1' | 'v2') => void
}

const PAGE_SIZE_OPTIONS = [20, 50, 100]
const DEFAULT_PAGE_SIZE = 20

export function NodesV2Page({
  nodes,
  records,
  theme,
  onTheme,
  siteName = '岚',
  conn = 'idle',
  lastUpdate,
  hubTargetUuid,
  viewVersion,
  onViewVersionChange,
}: Props) {
  const stats = useAggregateStats(nodes, records, { expiringWithinDays: 30 })
  const drawer = useMobileDrawer()
  const isMobile = useIsMobile()
  const [viewMode, setViewMode] = useNodeViewMode()

  const [searchQuery, setSearchQuery] = useSearchQuery()

  // 5 filter slots
  const [filterRegion, setFilterRegion] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterProviderGroup, setFilterProviderGroup] = useState('all')
  const [filterOs, setFilterOs] = useState('all')

  // Pagination
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [page, setPage] = useState(1)

  // 1h history for sparklines
  const uuids = useMemo(() => nodes.map((n) => n.uuid), [nodes])
  // liveOnly: the card grid renders no ping chart, so the aggregated range
  // would be fetched and discarded — 48KB and a server aggregation per node,
  // all landing during the first paint.
  const history1h = useGlobalHistory(uuids, 1, 60_000, true, true)

  // Precompute per-node combined net throughput sparkline arrays, keyed by
  // uuid. Memoized on history1h.byNode (refreshes ~60s) so each array keeps a
  // stable reference between renders — required for React.memo on NodeCard to
  // skip the 1Hz WS re-render storm.
  const netSparkByNode = useMemo(() => {
    const out: Record<string, number[]> = {}
    for (const [uuid, series] of Object.entries(history1h.byNode)) {
      out[uuid] = series.netIn.map((v, i) => v + (series.netOut[i] ?? 0))
    }
    return out
  }, [history1h.byNode])

  // ── Filter option sets ──
  const regionOptions = useMemo(() => {
    const set: Record<string, number> = {}
    for (const n of nodes) {
      const k = (n.region ?? '').trim() || 'Unassigned'
      set[k] = (set[k] ?? 0) + 1
    }
    return [
      { value: 'all', label: 'All Regions' },
      ...Object.entries(set)
        .sort((a, b) => b[1] - a[1])
        .map(([k, c]) => ({ value: k, label: k, count: c })),
    ]
  }, [nodes])

  const providerGroupOptions = useMemo(() => {
    const set: Record<string, number> = {}
    for (const n of nodes) {
      // Prefer provider, fall back to group
      const k =
        ((n as { provider?: string }).provider ?? '').trim() ||
        (n.group ?? '').trim() ||
        'Ungrouped'
      set[k] = (set[k] ?? 0) + 1
    }
    return [
      { value: 'all', label: 'All Providers / Groups' },
      ...Object.entries(set)
        .sort((a, b) => b[1] - a[1])
        .map(([k, c]) => ({ value: k, label: k, count: c })),
    ]
  }, [nodes])

  const osOptions = useMemo(() => {
    const set: Record<string, number> = {}
    for (const n of nodes) {
      // Normalize "Debian GNU/Linux 12 (bookworm)" → "Debian"
      const raw = n.os ?? 'Unknown'
      const first = raw.split(/[\s/]/)[0] || 'Unknown'
      set[first] = (set[first] ?? 0) + 1
    }
    return [
      { value: 'all', label: 'All OS' },
      ...Object.entries(set)
        .sort((a, b) => b[1] - a[1])
        .map(([k, c]) => ({ value: k, label: k, count: c })),
    ]
  }, [nodes])

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: 'All Statuses', count: stats.total },
      { value: 'online', label: 'Online', count: stats.online },
      { value: 'degraded', label: 'Degraded', count: stats.degraded },
      { value: 'offline', label: 'Offline', count: stats.offline },
    ],
    [stats.total, stats.online, stats.degraded, stats.offline],
  )

  // ── Filter nodes ──
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const r = records[n.uuid]

      if (filterRegion !== 'all') {
        const region = (n.region ?? '').trim() || 'Unassigned'
        if (region !== filterRegion) return false
      }

      if (filterProviderGroup !== 'all') {
        const key =
          ((n as { provider?: string }).provider ?? '').trim() ||
          (n.group ?? '').trim() ||
          'Ungrouped'
        if (key !== filterProviderGroup) return false
      }

      if (filterOs !== 'all') {
        const raw = n.os ?? 'Unknown'
        const first = raw.split(/[\s/]/)[0] || 'Unknown'
        if (first !== filterOs) return false
      }

      if (filterStatus !== 'all') {
        const online = !!r?.online
        const degraded = online && isRecordDegraded(r)
        if (filterStatus === 'online' && !online) return false
        if (filterStatus === 'offline' && online) return false
        if (filterStatus === 'degraded' && !degraded) return false
      }

      if (searchQuery && !nodeMatchesQuery(n, searchQuery)) return false
      return true
    })
  }, [
    nodes,
    records,
    filterRegion,
    filterProviderGroup,
    filterOs,
    filterStatus,
    searchQuery,
  ])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [
    filterRegion,
    filterProviderGroup,
    filterOs,
    filterStatus,
    searchQuery,
    pageSize,
  ])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredNodes.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filteredNodes.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  )

  // High-load count
  const highLoadCount = useMemo(
    () =>
      nodes.filter((n) => {
        const r = records[n.uuid]
        return r?.online && typeof r.load1 === 'number' && r.load1 > 4
      }).length,
    [nodes, records],
  )

  const filterSpecs: FilterSpec[] = [
    {
      key: 'region',
      label: 'REGION',
      options: regionOptions,
      value: filterRegion,
      onChange: setFilterRegion,
    },
    {
      key: 'status',
      label: 'STATUS',
      options: statusOptions,
      value: filterStatus,
      onChange: setFilterStatus,
    },
    {
      key: 'providerGroup',
      label: 'PROVIDER',
      options: providerGroupOptions,
      value: filterProviderGroup,
      onChange: setFilterProviderGroup,
    },
    {
      key: 'os',
      label: 'OS',
      options: osOptions,
      value: filterOs,
      onChange: setFilterOs,
    },
  ]

  // ── Selected node for side panel / drawer ──
  // Default selection: first online node (or first node if none online).
  const defaultUuid = useMemo(() => {
    if (filteredNodes.length === 0) return null
    const firstOnline = filteredNodes.find((n) => records[n.uuid]?.online)
    return (firstOnline ?? filteredNodes[0]).uuid
  }, [filteredNodes, records])

  const [selectedUuid, setSelectedUuid] = useState<string | null>(null)
  // If selected node disappears from the filter, reset
  useEffect(() => {
    if (!selectedUuid) return
    if (!filteredNodes.some((n) => n.uuid === selectedUuid))
      setSelectedUuid(null)
  }, [filteredNodes, selectedUuid])

  // Effective selection: prefer explicit, else default to first on desktop
  const effectiveSelectedUuid =
    selectedUuid ?? (isMobile ? null : defaultUuid)

  const selectedNode = effectiveSelectedUuid
    ? nodes.find((n) => n.uuid === effectiveSelectedUuid) ?? null
    : null
  const selectedRecord = effectiveSelectedUuid
    ? records[effectiveSelectedUuid]
    : undefined

  // Mobile uses Drawer (modal); desktop uses side panel (inline).
  // On mobile, only open drawer when user explicitly clicks.
  const [drawerUuid, setDrawerUuid] = useState<string | null>(null)
  const drawerNode = drawerUuid
    ? nodes.find((n) => n.uuid === drawerUuid) ?? null
    : null
  const drawerRecord = drawerUuid ? records[drawerUuid] : undefined

  const handleNodeClick = useCallback(
    (uuid: string) => {
      if (isMobile) {
        setDrawerUuid(uuid)
      } else {
        setSelectedUuid(uuid)
      }
    },
    [isMobile],
  )

  // Grid template
  const gridMinWidth = viewMode === 'compact' ? 280 : 300

  // Main column shrinks to leave room for side panel on desktop
  const mainGridWidth = isMobile ? '1fr' : 'minmax(0, 1fr) 300px'

  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--bg-0)',
        color: 'var(--fg-0)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Sidebar + system status footer */}
      <div
        style={{
          position: 'relative',
          display: isMobile ? 'contents' : 'block',
        }}
      >
        <Sidebar
          active="nodes"
          mobileOpen={drawer.open}
          onMobileClose={drawer.onClose}
          hubTargetUuid={hubTargetUuid}
        />
        {!isMobile && (
          <div
            style={{
              position: 'fixed',
              left: 8,
              bottom: 8,
              width: 184,
              zIndex: 5,
            }}
          >
            <SystemStatusFooter conn={conn} lastUpdate={lastUpdate} />
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <Topbar
          title={siteName}
          subtitle={`INVENTORY · ${stats.total} NODES · ${viewMode.toUpperCase()}`}
          theme={theme}
          onTheme={onTheme}
          online={stats.online}
          total={stats.total}
          conn={conn}
          lastUpdate={lastUpdate}
          onMobileMenu={drawer.onOpen}
          nodes={nodes}
          records={records}
          viewVersion={viewVersion}
          onViewVersionChange={onViewVersionChange}
        />
        <main
          className="app-main"
          style={{
            padding: isMobile ? 12 : 20,
            paddingBottom: isMobile ? 12 : 120,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Page heading */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: contentFs(20),
                  fontWeight: 600,
                  color: 'var(--fg-0)',
                  letterSpacing: '-0.02em',
                }}
              >
                Nodes
              </h2>
              <SerialPlate>N · {stats.total}</SerialPlate>
              <Etch>
                {filteredNodes.length === stats.total
                  ? 'ALL SHOWN'
                  : `SHOWN ${filteredNodes.length}/${stats.total}`}
              </Etch>
            </div>
            <NodesPageActionBar
              visibleNodes={filteredNodes}
              records={records}
              onRefresh={() => {
                // Hook will refresh on next interval; no explicit refetch
                // exposed today. Visual-only feedback via the spinner.
              }}
            />
          </div>

          {/* Aggregate bar */}
          <AggregateBar stats={stats} highLoadCount={highLoadCount} />

          {/* Filter row */}
          <MultiFilterRow
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filters={filterSpecs}
            meta={`PAGE ${safePage}/${totalPages}`}
            searchPlaceholder="Search nodes by name, IP, tag…"
          />

          {/* View mode row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0 2px',
            }}
          >
            <Etch>VIEW MODE</Etch>
            <ViewModeSwitcher value={viewMode} onChange={setViewMode} />
          </div>

          {/* Main content area: list + side panel */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: mainGridWidth,
              gap: 12,
              alignItems: 'start',
            }}
          >
            {/* Main list */}
            <div style={{ minWidth: 0 }}>
              {paginated.length === 0 ? (
                <div
                  className="precision-card"
                  style={{
                    padding: 40,
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: contentFs(11),
                    color: 'var(--fg-3)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {filteredNodes.length === 0
                    ? 'No nodes match the current filters.'
                    : 'Page is empty — try a different page.'}
                </div>
              ) : viewMode === 'table' ? (
                <NodeRowTable
                  nodes={paginated}
                  records={records}
                  onNodeClick={handleNodeClick}
                  selectedUuid={effectiveSelectedUuid ?? undefined}
                />
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fill, minmax(${gridMinWidth}px, 1fr))`,
                    gap: 10,
                  }}
                >
                  {paginated.map((n) => {
                    const netSpark = netSparkByNode[n.uuid]
                    return (
                      <NodeCard
                        key={n.uuid}
                        style={viewMode === 'compact' ? 'compact' : 'classic'}
                        node={n}
                        record={records[n.uuid]}
                        netSpark={netSpark}
                        pingSpark={history1h.pingByNode[n.uuid]}
                        pingLoss={history1h.pingLossByNode[n.uuid]}
                        pingStats={history1h.pingStatsByNode[n.uuid]}
                        onClick={handleNodeClick}
                        selected={effectiveSelectedUuid === n.uuid}
                      />
                    )
                  })}
                </div>
              )}
            </div>

            {/* Side panel — desktop only */}
            {!isMobile && (
              <NodeDetailSidePanel
                node={selectedNode}
                record={selectedRecord}
              />
            )}
          </div>

          {/* Pagination */}
          {filteredNodes.length > pageSize && (
            <div
              className="precision-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '8px 14px',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: contentFs(10),
                  color: 'var(--fg-2)',
                }}
              >
                Showing{' '}
                <span style={{ color: 'var(--fg-0)', fontWeight: 500 }}>
                  {(safePage - 1) * pageSize + 1}-
                  {Math.min(safePage * pageSize, filteredNodes.length)}
                </span>{' '}
                of{' '}
                <span style={{ color: 'var(--fg-0)', fontWeight: 500 }}>
                  {filteredNodes.length}
                </span>
              </span>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: contentFs(9),
                    letterSpacing: '0.12em',
                    color: 'var(--fg-3)',
                  }}
                >
                  PER PAGE
                </span>
                <div
                  style={{
                    display: 'inline-flex',
                    background: 'var(--bg-inset)',
                    border: '1px solid var(--edge-engrave)',
                    borderRadius: 3,
                    padding: 1,
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPageSize(s)}
                      style={{
                        padding: '3px 9px',
                        background:
                          pageSize === s ? 'var(--bg-2)' : 'transparent',
                        border: 'none',
                        borderRadius: 2,
                        fontFamily: 'var(--font-mono)',
                        fontSize: contentFs(10),
                        color:
                          pageSize === s
                            ? 'var(--accent-bright)'
                            : 'var(--fg-3)',
                        cursor: 'pointer',
                        fontWeight: pageSize === s ? 500 : 400,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  style={{
                    padding: '4px 8px',
                    background: 'var(--bg-1)',
                    border: '1px solid var(--edge-engrave)',
                    borderRadius: 3,
                    fontFamily: 'var(--font-mono)',
                    fontSize: contentFs(10),
                    color: 'var(--fg-1)',
                    cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                    opacity: safePage <= 1 ? 0.4 : 1,
                  }}
                >
                  ← PREV
                </button>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: contentFs(11),
                    color: 'var(--fg-1)',
                    fontWeight: 500,
                    minWidth: 30,
                    textAlign: 'center',
                  }}
                >
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  style={{
                    padding: '4px 8px',
                    background: 'var(--bg-1)',
                    border: '1px solid var(--edge-engrave)',
                    borderRadius: 3,
                    fontFamily: 'var(--font-mono)',
                    fontSize: contentFs(10),
                    color: 'var(--fg-1)',
                    cursor:
                      safePage >= totalPages ? 'not-allowed' : 'pointer',
                    opacity: safePage >= totalPages ? 0.4 : 1,
                  }}
                >
                  NEXT →
                </button>
              </div>
            </div>
          )}
        </main>
        <Footer />
      </div>

      {/* Mobile drawer (desktop uses inline side panel instead) */}
      {isMobile && (
        <NodeDetailDrawer
          node={drawerNode}
          record={drawerRecord}
          onClose={() => setDrawerUuid(null)}
        />
      )}
    </div>
  )
}
