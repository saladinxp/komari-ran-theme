import { memo } from 'react'
/**
 * NodeCardCompactV2 — dense node card for the v2 redesign.
 *
 * Compared to NodeCardCompact (Classic), this is:
 *   - SHORTER: ~140px tall vs ~280px (no HP bar, no per-metric block meters)
 *   - DENSER:  inline progress bars instead of segmented block meters
 *   - LESS BUSY: drops cumulative bytes, latency/loss table, pings bar
 *
 * Layout (compact ~330px wide):
 *   ┌──────────────────────────────────────────────────┐
 *   │ ● 深圳无忧佛山      [CN] [国内]     20ms  ▮▮▮  │  ← header
 *   │   Debian · 96c · 4G RAM · 200G SSD                │  ← subtitle
 *   │  CPU ▰▰▰▰▱▱▱▱▱▱ 14%  RAM ▰▰▰▱▱▱ 38%  DSK ▰▰▱▱ 16% │  ← 3 inline bars
 *   │  ↓ 12.8 Mbps  ↑ 8.6 Mbps        ╱╲╱╲╲╱╲╱╲╱      │  ← traffic + sparkline
 *   │  UPTIME 185d  EXPIRE 2025-11-20 (72d)             │  ← uptime/expire
 *   └──────────────────────────────────────────────────┘
 *
 * Clicking the card calls `onClick(node.uuid)` so the consumer can open
 * NodeDetailDrawer. Drawer opening is NOT built-in — kept as a prop so
 * a different consumer (e.g. comparison mode) can intercept clicks.
 */

import type { KomariNode, KomariRecord, NodeStatus } from '@/types/komari'
import { Etch } from '@/components/atoms/Etch'
import { Sparkline } from '@/components/charts/Sparkline'
import { TrafficBar } from '@/components/atoms/TrafficBar'
import {
  daysUntil,
  formatBps,
  formatBytes,
  parseLabels,
  resolveRamPercent,
} from '@/utils/format'
import { contentFs } from '@/utils/fontScale'
import { computeTrafficQuota } from '@/utils/traffic'

interface Props {
  node: KomariNode
  record?: KomariRecord
  /** Network sparkline data (e.g. last 30s combined throughput) */
  netSpark?: number[]
  /** Click handler — typically opens NodeDetailDrawer */
  onClick?: (uuid: string) => void
  /** True when this card is in a "selected/highlighted" state */
  selected?: boolean
}

const COLOR_BY_STATUS: Record<NodeStatus, string> = {
  good: 'var(--signal-good)',
  warn: 'var(--signal-warn)',
  bad: 'var(--signal-bad)',
}

function deriveStatus(r?: KomariRecord): NodeStatus {
  if (!r || r.online === false) return 'bad'
  if ((r.cpu ?? 0) > 80 || (r.loss ?? 0) > 5) return 'warn'
  return 'good'
}

/** Pick a fill color based on usage percent. */
function pctColor(pct: number | undefined): string {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return 'var(--accent)'
  if (pct > 85) return 'var(--signal-bad)'
  if (pct > 60) return 'var(--signal-warn)'
  return 'var(--accent)'
}

