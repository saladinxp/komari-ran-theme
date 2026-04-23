import { Etch } from '@/components/atoms/Etch'
import { StatusDot } from '@/components/atoms/StatusDot'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { resolveRamPercent, formatBps, daysUntil } from '@/utils/format'
import { hashFor } from '@/router/route'

export type SortKey = 'name' | 'region' | 'cpu' | 'mem' | 'disk' | 'load' | 'net' | 'expire'
export type SortDir = 'asc' | 'desc'

const SORT_OPTIONS: { key: SortKey; label: string; defaultDir: SortDir }[] = [
  { key: 'name', label: 'NAME', defaultDir: 'asc' },
  { key: 'region', label: 'REGION', defaultDir: 'asc' },
  { key: 'cpu', label: 'CPU', defaultDir: 'desc' },
  { key: 'mem', label: 'MEM', defaultDir: 'desc' },
  { key: 'disk', label: 'DISK', defaultDir: 'desc' },
  { key: 'load', label: 'LOAD', defaultDir: 'desc' },
  { key: 'net', label: 'NET', defaultDir: 'desc' },
  { key: 'expire', label: 'EXPIRE', defaultDir: 'asc' },
]

/** Short OS label — strips kernel/version noise, keeps the family. */
function shortOS(os?: string): string {
  if (!os) return ''
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
  if (lower.includes('darwin') || lower.includes('mac')) return 'macOS'
  if (lower.includes('windows')) return 'Windows'
  if (lower.includes('freebsd')) return 'FreeBSD'
  if (lower.includes('linux')) return 'Linux'
  const first = os.split(/[\s\-_/]+/)[0] ?? ''
  return first.length > 10 ? first.slice(0, 10) : first
}

