/**
 * HubPage — single-node cockpit / "control hub".
 *
 * Positioning: the high-density "show me everything about this one node"
 * view, in contrast to NodeDetail which is the standard everyday detail
 * page. Hub is the brag-mode page — laid out for maximum information
 * density and a vaguely mil-spec / instrument-cluster feel.
 *
 * Data honesty: every cell is driven by real Komari API data. Modules
 * that can't be backed by the API right now (geographic map; per-core
 * CPU; live process list; live socket table) are either omitted or
 * shown as a labeled PLANNED placeholder — never with fabricated data.
 */

import { useEffect, useMemo, useState } from 'react'
import { Sidebar } from '@/components/panels/Sidebar'
import { Topbar } from '@/components/panels/Topbar'
import { CardFrame } from '@/components/panels/CardFrame'
import { Footer } from '@/components/panels/Footer'
import { NodeSwitcher } from '@/components/panels/NodeSwitcher'
import { AlertsList, type AlertItem } from '@/components/panels/AlertsList'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { Segmented } from '@/components/atoms/Segmented'
import { StatusDot } from '@/components/atoms/StatusDot'
import { StatusBadge } from '@/components/atoms/StatusBadge'
import { AreaChart } from '@/components/charts/AreaChart'
import { RadialGauge } from '@/components/charts/RadialGauge'
import { PingChart } from '@/components/charts/PingChart'
import type { KomariNode, KomariPublicConfig, KomariRecord } from '@/types/komari'
import type { PingHistory } from '@/api/client'
import {
  formatBytes,
  formatBps,
  formatUptime,
  parseLabels,
  daysUntil,
  resolveRamPercent,
} from '@/utils/format'
import { bucketLoadHistory } from '@/utils/load'
import { aggregatePingByTarget, hasPingData } from '@/utils/ping'
import { filterWindowsByRetention, getRecordRetentionHours } from '@/utils/retention'
import { useNodeHistory } from '@/hooks/useNodeHistory'
import { useElementWidth } from '@/hooks/useElementWidth'
import { hashFor } from '@/router/route'
import { useMobileDrawer } from '@/hooks/useMediaQuery'

type Theme = 'ran-night' | 'ran-mist'
type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'

type WindowKey = '1h' | '6h' | '24h' | '7d'
interface WindowSpec {
  key: WindowKey
  label: string
  hours: number
  buckets: number
}
const WINDOWS: WindowSpec[] = [
  { key: '1h', label: '1H', hours: 1, buckets: 60 },
  { key: '6h', label: '6H', hours: 6, buckets: 72 },
  { key: '24h', label: '24H', hours: 24, buckets: 96 },
  { key: '7d', label: '7D', hours: 24 * 7, buckets: 84 },
]

interface Props {
  uuid: string
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  theme: Theme
  onTheme: (t: Theme) => void
  siteName?: string
  conn?: Conn
  lastUpdate?: number | null
  config?: KomariPublicConfig
  /** Site-wide ping history (used for ping-to-targets summary). */
  ping?: PingHistory
  hubTargetUuid?: string
}

/* ─────────────────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────────────────── */

function formatPctValue(v: number): string {
  return `${v.toFixed(1)}%`
}
function formatBytesAxis(v: number): string {
  return formatBytes(v, 0)
}

/** Build a synthetic Heartbeat 7d series from ping history.
 *
 * The "30-cell heatmap" in the design comp would normally come from a
 * dedicated uptime/heartbeat endpoint. Komari doesn't expose one yet,
 * so we derive it: each cell is a window in the past 7 days, marked
 * green if at least one ping succeeded in that window, gray if no
 * data, red if every ping in the window failed.
 *
 * This is honest about what we have — the cell title text says where
 * the data came from. Cells fall back to "no data" when the retention
 * window is shorter than 7 days. */
type HeartbeatCell = {
  /** -1 = no data, 0 = all losses, 1 = at least one success. */
  state: -1 | 0 | 1
  /** Time label for tooltips. */
  label: string
}

