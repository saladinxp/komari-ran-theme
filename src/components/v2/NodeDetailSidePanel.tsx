/**
 * NodeDetailSidePanel — inline right-side detail panel for the Nodes page.
 *
 * Differs from NodeDetailDrawer:
 *   - Drawer: full-screen overlay, used on mobile or for explicit "open"
 *   - SidePanel: sits inline next to the node grid, always visible on
 *                desktop, showing the currently-selected node's details
 *
 * If no node is selected, shows a quiet placeholder asking the user to
 * select a node.
 *
 * Content mirrors NodeDetailDrawer for consistency: header (name, region,
 * status dot), IP, region/group, CPU/RAM/DISK bars, TX/RX, latency/loss,
 * uptime/expiry, action footer.
 *
 * Width is fixed at ~300px so the panel stays predictable on the page —
 * callers shrink the main grid to make room.
 */

import { useState } from 'react'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { Etch } from '@/components/atoms/Etch'
import { contentFs } from '@/utils/fontScale'
import { ReadoutGrid } from '@/components/atoms/ReadoutGrid'
import {
  daysUntil,
  formatBps,
  formatBytes,
  resolveRamPercent,
} from '@/utils/format'
import { hashFor, navigate } from '@/router/route'

interface Props {
  node: KomariNode | null
  record?: KomariRecord
  /** Width of the panel in px (default 300) */
  width?: number
}

function fmtUptimeShort(seconds?: number): string {
  if (!seconds || seconds <= 0) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  if (d > 0) return `${d}d ${h}h`
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function fmtIsoDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function ProgressRow({
  label,
  pct,
  detail,
}: {
  label: string
  pct: number | undefined
  detail?: string
}) {
  const valid = typeof pct === 'number' && Number.isFinite(pct)
  const fillColor =
    valid && pct > 85
      ? 'var(--signal-bad)'
      : valid && pct > 60
        ? 'var(--signal-warn)'
        : 'var(--accent)'
  const displayPct = valid ? Math.min(100, Math.max(0, pct)).toFixed(0) : '—'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        // A compartment of the shared plate: it paints its own face so the
        // 1px seam between rows shows the frame colour through.
        background: 'var(--bg-2)',
        padding: '8px 10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <Etch>{label}</Etch>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(13),
            fontWeight: 500,
            color: 'var(--fg-0)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {displayPct}
          {valid && (
            <span style={{ fontSize: contentFs(10), color: 'var(--fg-2)' }}>
              %
            </span>
          )}
        </span>
      </div>
      <div
        style={{
          height: 5,
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
              boxShadow: `0 0 3px ${fillColor}`,
              transition: 'width 0.3s ease',
            }}
          />
        )}
      </div>
      {detail && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(9.5),
            color: 'var(--fg-3)',
          }}
        >
          {detail}
        </div>
      )}
    </div>
  )
}

function CopyableLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    if (!navigator?.clipboard?.writeText) return
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '5px 9px',
        background: 'var(--bg-inset)',
        border: '1px solid var(--edge-engrave)',
        borderRadius: 2,
        boxShadow: 'inset 0 1px 0 var(--edge-deep)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Etch>{label}</Etch>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(11),
            color: 'var(--fg-0)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {value || '—'}
        </span>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!value}
        style={{
          padding: '2px 6px',
          background: 'var(--bg-2)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 2,
          fontFamily: 'var(--font-mono)',
          fontSize: contentFs(8.5),
          letterSpacing: '0.14em',
          color: copied ? 'var(--signal-good)' : 'var(--fg-2)',
          cursor: value ? 'pointer' : 'not-allowed',
          flexShrink: 0,
        }}
      >
        {copied ? 'COPIED' : 'COPY'}
      </button>
    </div>
  )
}