/** Inline progress bar — used for CPU/MEM/DISK row. */
function InlineProgress({
  label,
  pct,
  color,
}: {
  label: string
  pct: number | undefined
  color?: string
}) {
  const valid = typeof pct === 'number' && Number.isFinite(pct)
  const fillColor = color ?? pctColor(pct)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 4,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(9),
            letterSpacing: '0.1em',
            color: 'var(--fg-3)',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
            fontSize: contentFs(11),
            fontWeight: 500,
            color: 'var(--fg-0)',
          }}
        >
          {valid ? `${Math.round(pct)}%` : '—'}
        </span>
      </div>
      <div
        style={{
          height: 4,
          background: 'var(--bg-inset)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 1,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'inset 0 1px 1px var(--edge-deep)',
        }}
      >
        {valid && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${Math.min(100, Math.max(0, pct))}%`,
              background: fillColor,
              boxShadow: `0 0 2px ${fillColor}`,
              transition: 'width 0.3s ease',
            }}
          />
        )}
      </div>
    </div>
  )
}

function fmtExpiry(expISO?: string): { date: string; days: string; color: string } {
  if (!expISO) return { date: '—', days: '', color: 'var(--fg-3)' }
  const d = new Date(expISO)
  if (Number.isNaN(d.getTime())) return { date: '—', days: '', color: 'var(--fg-3)' }
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const dt = daysUntil(expISO)
  let color = 'var(--fg-1)'
  if (typeof dt === 'number') {
    if (dt < 7) color = 'var(--signal-bad)'
    else if (dt < 30) color = 'var(--signal-warn)'
  }
  return {
    date: `${y}-${mo}-${day}`,
    days: typeof dt === 'number' ? `(${dt}d)` : '',
    color,
  }
}

function fmtUptime(seconds?: number): string {
  if (!seconds || seconds <= 0) return '—'
  const d = Math.floor(seconds / 86400)
  if (d > 0) return `${d}d`
  const h = Math.floor(seconds / 3600)
  return `${h}h`
}

function NodeCardCompactV2_({
  node,
  record,
  netSpark,
  onClick,
  selected,
}: Props) {
  const status = deriveStatus(record)
  const dotColor = COLOR_BY_STATUS[status]
  const isOnline = record?.online !== false

  const memPct = resolveRamPercent(record?.memory_used, record?.memory_total)
  const diskPct =
    record?.disk_used && record?.disk_total && record.disk_total > 0
      ? (record.disk_used / record.disk_total) * 100
      : undefined

  const labels = parseLabels(node.tags)
  const quota = computeTrafficQuota(node, record)
  const expiry = fmtExpiry(node.expired_at)

  // Subtitle: OS · cores · RAM · disk (best effort)
  const subtitleParts: string[] = []
  if (node.os) {
    // Strip "GNU/Linux" and version suffix for compactness
    const cleanOs = node.os.replace(/^[A-Za-z]+/, (s) => s).split(' ')[0]
    subtitleParts.push(cleanOs || node.os)
  }
  if (node.cpu_cores) subtitleParts.push(`${node.cpu_cores}c`)
  if (record?.memory_total)
    subtitleParts.push(`${formatBytes(record.memory_total)} RAM`)
  if (record?.disk_total)
    subtitleParts.push(`${formatBytes(record.disk_total)} SSD`)

  const handleClick = () => {
    if (onClick) onClick(node.uuid)
  }

  return (
    <div
      role="button"
      tabIndex={onClick ? 0 : -1}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          handleClick()
        }
      }}
      className="precision-card"
      style={{
        padding: '11px 13px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        cursor: onClick ? 'pointer' : 'default',
        opacity: isOnline ? 1 : 0.6,
        outline: selected ? '1px solid var(--accent)' : 'none',
        outlineOffset: selected ? -1 : 0,
        transition: 'background 0.12s',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (onClick)
          (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-2)'
      }}
      onMouseLeave={(e) => {
        if (onClick)
          (e.currentTarget as HTMLDivElement).style.background = ''
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: dotColor,
              boxShadow: status === 'good' ? `0 0 4px ${dotColor}` : undefined,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: contentFs(13),
              fontWeight: 600,
              color: 'var(--fg-0)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
          >
            {node.name ?? node.uuid.slice(0, 8)}
          </span>
          {node.region && (
            <span
              style={{
                padding: '1px 4px',
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(8.5),
                letterSpacing: '0.1em',
                color: 'var(--accent-bright)',
                border: '1px solid var(--edge-engrave)',
                borderRadius: 1,
                flexShrink: 0,
              }}
            >
              {node.region}
            </span>
          )}
          {node.group && (
            <span
              style={{
                padding: '1px 4px',
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(8.5),
                letterSpacing: '0.1em',
                color: 'var(--fg-3)',
                border: '1px solid var(--edge-engrave)',
                borderRadius: 1,
                flexShrink: 0,
              }}
            >
              {node.group}
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(10),
            color:
              typeof record?.ping === 'number' && record.ping > 200
                ? 'var(--signal-warn)'
                : 'var(--fg-2)',
          }}
        >
          {isOnline && typeof record?.ping === 'number' && record.ping > 0
            ? `${Math.round(record.ping)}ms`
            : isOnline
              ? ''
              : 'OFFLINE'}
        </div>
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: contentFs(9.5),
          color: 'var(--fg-3)',
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {subtitleParts.join(' · ') || '—'}
      </div>

      {/* CPU / MEM / DISK row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 10,
          marginTop: 1,
        }}
      >
        <InlineProgress label="CPU" pct={record?.cpu} />
        <InlineProgress label="RAM" pct={memPct} />
        <InlineProgress label="DISK" pct={diskPct} />
      </div>

      {/* Network row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginTop: 3,
          paddingTop: 7,
          borderTop: '1px solid var(--edge-engrave)',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'baseline',
            fontFamily: 'var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
            fontSize: contentFs(11),
          }}
        >
          <span style={{ color: 'var(--signal-good)' }}>
            ↓ {record?.network_rx ? formatBps(record.network_rx) : '—'}
          </span>
          <span style={{ color: 'var(--accent)' }}>
            ↑ {record?.network_tx ? formatBps(record.network_tx) : '—'}
          </span>
        </div>
        {netSpark && netSpark.length > 0 && (
          <div style={{ width: 70, height: 14, flexShrink: 0 }}>
            <Sparkline
              data={netSpark}
              color="var(--signal-good)"
              height={14}
              responsive
            />
          </div>
        )}
      </div>

      {/* traffic quota — only when the admin set a threshold (0 = unlimited) */}
      {quota && <TrafficBar quota={quota} variant="compact" />}

      {/* Uptime / Expire row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontFamily: 'var(--font-mono)',
          fontSize: contentFs(10),
          letterSpacing: '0.04em',
        }}
      >
        <span style={{ color: 'var(--fg-3)' }}>
          <Etch>UPTIME</Etch>{' '}
          <span style={{ color: 'var(--fg-1)' }}>
            {fmtUptime(record?.uptime)}
          </span>
        </span>
        <span>
          <Etch>EXPIRE</Etch>{' '}
          <span style={{ color: expiry.color, fontWeight: 500 }}>
            {expiry.date}
          </span>{' '}
          <span style={{ color: 'var(--fg-3)' }}>{expiry.days}</span>
        </span>
      </div>

      {/* Bandwidth/traffic labels (if present) */}
      {labels.bandwidth && (
        <div
          style={{
            display: 'flex',
            gap: 5,
            flexWrap: 'wrap',
            marginTop: 1,
          }}
        >
          {labels.bandwidth && (
            <span
              style={{
                padding: '1px 5px',
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(8.5),
                letterSpacing: '0.1em',
                color: labels.bandwidth.color
                  ? `var(--label-${labels.bandwidth.color}, var(--info))`
                  : 'var(--info)',
                background: 'rgba(58,93,143,0.06)',
                border: '1px solid var(--edge-engrave)',
                borderRadius: 1,
              }}
            >
              {labels.bandwidth.value}
            </span>
          )}
          {labels.traffic && (
            <span
              style={{
                padding: '1px 5px',
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(8.5),
                letterSpacing: '0.1em',
                color: 'var(--accent-bright)',
                background: 'rgba(160,104,32,0.06)',
                border: '1px solid var(--edge-engrave)',
                borderRadius: 1,
              }}
            >
              {labels.traffic.value}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export const NodeCardCompactV2 = memo(NodeCardCompactV2_)