function deriveHeartbeat7d(pingHistory: PingHistory): HeartbeatCell[] {
  const CELLS = 28 // 7 days × 4 windows/day = 6h windows
  const now = Date.now()
  const windowMs = 7 * 24 * 60 * 60 * 1000
  const start = now - windowMs
  const cellMs = windowMs / CELLS

  const cells: HeartbeatCell[] = Array.from({ length: CELLS }, (_, i) => {
    const cellStart = start + i * cellMs
    const cellEnd = cellStart + cellMs
    const date = new Date(cellStart)
    const day = date.getMonth() + 1 + '/' + date.getDate()
    const hour = String(date.getHours()).padStart(2, '0')
    return { state: -1 as -1 | 0 | 1, label: `${day} ${hour}:00` }
  })

  if (!pingHistory.records?.length) return cells

  for (const rec of pingHistory.records) {
    const t = new Date(rec.time).getTime()
    if (!Number.isFinite(t) || t < start || t >= now) continue
    const idx = Math.min(CELLS - 1, Math.floor((t - start) / cellMs))
    const success = rec.value > 0 // ping value 0 or negative is loss in komari
    if (cells[idx].state === -1) {
      cells[idx].state = success ? 1 : 0
    } else if (success && cells[idx].state === 0) {
      cells[idx].state = 1
    }
  }
  return cells
}

/** Recent alerts derived from current node state. Mirrors the Overview-page
 *  derivation but limited to one node, with a few extra signals (disk, mem). */
function deriveAlertsForNode(
  node: KomariNode,
  record: KomariRecord | undefined,
): AlertItem[] {
  const out: AlertItem[] = []
  let i = 1
  const target = node.region ?? node.uuid.slice(0, 8)
  const hostName = node.name ?? node.uuid.slice(0, 8)

  const push = (
    level: AlertItem['level'],
    levelLabel: string,
    message: string,
  ) => {
    out.push({
      code: `H·${String(i++).padStart(2, '0')}`,
      level,
      levelLabel,
      message,
      target,
      time: 'live',
    })
  }

  if (!record || record.online === false) {
    push('bad', 'OFFLINE', `${hostName} · 探针离线`)
    return out
  }
  if ((record.cpu ?? 0) > 90) push('bad', 'CRIT', `CPU ${Math.round(record.cpu ?? 0)}%`)
  else if ((record.cpu ?? 0) > 80) push('warn', 'WARN', `CPU ${Math.round(record.cpu ?? 0)}%`)

  const memPct = resolveRamPercent(record.memory_used, record.memory_total) ?? 0
  if (memPct > 90) push('bad', 'CRIT', `MEM ${memPct.toFixed(0)}%`)
  else if (memPct > 80) push('warn', 'WARN', `MEM ${memPct.toFixed(0)}%`)

  const diskPct =
    record.disk_used != null && record.disk_total
      ? (record.disk_used / record.disk_total) * 100
      : 0
  if (diskPct > 90) push('bad', 'CRIT', `DISK ${diskPct.toFixed(0)}%`)
  else if (diskPct > 80) push('warn', 'WARN', `DISK ${diskPct.toFixed(0)}%`)

  if ((record.loss ?? 0) > 5) push('warn', 'LOSS', `丢包 ${(record.loss ?? 0).toFixed(1)}%`)

  const expDays = node.expired_at ? daysUntil(node.expired_at) : undefined
  if (expDays != null) {
    if (expDays <= 7) push('bad', 'EXPIRE', `订阅 ${expDays} 天后到期`)
    else if (expDays <= 30) push('warn', 'EXPIRE', `订阅 ${expDays} 天后到期`)
  }

  if (out.length === 0) {
    out.push({
      code: 'H·00',
      level: 'good',
      levelLabel: 'OK',
      message: '所有指标正常',
      target,
      time: 'live',
    })
  }
  return out
}

/* ─────────────────────────────────────────────────────────────────────────
   Sub-components
   ───────────────────────────────────────────────────────────────────────── */

/** A row of "label : value" lines, minimal spacing, for system info blocks. */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '64px 1fr',
        alignItems: 'baseline',
        padding: '4px 0',
        borderBottom: '1px dashed var(--edge-engrave)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
      }}
    >
      <span
        style={{
          color: 'var(--fg-3)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontSize: 9,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: 'var(--fg-1)',
          fontVariantNumeric: 'tabular-nums',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  )
}

