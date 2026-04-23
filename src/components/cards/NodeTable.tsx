import { Etch } from '@/components/atoms/Etch'
import { StatusDot } from '@/components/atoms/StatusDot'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { resolveRamPercent, formatBps, daysUntil } from '@/utils/format'
import { hashFor } from '@/router/route'

export type SortKey =
  | 'name'
  | 'region'
  | 'cpu'
  | 'mem'
  | 'disk'
  | 'load'
  | 'net'
  | 'expire'

export type SortDir = 'asc' | 'desc'

interface ColumnSpec {
  key: SortKey | null
  label: string
  width: string
  align?: 'left' | 'right' | 'center'
  /** Default sort direction when this column is first activated. */
  defaultDir?: SortDir
}

/**
 * Column layout — the grid template is shared between the header and every row,
 * so columns stay aligned no matter what's in them. Widths are designed for
 * a min container width of ~960px; the wrapper enables horizontal scrolling
 * below that.
 */
const COLUMNS: ColumnSpec[] = [
  { key: null, label: '', width: '14px' }, // status dot
  { key: 'name', label: 'NAME', width: 'minmax(180px, 1fr)' },
  { key: 'region', label: 'REGION', width: '80px' },
  { key: null, label: 'OS', width: '78px' },
  { key: 'cpu', label: 'CPU', width: '56px', align: 'right', defaultDir: 'desc' },
  { key: 'mem', label: 'MEM', width: '56px', align: 'right', defaultDir: 'desc' },
  { key: 'disk', label: 'DISK', width: '56px', align: 'right', defaultDir: 'desc' },
  { key: 'load', label: 'LOAD', width: '54px', align: 'right', defaultDir: 'desc' },
  { key: 'net', label: 'NET ↑↓', width: '128px', align: 'right', defaultDir: 'desc' },
  { key: null, label: 'UPTIME', width: '76px', align: 'right' },
  { key: 'expire', label: 'EXPIRE', width: '64px', align: 'right', defaultDir: 'asc' },
]

const GRID_TEMPLATE = COLUMNS.map((c) => c.width).join(' ')

/** Short OS label — strips kernel/version noise, keeps the family. */
function shortOS(os?: string): string {
  if (!os) return '—'
  const lower = os.toLowerCase()
  if (lower.includes('debian')) return 'Debian'
  if (lower.includes('ubuntu')) return 'Ubuntu'
  if (lower.includes('alpine')) return 'Alpine'
  if (lower.includes('arch')) return 'Arch'
  if (lower.includes('centos')) return 'CentOS'
  if (lower.includes('rocky')) return 'Rocky'
  if (lower.includes('alma')) return 'Alma'
  if (lower.includes('fedora')) return 'Fedora'
  if (lower.includes('rhel') || lower.includes('red hat')) return 'RHEL'
  if (lower.includes('opensuse') || lower.includes('suse')) return 'SUSE'
  if (lower.includes('gentoo')) return 'Gentoo'
  if (lower.includes('nixos')) return 'NixOS'
  if (lower.includes('darwin') || lower.includes('mac')) return 'macOS'
  if (lower.includes('windows')) return 'Windows'
  if (lower.includes('freebsd')) return 'FreeBSD'
  if (lower.includes('openbsd')) return 'OpenBSD'
  if (lower.includes('linux')) return 'Linux'
  // Last resort — first word, capitalized
  const first = os.split(/[\s\-_/]+/)[0] ?? ''
  return first.length > 10 ? first.slice(0, 10) : first
}

/** Compact uptime — '12d 03h' or '4h 12m' or '8m'. */
function shortUptime(uptimeSec?: number): string {
  if (uptimeSec == null || !Number.isFinite(uptimeSec) || uptimeSec < 0) return '—'
  const s = Math.floor(uptimeSec)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h.toString().padStart(2, '0')}h`
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m}m`
}

/** Choose color for a 0..100 percentage cell. */
function pctColor(pct: number): string {
  if (pct >= 85) return 'var(--signal-bad)'
  if (pct >= 65) return 'var(--signal-warn)'
  return 'var(--fg-1)'
}

/** Color for days-until-expiry — undefined = no billing, render dim. */
function expireColor(days: number | undefined): string {
  if (days == null) return 'var(--fg-3)'
  if (days <= 7) return 'var(--signal-bad)'
  if (days <= 30) return 'var(--signal-warn)'
  return 'var(--fg-1)'
}

interface HeaderCellProps {
  col: ColumnSpec
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
}

function HeaderCell({ col, sortKey, sortDir, onSort }: HeaderCellProps) {
  const sortable = col.key != null
  const active = sortable && col.key === sortKey
  const arrow = !active ? '' : sortDir === 'asc' ? ' ▲' : ' ▼'

  const baseStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    color: active ? 'var(--accent-bright)' : 'var(--fg-3)',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    textAlign: col.align ?? 'left',
    padding: '8px 6px',
    cursor: sortable ? 'pointer' : 'default',
    userSelect: 'none',
    background: 'transparent',
    border: 'none',
    display: 'block',
    width: '100%',
  }

  if (!sortable) {
    return <span style={baseStyle}>{col.label}</span>
  }
  return (
    <button
      type="button"
      style={baseStyle}
      onClick={() => onSort(col.key!)}
      title={`按 ${col.label} 排序`}
    >
      {col.label}
      {arrow}
    </button>
  )
}

interface NodeRowProps {
  node: KomariNode
  record?: KomariRecord
}