export function NodeDetailSidePanel({ node, record, width = 300 }: Props) {
  if (!node) {
    return (
      <aside
        className="precision-card"
        style={{
          width,
          flexShrink: 0,
          padding: '40px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'flex-start',
          position: 'sticky',
          top: 12,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(11),
            color: 'var(--fg-3)',
            textAlign: 'center',
            letterSpacing: '0.06em',
            lineHeight: 1.6,
          }}
        >
          ▸ select a node to view details
        </div>
      </aside>
    )
  }

  const isOnline = !!record?.online
  const memPct = resolveRamPercent(record?.memory_used, record?.memory_total)
  const diskPct =
    record?.disk_used && record?.disk_total && record.disk_total > 0
      ? (record.disk_used / record.disk_total) * 100
      : undefined
  const daysToExpire = daysUntil(node.expired_at)
  const expColor =
    typeof daysToExpire === 'number'
      ? daysToExpire < 7
        ? 'var(--signal-bad)'
        : daysToExpire < 30
          ? 'var(--signal-warn)'
          : 'var(--fg-1)'
      : 'var(--fg-3)'

  const ip = (node as { ipv4?: string; ipv6?: string }).ipv4 ?? (node as { ip?: string }).ip ?? ''

  return (
    <aside
      className="precision-card"
      style={{
        width,
        flexShrink: 0,
        padding: 0,
        alignSelf: 'flex-start',
        position: 'sticky',
        top: 12,
        maxHeight: 'calc(100vh - 24px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--edge-engrave)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            marginBottom: 4,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isOnline ? 'var(--signal-good)' : 'var(--signal-bad)',
              boxShadow: isOnline ? '0 0 4px var(--signal-good)' : undefined,
              flexShrink: 0,
            }}
          />
          <h3
            style={{
              margin: 0,
              fontSize: contentFs(14),
              fontWeight: 600,
              color: 'var(--fg-0)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
              minWidth: 0,
            }}
          >
            {node.name ?? node.uuid.slice(0, 8)}
          </h3>
          {node.region && (
            <span
              style={{
                padding: '1px 5px',
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(8.5),
                letterSpacing: '0.12em',
                color: 'var(--accent-bright)',
                background: 'var(--bg-2)',
                border: '1px solid var(--edge-engrave)',
                borderRadius: 2,
                flexShrink: 0,
              }}
            >
              {node.region}
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(9.5),
            color: 'var(--fg-3)',
            letterSpacing: '0.04em',
          }}
        >
          {[
            node.os,
            node.cpu_cores ? `${node.cpu_cores}c` : null,
            record?.memory_total ? `${formatBytes(record.memory_total)}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </header>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {ip && <CopyableLine label="IP" value={ip} />}

        {(node.group || node.region) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {node.group && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  fontFamily: 'var(--font-mono)',
                  fontSize: contentFs(10),
                }}
              >
                <Etch>GROUP</Etch>
                <span style={{ color: 'var(--fg-1)' }}>{node.group}</span>
              </div>
            )}
            {node.region && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  fontFamily: 'var(--font-mono)',
                  fontSize: contentFs(10),
                }}
              >
                <Etch>REGION</Etch>
                <span style={{ color: 'var(--fg-1)' }}>{node.region}</span>
              </div>
            )}
          </div>
        )}

        {/* One recessed plate, subdivided by hairline seams — the same
            vocabulary as the readout cluster below. Three gauges floating
            with nothing but whitespace between them read as a list; enclosed
            in a shared frame they read as one instrument. */}
        <div
          style={{
            display: 'grid',
            gap: 1,
            background: 'var(--edge-engrave)',
            border: 'var(--hairline) solid var(--edge-engrave)',
            borderRadius: 'var(--radius-sm)',
            // Depth from shading, not from a darker fill — see ReadoutGrid.
            boxShadow: 'var(--shadow-inset)',
            overflow: 'hidden',
          }}
        >
          <ProgressRow
            label="CPU"
            pct={record?.cpu}
            detail={node.cpu_name ?? undefined}
          />
          <ProgressRow
            label="MEMORY"
            pct={memPct}
            detail={
              record?.memory_used !== undefined && record?.memory_total
                ? `${formatBytes(record.memory_used)} / ${formatBytes(record.memory_total)}`
                : undefined
            }
          />
          <ProgressRow
            label="DISK"
            pct={diskPct}
            detail={
              record?.disk_used !== undefined && record?.disk_total
                ? `${formatBytes(record.disk_used)} / ${formatBytes(record.disk_total)}`
                : undefined
            }
          />
        </div>

        {/* One 2x2 cluster instead of two loose grids — the four figures a
            reader actually scans together, framed together. */}
        <ReadoutGrid
          dense
          items={[
            {
              label: '↑ INBOUND',
              value: record?.network_tx ? formatBps(record.network_tx) : '—',
              color: 'var(--accent)',
            },
            {
              label: '↓ OUTBOUND',
              value: record?.network_rx ? formatBps(record.network_rx) : '—',
              color: 'var(--signal-good)',
            },
            {
              label: 'UPTIME',
              value: fmtUptimeShort(record?.uptime),
              color: 'var(--fg-1)',
            },
            {
              label: 'EXPIRES',
              value: (
                <>
                  {fmtIsoDate(node.expired_at)}{' '}
                  {typeof daysToExpire === 'number' && (
                    <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>({daysToExpire}d)</span>
                  )}
                </>
              ),
              color: expColor,
            },
          ]}
        />
      </div>

      {/* Footer */}
      <footer
        style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--edge-engrave)',
          background: 'var(--bg-2)',
          display: 'flex',
          gap: 6,
        }}
      >
        <button
          type="button"
          onClick={() => navigate({ name: 'hub', uuid: node.uuid })}
          style={{
            flex: 1,
            padding: '6px 8px',
            background: 'var(--accent)',
            border: '1px solid var(--accent)',
            borderRadius: 3,
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(9.5),
            letterSpacing: '0.12em',
            color: 'var(--bg-0)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          VIEW DETAILS →
        </button>
        <a
          href={`./index.html${hashFor({ name: 'nodes', uuid: node.uuid })}`}
          style={{
            padding: '6px 8px',
            background: 'var(--bg-1)',
            border: '1px solid var(--edge-engrave)',
            borderRadius: 3,
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(9.5),
            letterSpacing: '0.12em',
            color: 'var(--fg-1)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          FULL
        </a>
      </footer>
    </aside>
  )
}