/** A horizontal allocation bar — used / total with a thin precision bar. */
function AllocationBar({
  label,
  used,
  total,
  formatFn = (v) => formatBytes(v, 1),
}: {
  label: string
  used?: number
  total?: number
  formatFn?: (v: number) => string
}) {
  const pct =
    used != null && total && total > 0 ? Math.min(100, (used / total) * 100) : 0
  const color =
    pct >= 85 ? 'var(--signal-bad)' : pct >= 65 ? 'var(--signal-warn)' : 'var(--accent)'
  return (
    <div style={{ padding: '6px 0', borderBottom: '1px dashed var(--edge-engrave)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 4,
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: 'var(--fg-3)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 10, color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums' }}>
          {used != null && total != null && total > 0
            ? `${formatFn(used)} / ${formatFn(total)}`
            : '—'}
        </span>
      </div>
      <div
        style={{
          height: 4,
          background: 'var(--bg-inset)',
          border: '1px solid var(--edge-engrave)',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: color,
            boxShadow: pct > 0 ? `0 0 4px ${color}` : 'none',
          }}
        />
      </div>
    </div>
  )
}

/** Heartbeat strip — 28 cells representing the past 7 days. */
function HeartbeatStrip({ cells }: { cells: HeartbeatCell[] }) {
  const upPct =
    cells.filter((c) => c.state === 1).length /
    Math.max(1, cells.filter((c) => c.state !== -1).length)
  const fails = cells.filter((c) => c.state === 0).length
  const haveData = cells.some((c) => c.state !== -1)

  return (
    <div>
      <div style={{ display: 'flex', gap: 2 }}>
        {cells.map((c, i) => {
          const bg =
            c.state === 1
              ? 'var(--signal-good)'
              : c.state === 0
                ? 'var(--signal-bad)'
                : 'var(--bg-inset)'
          const glow =
            c.state === 1 ? '0 0 4px var(--signal-good)' : 'none'
          return (
            <div
              key={i}
              title={`${c.label} · ${
                c.state === 1 ? 'OK' : c.state === 0 ? 'LOSS' : 'no data'
              }`}
              style={{
                flex: 1,
                height: 12,
                background: bg,
                border: '1px solid var(--edge-engrave)',
                boxShadow: glow,
              }}
            />
          )
        })}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--fg-3)',
          letterSpacing: '0.16em',
        }}
      >
        <Etch>UPTIME {haveData ? `${(upPct * 100).toFixed(1)}%` : '—'}</Etch>
        <Etch>FAILS · {fails}</Etch>
        <Etch>DERIVED · PING</Etch>
      </div>
    </div>
  )
}