function NodeRow({ node, record }: NodeRowProps) {
  const online = record?.online === true
  const cpu = record?.cpu ?? 0
  const memPct = resolveRamPercent(record?.memory_used, record?.memory_total) ?? 0
  const diskPct =
    record?.disk_used != null && record?.disk_total
      ? (record.disk_used / record.disk_total) * 100
      : 0
  const load = record?.load1 ?? 0
  const tx = record?.network_tx ?? 0
  const rx = record?.network_rx ?? 0
  const dim: React.CSSProperties = online ? {} : { opacity: 0.45 }

  const status: 'good' | 'warn' | 'bad' = !online
    ? 'bad'
    : cpu > 80 || memPct > 90
      ? 'warn'
      : 'good'

  const expDays = node.expired_at ? daysUntil(node.expired_at) : undefined

  const cellBase: React.CSSProperties = {
    padding: '0 6px',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--fg-1)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
  }
  const numCell = (color: string): React.CSSProperties => ({
    ...cellBase,
    color,
    justifyContent: 'flex-end',
    fontVariantNumeric: 'tabular-nums',
  })

  return (
    <a
      href={hashFor({ name: 'nodes', uuid: node.uuid })}
      style={{
        display: 'grid',
        gridTemplateColumns: GRID_TEMPLATE,
        alignItems: 'center',
        height: 30,
        textDecoration: 'none',
        color: 'inherit',
        borderBottom: '1px solid var(--edge-engrave)',
        transition: 'background 0.08s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {/* Status dot */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        <StatusDot status={status} size={6} pulse={status === 'good'} />
      </div>

      {/* Name */}
      <div
        style={{
          ...cellBase,
          color: 'var(--fg-0)',
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: 12,
          gap: 8,
          ...dim,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {node.name ?? node.uuid.slice(0, 8)}
        </span>
        {node.group && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--fg-3)',
              letterSpacing: '0.1em',
              padding: '1px 5px',
              border: '1px solid var(--edge-engrave)',
              flexShrink: 0,
            }}
          >
            {node.group}
          </span>
        )}
      </div>

      {/* Region */}
      <div style={{ ...cellBase, color: 'var(--accent-bright)', fontSize: 10, ...dim }}>
        {node.region ?? '—'}
      </div>

      {/* OS */}
      <div style={{ ...cellBase, color: 'var(--fg-2)', fontSize: 10, ...dim }}>
        {shortOS(record?.os || node.os)}
      </div>

      {/* CPU */}
      <div style={{ ...numCell(online ? pctColor(cpu) : 'var(--fg-3)'), ...dim }}>
        {online ? `${cpu.toFixed(0)}%` : '—'}
      </div>

      {/* MEM */}
      <div style={{ ...numCell(online ? pctColor(memPct) : 'var(--fg-3)'), ...dim }}>
        {online && record?.memory_total ? `${memPct.toFixed(0)}%` : '—'}
      </div>

      {/* DISK */}
      <div style={{ ...numCell(online ? pctColor(diskPct) : 'var(--fg-3)'), ...dim }}>
        {online && record?.disk_total ? `${diskPct.toFixed(0)}%` : '—'}
      </div>

      {/* LOAD */}
      <div style={{ ...numCell(online ? 'var(--fg-1)' : 'var(--fg-3)'), ...dim }}>
        {online ? load.toFixed(2) : '—'}
      </div>

      {/* NET ↑↓ */}
      <div style={{ ...numCell(online ? 'var(--fg-1)' : 'var(--fg-3)'), gap: 6, ...dim }}>
        {online ? (
          <>
            <span style={{ color: 'var(--signal-good)' }}>{formatBps(tx)}</span>
            <span style={{ color: 'var(--fg-3)' }}>/</span>
            <span style={{ color: 'var(--signal-info)' }}>{formatBps(rx)}</span>
          </>
        ) : (
          '—'
        )}
      </div>

      {/* Uptime */}
      <div style={{ ...numCell(online ? 'var(--fg-1)' : 'var(--fg-3)'), ...dim }}>
        {online ? shortUptime(record?.uptime) : '—'}
      </div>

      {/* Expire */}
      <div style={{ ...numCell(expireColor(expDays)) }}>
        {expDays == null ? '—' : `${expDays}d`}
      </div>
    </a>
  )
}

interface NodeTableProps {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
}

/**
 * NodeTable — high-density tabular view of all nodes.
 *
 * 11 columns, 30px row height. Click column header to sort (toggles direction
 * if you click the same column twice). Click a row to open NodeDetail.
 *
 * Designed to fit ~30 nodes on a single laptop screen without scrolling.
 */
export function NodeTable({ nodes, records, sortKey, sortDir, onSort }: NodeTableProps) {
  return (
    <div
      style={{
        border: '1px solid var(--edge-engrave)',
        background: 'var(--bg-0)',
        boxShadow:
          'inset 0 1px 0 var(--edge-bright), inset 0 -1px 0 var(--edge-engrave)',
        overflowX: 'auto',
      }}
    >
      <div style={{ minWidth: 920 }}>
        {/* Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_TEMPLATE,
            alignItems: 'center',
            background: 'var(--bg-1)',
            borderBottom: '1px solid var(--edge-mid)',
          }}
        >
          {COLUMNS.map((col, i) => (
            <HeaderCell
              key={i}
              col={col}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
          ))}
        </div>

        {/* Rows */}
        {nodes.map((n) => (
          <NodeRow key={n.uuid} node={n} record={records[n.uuid]} />
        ))}
      </div>
    </div>
  )
}