/** Compact uptime — '12d' or '4h' or '8m'. */
function shortUptime(uptimeSec?: number): string {
  if (uptimeSec == null || !Number.isFinite(uptimeSec) || uptimeSec < 0) return '—'
  const s = Math.floor(uptimeSec)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d`
  if (h > 0) return `${h}h`
  return `${m}m`
}

/** Compact bandwidth — strips fractional zero, returns "1.2K" "892" "3.4M" style. */
function compactBps(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return '0'
  if (bps < 1000) return `${Math.round(bps)}`
  if (bps < 1_000_000) {
    const v = bps / 1000
    return v >= 100 ? `${Math.round(v)}K` : `${v.toFixed(1).replace(/\.0$/, '')}K`
  }
  if (bps < 1_000_000_000) {
    const v = bps / 1_000_000
    return v >= 100 ? `${Math.round(v)}M` : `${v.toFixed(1).replace(/\.0$/, '')}M`
  }
  const v = bps / 1_000_000_000
  return `${v.toFixed(1).replace(/\.0$/, '')}G`
}

function pctColor(pct: number): string {
  if (pct >= 85) return 'var(--signal-bad)'
  if (pct >= 65) return 'var(--signal-warn)'
  return 'var(--accent)'
}

function expireColor(days: number | undefined): string {
  if (days == null) return 'var(--fg-3)'
  if (days <= 7) return 'var(--signal-bad)'
  if (days <= 30) return 'var(--signal-warn)'
  return 'var(--fg-2)'
}

/** A tight horizontal mini bar — just 18 px tall, label/value on the same row. */
function MiniBar({
  label,
  value,
  online,
}: {
  label: string
  value: number
  online: boolean
}) {
  const pct = Math.max(0, Math.min(100, value))
  const color = online ? pctColor(pct) : 'var(--fg-3)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)' }}>
      <span
        style={{
          fontSize: 8.5,
          color: 'var(--fg-3)',
          letterSpacing: '0.1em',
          width: 26,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
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
            boxShadow: online && pct > 0 ? `0 0 3px ${color}` : 'none',
          }}
        />
      </div>
      <span
        style={{
          fontSize: 10,
          color: online ? 'var(--fg-1)' : 'var(--fg-3)',
          fontVariantNumeric: 'tabular-nums',
          minWidth: 28,
          textAlign: 'right',
          fontWeight: 500,
        }}
      >
        {online ? `${pct.toFixed(0)}%` : '—'}
      </span>
    </div>
  )
}

interface NodeCardSlimProps {
  node: KomariNode
  record?: KomariRecord
}

/**
 * NodeCardSlim — the compact-grid card. Roughly 96px tall.
 *
 * Layout (single card):
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │ ●  name              REGION  GROUP        ↑ 1.2K / ↓ 3.4M       12d  │
 *   │    Debian · 16C                            LOAD 0.84   UP · EXP      │
 *   │                                                                      │
 *   │   CPU ▓▓▓▓▓░░░ 52%   MEM ▓▓▓▓▓▓░░ 66%   DISK ▓▓░░░░░░ 28%           │
 *   └──────────────────────────────────────────────────────────────────────┘
 */
function NodeCardSlim({ node, record }: NodeCardSlimProps) {
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
  const expDays = node.expired_at ? daysUntil(node.expired_at) : undefined

  const status: 'good' | 'warn' | 'bad' = !online
    ? 'bad'
    : cpu > 80 || memPct > 90
      ? 'warn'
      : 'good'

  const accentBar: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    background:
      status === 'bad'
        ? 'var(--signal-bad)'
        : status === 'warn'
          ? 'var(--signal-warn)'
          : 'var(--accent)',
    boxShadow:
      status === 'good' ? '0 0 6px var(--accent)' : 'none',
  }

  return (
    <a
      href={hashFor({ name: 'nodes', uuid: node.uuid })}
      style={{
        position: 'relative',
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        background: 'var(--bg-1)',
        border: '1px solid var(--edge-engrave)',
        boxShadow:
          'inset 0 1px 0 var(--edge-bright), inset 0 -1px 0 var(--edge-engrave)',
        padding: '10px 14px 10px 16px',
        opacity: online ? 1 : 0.55,
        transition: 'transform 0.08s ease, border-color 0.08s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--edge-mid)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--edge-engrave)'
      }}
    >
      <div style={accentBar} />

      {/* Top row: identity (left) + net/load (right) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 8,
        }}
      >
        {/* Identity */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0, flex: 1 }}>
          <div style={{ paddingTop: 4, flexShrink: 0 }}>
            <StatusDot status={status} size={7} pulse={status === 'good'} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--fg-0)',
                  letterSpacing: '-0.01em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={node.name ?? node.uuid}
              >
                {node.name ?? node.uuid.slice(0, 8)}
              </span>
              {node.region && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 8.5,
                    color: 'var(--accent-bright)',
                    letterSpacing: '0.1em',
                    padding: '1px 5px',
                    border: '1px solid var(--edge-engrave)',
                    flexShrink: 0,
                  }}
                >
                  {node.region}
                </span>
              )}
              {node.group && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 8.5,
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
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9.5,
                color: 'var(--fg-3)',
                letterSpacing: '0.05em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {[
                shortOS(record?.os || node.os),
                node.cpu_cores ? `${node.cpu_cores}C` : null,
                online ? `LOAD ${load.toFixed(2)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
        </div>

        {/* Right cluster: NET + uptime/expire */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 2,
            flexShrink: 0,
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div style={{ display: 'flex', gap: 6, fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
            {online ? (
              <>
                <span style={{ color: 'var(--signal-good)' }}>
                  ↑{compactBps(tx)}
                </span>
                <span style={{ color: 'var(--signal-info)' }}>
                  ↓{compactBps(rx)}
                </span>
              </>
            ) : (
              <span style={{ color: 'var(--fg-3)' }}>OFFLINE</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, fontSize: 9, color: 'var(--fg-3)' }}>
            {online && (
              <span title="uptime" style={{ fontVariantNumeric: 'tabular-nums' }}>
                UP {shortUptime(record?.uptime)}
              </span>
            )}
            {expDays != null && (
              <span
                style={{
                  color: expireColor(expDays),
                  fontWeight: expDays <= 30 ? 600 : 400,
                  fontVariantNumeric: 'tabular-nums',
                }}
                title="天数到期"
              >
                · EXP {expDays}d
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: 3 mini bars in 3 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <MiniBar label="CPU" value={cpu} online={online} />
        <MiniBar label="MEM" value={memPct} online={online && record?.memory_total != null} />
        <MiniBar label="DISK" value={diskPct} online={online && record?.disk_total != null} />
      </div>
    </a>
  )
}

interface SortBarProps {
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
}

/**
 * SortBar — a thin row of sort chips above the card grid. Replaces what
 * used to be a column header. Click a chip to sort by it; click the active
 * chip again to flip direction.
 */
function SortBar({ sortKey, sortDir, onSort }: SortBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        background: 'var(--bg-1)',
        border: '1px solid var(--edge-engrave)',
        borderBottom: 'none',
        boxShadow: 'inset 0 1px 0 var(--edge-bright)',
      }}
    >
      <Etch>SORT</Etch>
      {SORT_OPTIONS.map((opt) => {
        const active = opt.key === sortKey
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onSort(opt.key)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              padding: '4px 8px',
              background: active ? 'var(--bg-0)' : 'transparent',
              color: active ? 'var(--accent-bright)' : 'var(--fg-2)',
              border: '1px solid',
              borderColor: active ? 'var(--accent)' : 'var(--edge-engrave)',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {opt.label}
            {active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
          </button>
        )
      })}
    </div>
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
 * NodeTable — a compact card grid. Despite the name (kept for backwards
 * compat with the page that imports it), this is no longer a tabular layout.
 *
 * It's a 2-column grid (responsive — drops to 1 column on narrow screens,
 * goes to 3 columns on very wide displays) of slim cards, with a sort-chip
 * bar floating above the grid.
 */
export function NodeTable({ nodes, records, sortKey, sortDir, onSort }: NodeTableProps) {
  return (
    <div>
      <SortBar sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
          gap: 8,
          marginTop: 8,
        }}
      >
        {nodes.map((n) => (
          <NodeCardSlim key={n.uuid} node={n} record={records[n.uuid]} />
        ))}
      </div>
    </div>
  )
}