/** Inter-target latency rows — current node's recent ping to each speed test target. */
function TargetLatencyList({
  targets,
}: {
  targets: { name: string; value: number; loss: number }[]
}) {
  if (targets.length === 0) {
    return (
      <div
        style={{
          padding: '20px 0',
          textAlign: 'center',
          color: 'var(--fg-3)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.16em',
        }}
      >
        NO PING TARGETS
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {targets.slice(0, 8).map((t, i) => {
        const c =
          t.value > 200
            ? 'var(--signal-bad)'
            : t.value > 100
              ? 'var(--signal-warn)'
              : 'var(--signal-good)'
        // Bar scales 0..300ms — most realistic global latencies fit here.
        const w = Math.min(100, (t.value / 300) * 100)
        return (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 60px 70px',
              gap: 8,
              alignItems: 'center',
              padding: '4px 0',
              borderBottom: '1px dashed var(--edge-engrave)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: 'var(--fg-2)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={t.name}
            >
              {t.name}
            </span>
            <div
              style={{
                height: 4,
                background: 'var(--bg-inset)',
                border: '1px solid var(--edge-engrave)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${w}%`,
                  background: c,
                  boxShadow: `0 0 3px ${c}`,
                }}
              />
            </div>
            <span
              style={{
                fontSize: 10,
                color: c,
                fontWeight: 600,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {t.value.toFixed(0)}ms
              {t.loss > 0 ? (
                <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>
                  {' · '}
                  {t.loss.toFixed(0)}%
                </span>
              ) : null}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Bottom-of-page mini telemetry strip — 8 cells, instant snapshot. */
function TelemetryBar({
  record,
  online,
}: {
  record?: KomariRecord
  online: boolean
}) {
  const memPct = resolveRamPercent(record?.memory_used, record?.memory_total) ?? 0
  const diskPct =
    record?.disk_used != null && record?.disk_total
      ? (record.disk_used / record.disk_total) * 100
      : 0
  const cells: { label: string; value: string; color: string }[] = [
    {
      label: 'CPU',
      value: online ? `${(record?.cpu ?? 0).toFixed(0)}%` : '—',
      color: (record?.cpu ?? 0) > 80 ? 'var(--signal-warn)' : 'var(--fg-0)',
    },
    {
      label: 'MEM',
      value: online && record?.memory_total ? `${memPct.toFixed(0)}%` : '—',
      color: memPct > 80 ? 'var(--signal-warn)' : 'var(--fg-0)',
    },
    {
      label: 'DISK',
      value: online && record?.disk_total ? `${diskPct.toFixed(0)}%` : '—',
      color: diskPct > 80 ? 'var(--signal-warn)' : 'var(--fg-0)',
    },
    {
      label: 'NET ↑',
      value: online ? formatBps(record?.network_tx ?? 0) : '—',
      color: 'var(--signal-good)',
    },
    {
      label: 'NET ↓',
      value: online ? formatBps(record?.network_rx ?? 0) : '—',
      color: 'var(--signal-info)',
    },
    {
      label: 'PING',
      value: online && record?.ping != null ? `${record.ping.toFixed(0)}ms` : '—',
      color: 'var(--accent-bright)',
    },
    {
      label: 'LOSS',
      value: online && record?.loss != null ? `${record.loss.toFixed(1)}%` : '—',
      color: (record?.loss ?? 0) > 1 ? 'var(--signal-warn)' : 'var(--fg-0)',
    },
    {
      label: 'PROC',
      value: online && record?.process != null ? String(record.process) : '—',
      color: 'var(--fg-0)',
    },
  ]

  // Mobile reflow: 8-cell strip is way too dense at 380px. Drop to 4 cols
  // on phones (auto-stacks to 4×2). The borderRight separator runs on every
  // column except those that are visually rightmost in the current row.
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(var(--telemetry-cols, 8), 1fr)',
        background: 'var(--bg-1)',
        border: '1px solid var(--edge-mid)',
        boxShadow: 'inset 0 1px 0 var(--edge-bright)',
      }}
      className="hub-telemetry-bar"
    >
      {cells.map((c, i) => (
        <div
          key={i}
          className="hub-telemetry-cell"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            // borderRight is set inline for desktop; on mobile (4 cols), CSS
            // overrides the right separator on the 4th cell of each row,
            // and adds a borderTop to the second row to tie it visually.
            fontFamily: 'var(--font-mono)',
            borderRight: i < 7 ? '1px solid var(--edge-engrave)' : 'none',
          }}
        >
          <span style={{ fontSize: 9, color: 'var(--fg-3)', letterSpacing: '0.18em' }}>
            {c.label}
          </span>
          <span
            style={{
              fontSize: 13,
              color: c.color,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {c.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────────────────────────── */

export function HubPage({
  uuid,
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
  const drawer = useMobileDrawer()
  // Live UTC clock for the command bar.
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Per-node history for the four charts — selectable time window. Mirrors
  // the WINDOWS spec used on NodeDetail so the same retention-aware
  // filtering applies here too.
  const [windowKey, setWindowKey] = useState<WindowKey>('1h')
  const retentionHours = getRecordRetentionHours(config)
  const availableWindows = useMemo(
    () => filterWindowsByRetention(WINDOWS, retentionHours),
    [retentionHours],
  )
  const activeWindowKey: WindowKey = availableWindows.some((w) => w.key === windowKey)
    ? windowKey
    : availableWindows[0].key
  const windowSpec = WINDOWS.find((w) => w.key === activeWindowKey) ?? WINDOWS[0]
  const HOURS = windowSpec.hours
  const BUCKETS = windowSpec.buckets

  const history = useNodeHistory(uuid, HOURS)
  const node = useMemo(() => nodes.find((n) => n.uuid === uuid), [nodes, uuid])
  const record = node ? records[node.uuid] : undefined
  const online = record?.online === true

  const windowMs = HOURS * 60 * 60 * 1000
  const buckets = useMemo(
    () => bucketLoadHistory(history.load, BUCKETS, windowMs),
    [history.load, BUCKETS, windowMs],
  )
  const bucketTimes = useMemo(() => {
    const start = Date.now() - windowMs
    const bucketMs = windowMs / BUCKETS
    return Array.from({ length: BUCKETS }, (_, i) =>
      Math.round(start + (i + 0.5) * bucketMs),
    )
  }, [windowMs, BUCKETS])

  const labels = node ? parseLabels(node.tags) : { raw: [] }

  // Ping series for chart 4 — current node to all its targets.
  const pingTargetsAgg = useMemo(
    () =>
      hasPingData(history.ping)
        ? aggregatePingByTarget(history.ping, BUCKETS, windowMs, 6)
        : [],
    [history.ping, BUCKETS, windowMs],
  )
  const pingSeries = useMemo(
    () => pingTargetsAgg.map((t) => ({ data: t.data, label: t.task.name })),
    [pingTargetsAgg],
  )

  // Latency-list summary: most recent value per target (not bucketed).
  const targetSummaries = useMemo(() => {
    const byTask = new Map<
      number,
      { name: string; values: number[]; total: number; lost: number }
    >()
    // Defensive — Komari can return null for tasks/records when a node has no
    // ping configuration. Guard against that before iterating.
    const tasks = Array.isArray(history.ping?.tasks) ? history.ping.tasks : []
    const records = Array.isArray(history.ping?.records) ? history.ping.records : []
    for (const task of tasks) {
      if (task?.id == null) continue
      byTask.set(task.id, { name: task.name ?? '—', values: [], total: 0, lost: 0 })
    }
    for (const r of records) {
      if (r?.task_id == null) continue
      const slot = byTask.get(r.task_id)
      if (!slot) continue
      slot.total += 1
      if (r.value > 0) slot.values.push(r.value)
      else slot.lost += 1
    }
    const out: { name: string; value: number; loss: number }[] = []
    for (const [, s] of byTask) {
      if (s.total === 0) continue
      const avg = s.values.length === 0 ? 0 : s.values.reduce((a, b) => a + b, 0) / s.values.length
      out.push({ name: s.name, value: avg, loss: s.total > 0 ? (s.lost / s.total) * 100 : 0 })
    }
    out.sort((a, b) => a.value - b.value)
    return out
  }, [history.ping])

  // Heartbeat 7d. Pulled separately at 7-day window so we don't disturb the
  // 1H load fetch above. `useNodeHistory` recomputes when hours changes.
  const heartbeat7d = useNodeHistory(uuid, 24 * 7)
  const heartbeatCells = useMemo(
    () => deriveHeartbeat7d(heartbeat7d.ping),
    [heartbeat7d.ping],
  )

  // Alerts derived from current state.
  const alerts = useMemo(
    () => (node ? deriveAlertsForNode(node, record) : []),
    [node, record],
  )

  // Global stats for the topbar.
  const globalOnline = useMemo(() => {
    let n = 0
    for (const x of nodes) if (records[x.uuid]?.online) n++
    return n
  }, [nodes, records])

  // Responsive layout — measure the inner content area and pick a column
  // strategy based on available width. The ratchet:
  //   ≥ 1500px → 3 cols (left identity / center charts / right alerts+heartbeat)
  //   1080..1500 → 2 cols up top (left / center) and the right group sinks
  //                to its own row below as a 3-card horizontal strip
  //   < 1080px (mobile/half-width) → fully stacked single column
  const [mainRef, mainWidth] = useElementWidth<HTMLDivElement>(1400)
  const layoutMode: 'wide' | 'mid' | 'narrow' =
    mainWidth >= 1500 ? 'wide' : mainWidth >= 1080 ? 'mid' : 'narrow'

  // Roster-load-vs-uuid-not-found discrimination (same pattern as NodeDetail).
  if (!node) {
    const stillLoading = nodes.length === 0
    return (
      <div
        style={{
          display: 'flex',
          background: 'var(--bg-0)',
          color: 'var(--fg-0)',
          fontFamily: 'var(--font-sans)',
          minHeight: '100vh',
        }}
      >
        <Sidebar active="hub" mobileOpen={drawer.open} onMobileClose={drawer.onClose} hubTargetUuid={hubTargetUuid} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Topbar
            title={siteName}
            subtitle={stillLoading ? 'LOADING PROBE …' : 'UNKNOWN PROBE'}
            theme={theme}
            onTheme={onTheme}
            online={globalOnline}
            total={nodes.length}
            lastUpdate={lastUpdate}
            conn={conn}
                      onMobileMenu={drawer.onOpen}
          />
          <main style={{ padding: 24 }}>
            <CardFrame title={stillLoading ? 'Loading hub …' : 'Node not found'} code="…">
              <div
                style={{
                  padding: '40px 16px',
                  textAlign: 'center',
                  color: 'var(--fg-3)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {stillLoading
                  ? 'WAITING FOR PROBE ROSTER …'
                  : `UUID ${uuid.slice(0, 8)} · NOT IN ROSTER`}
              </div>
            </CardFrame>
          </main>
          <Footer config={config} />
        </div>
      </div>
    )
  }

  const memPct = resolveRamPercent(record?.memory_used, record?.memory_total) ?? 0
  const diskPct =
    record?.disk_used != null && record?.disk_total
      ? (record.disk_used / record.disk_total) * 100
      : 0

  // The big resource gauge — combined CPU/MEM/DISK as a "system load" score.
  // We use the highest individual to pick the status color (a single hot
  // metric should already trip the warning). The four gauges below render
  // each metric separately, so we don't need a synthesized value.
  const resStatus: 'good' | 'warn' | 'bad' = !online
    ? 'bad'
    : Math.max(record?.cpu ?? 0, memPct, diskPct) > 85
      ? 'bad'
      : Math.max(record?.cpu ?? 0, memPct, diskPct) > 65
        ? 'warn'
        : 'good'

  const subtitle = `${
    labels.raw.length > 0 ? labels.raw.map((l) => l.value).join(' · ') + ' · ' : ''
  }HUB · COCKPIT VIEW`
  const utcTime = new Date(now).toISOString().slice(11, 19) + ' UTC'

  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--bg-0)',
        color: 'var(--fg-0)',
        fontFamily: 'var(--font-sans)',
        minHeight: '100vh',
      }}
    >
      <Sidebar active="hub" mobileOpen={drawer.open} onMobileClose={drawer.onClose} hubTargetUuid={hubTargetUuid} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          title={siteName}
          subtitle={subtitle}
          theme={theme}
          onTheme={onTheme}
          online={globalOnline}
          total={nodes.length}
          lastUpdate={lastUpdate}
          conn={conn}
                  onMobileMenu={drawer.onOpen}
        />

        {/* Command bar — hostname / uuid / state / clock. The cockpit identity strip. */}
        <div
          className="hub-command-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap',
            padding: '10px 20px',
            background: 'var(--bg-1)',
            borderBottom: '1px solid var(--edge-mid)',
            boxShadow:
              'inset 0 1px 0 var(--edge-bright), inset 0 -1px 0 var(--edge-engrave)',
            flexShrink: 0,
          }}
        >
          {/* Status + hostname (clickable node switcher) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusDot
              status={online ? 'good' : 'bad'}
              size={10}
              pulse={online}
            />
            <NodeSwitcher
              current={node}
              nodes={nodes}
              records={records}
              targetRoute="hub"
            />
            {node.region && <SerialPlate>{node.region}</SerialPlate>}
            {node.group && <Etch>{node.group}</Etch>}
          </div>

          {/* Breadcrumb — flex-1 takes the remaining space on desktop;
              on mobile this wraps to its own row via the parent flex-wrap. */}
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fg-3)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: '1 1 200px',
              minWidth: 0,
            }}
          >
            UUID · {uuid}
          </div>

          {/* Live clock */}
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--accent-bright)',
              letterSpacing: '0.15em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {utcTime}
          </div>

          {/* Back to detail */}
          <a
            href={hashFor({ name: 'nodes', uuid })}
            title="返回标准详情"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              padding: '6px 12px',
              background: 'var(--bg-0)',
              color: 'var(--fg-2)',
              border: '1px solid var(--edge-engrave)',
              cursor: 'pointer',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            ← DETAIL
          </a>
        </div>

        <main
          ref={mainRef}
          style={{
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* Top zone: layout adapts to available width.
              wide  → 3 cols: identity | charts | alerts/heartbeat/ping
              mid   → 2 cols: identity | charts; right group becomes a strip below
              narrow → fully stacked single column */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                layoutMode === 'wide'
                  ? 'minmax(280px, 320px) minmax(0, 1fr) minmax(280px, 340px)'
                  : layoutMode === 'mid'
                    ? 'minmax(280px, 320px) minmax(0, 1fr)'
                    : '1fr',
              gap: 14,
              alignItems: 'flex-start',
            }}
          >
            {/* ── COL 1: identity + system + allocation ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <CardFrame title="System Identity" code="SYS · 01">
                <div style={{ padding: '4px 12px 10px' }}>
                  <InfoRow label="Host" value={node.name ?? '—'} />
                  <InfoRow label="IPv4" value={node.ip ?? '—'} />
                  <InfoRow label="Region" value={node.region ?? '—'} />
                  <InfoRow label="OS" value={record?.os || node.os || '—'} />
                  <InfoRow label="CPU" value={record?.cpu_model || node.cpu_model || '—'} />
                  <InfoRow
                    label="Cores"
                    value={node.cpu_cores != null ? `${node.cpu_cores} threads` : '—'}
                  />
                  <InfoRow label="Arch" value={node.arch ?? '—'} />
                  <InfoRow
                    label="Uptime"
                    value={online && record?.uptime != null ? formatUptime(record.uptime) : '—'}
                  />
                </div>
              </CardFrame>

              <CardFrame title="Allocation" code="ALC · 02">
                <div style={{ padding: '4px 12px 10px' }}>
                  <AllocationBar
                    label="Memory"
                    used={record?.memory_used}
                    total={record?.memory_total}
                  />
                  <AllocationBar
                    label="Disk"
                    used={record?.disk_used}
                    total={record?.disk_total}
                  />
                  <AllocationBar
                    label="Swap"
                    used={record?.swap_used}
                    total={record?.swap_total}
                  />
                </div>
              </CardFrame>

              <CardFrame title="Resources" code="RES · 03">
                <div
                  style={{
                    padding: '12px 8px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    placeItems: 'center',
                  }}
                >
                  <RadialGauge
                    value={online ? record?.cpu ?? 0 : 0}
                    size={108}
                    label="CPU"
                    unit="%"
                    status={resStatus}
                  />
                  <RadialGauge
                    value={online ? memPct : 0}
                    size={108}
                    label="MEM"
                    unit="%"
                    status={memPct > 85 ? 'bad' : memPct > 65 ? 'warn' : 'good'}
                  />
                  <RadialGauge
                    value={online ? diskPct : 0}
                    size={108}
                    label="DISK"
                    unit="%"
                    status={diskPct > 85 ? 'bad' : diskPct > 65 ? 'warn' : 'good'}
                  />
                  <RadialGauge
                    value={online ? record?.load1 ?? 0 : 0}
                    max={Math.max(8, (node.cpu_cores ?? 1) * 2)}
                    size={108}
                    label="LOAD"
                    unit=""
                    status={
                      (record?.load1 ?? 0) > (node.cpu_cores ?? 1) * 1.5
                        ? 'bad'
                        : (record?.load1 ?? 0) > (node.cpu_cores ?? 1)
                          ? 'warn'
                          : 'good'
                    }
                  />
                </div>
              </CardFrame>
            </div>

            {/* ── COL 2: 4 charts (CPU / MEM / NET / LATENCY) ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
              {/* Time window selector */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 8,
                  padding: '4px 2px',
                }}
              >
                <Etch>WINDOW</Etch>
                <Segmented
                  size="sm"
                  value={activeWindowKey}
                  onChange={(v) => setWindowKey(v as WindowKey)}
                  options={availableWindows.map((w) => ({ value: w.key, label: w.label }))}
                />
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                  gap: 14,
                }}
              >
                <CardFrame
                  title={`CPU · ${windowSpec.label}`}
                  code="C · 04"
                  action={
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color:
                          (record?.cpu ?? 0) > 80 ? 'var(--signal-warn)' : 'var(--accent-bright)',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {online ? `${(record?.cpu ?? 0).toFixed(0)}%` : '—'}
                    </span>
                  }
                >
                  <div style={{ padding: '8px 12px 12px' }}>
                    <AreaChart
                      data={buckets.cpu}
                      height={120}
                      times={bucketTimes}
                      formatValue={formatPctValue}
                      yMax={100}
                      threshold={80}
                    />
                  </div>
                </CardFrame>
                <CardFrame
                  title={`Memory · ${windowSpec.label}`}
                  code="C · 05"
                  action={
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: memPct > 80 ? 'var(--signal-warn)' : 'var(--accent-bright)',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {online ? `${memPct.toFixed(0)}%` : '—'}
                    </span>
                  }
                >
                  <div style={{ padding: '8px 12px 12px' }}>
                    <AreaChart
                      data={buckets.ram}
                      height={120}
                      times={bucketTimes}
                      formatValue={formatPctValue}
                      yMax={100}
                      threshold={80}
                    />
                  </div>
                </CardFrame>
                <CardFrame
                  title={`Net · ${windowSpec.label}`}
                  code="C · 06"
                  action={
                    online ? (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          color: 'var(--accent-bright)',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        ↓ {formatBps(record?.network_rx ?? 0)}
                      </span>
                    ) : null
                  }
                >
                  <div style={{ padding: '8px 12px 12px' }}>
                    <AreaChart
                      data={buckets.netIn}
                      height={120}
                      color="var(--signal-info)"
                      times={bucketTimes}
                      formatValue={(v) => formatBps(v)}
                      formatY={formatBytesAxis}
                      yMax={Math.max(1, ...buckets.netIn) * 1.2 || 1}
                    />
                  </div>
                </CardFrame>
                <CardFrame
                  title={`Latency · ${windowSpec.label}`}
                  code="C · 07"
                  action={
                    online && record?.ping != null ? (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          color: 'var(--accent-bright)',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {record.ping.toFixed(0)}ms
                      </span>
                    ) : null
                  }
                >
                  <div style={{ padding: '8px 12px 12px' }}>
                    {pingSeries.length > 0 ? (
                      <PingChart series={pingSeries} height={120} times={bucketTimes} />
                    ) : (
                      <div
                        style={{
                          height: 120,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--fg-3)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          letterSpacing: '0.16em',
                        }}
                      >
                        NO PING DATA
                      </div>
                    )}
                  </div>
                </CardFrame>
              </div>

              {/* Geographic Position — links out to the dedicated Map page.
                  Hub's slot is too small for a real map and the first inline
                  pass wasn't up to standard, so we redirect users to the
                  standalone view where the map can have proper space. */}
              <CardFrame title="Geographic Position" code="GEO · 08">
                <a
                  href="./map.html"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '32px 16px',
                    minHeight: 120,
                    background:
                      'repeating-linear-gradient(45deg, transparent, transparent 6px, var(--edge-engrave) 6px, var(--edge-engrave) 7px)',
                    color: 'inherit',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      'repeating-linear-gradient(45deg, var(--bg-1), var(--bg-1) 6px, var(--edge-engrave) 6px, var(--edge-engrave) 7px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      'repeating-linear-gradient(45deg, transparent, transparent 6px, var(--edge-engrave) 6px, var(--edge-engrave) 7px)'
                  }}
                  title="跳转到完整地图视图"
                >
                  <Etch>{node.region ?? '—'} · {labels.raw.find((l) => /[A-Z]{2}/.test(l.value))?.value ?? 'UNMAPPED'}</Etch>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--accent-bright)',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}
                  >
                    OPEN FULL MAP →
                  </span>
                  <Etch>独立页面 · GEO VIEW</Etch>
                </a>
              </CardFrame>
            </div>

            {/* ── COL 3: alerts + heartbeat + latency targets (only in wide mode) ── */}
            {layoutMode === 'wide' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <CardFrame
                  title="Recent Alerts"
                  code="ALT · 09"
                  action={
                    <StatusBadge
                      status={online ? 'good' : 'bad'}
                      label={online ? 'OK' : 'OFFLINE'}
                    />
                  }
                >
                  <AlertsList alerts={alerts} />
                </CardFrame>

                <CardFrame title="Heartbeat · 7d" code="HRT · 10">
                  <div style={{ padding: 12 }}>
                    <HeartbeatStrip cells={heartbeatCells} />
                  </div>
                </CardFrame>

                <CardFrame title="Ping Targets" code="LAT · 11">
                  <div style={{ padding: 12 }}>
                    <TargetLatencyList targets={targetSummaries} />
                  </div>
                </CardFrame>
              </div>
            )}
          </div>

          {/* mid/narrow: right group sinks below as its own row.
              mid → 3-card horizontal strip; narrow → single stacked column. */}
          {layoutMode !== 'wide' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  layoutMode === 'mid' ? 'repeat(3, minmax(0, 1fr))' : '1fr',
                gap: 14,
                alignItems: 'flex-start',
              }}
            >
              <CardFrame
                title="Recent Alerts"
                code="ALT · 09"
                action={
                  <StatusBadge
                    status={online ? 'good' : 'bad'}
                    label={online ? 'OK' : 'OFFLINE'}
                  />
                }
              >
                <AlertsList alerts={alerts} />
              </CardFrame>

              <CardFrame title="Heartbeat · 7d" code="HRT · 10">
                <div style={{ padding: 12 }}>
                  <HeartbeatStrip cells={heartbeatCells} />
                </div>
              </CardFrame>

              <CardFrame title="Ping Targets" code="LAT · 11">
                <div style={{ padding: 12 }}>
                  <TargetLatencyList targets={targetSummaries} />
                </div>
              </CardFrame>
            </div>
          )}

          {/* Bottom telemetry bar — instant snapshot */}
          <TelemetryBar record={record} online={online} />
        </main>

        <Footer config={config} />
      </div>
    </div>
  )
}
