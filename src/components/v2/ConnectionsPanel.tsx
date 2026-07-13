import { memo } from 'react'
import { CardFrame } from '@/components/panels/CardFrame'
import { contentFs } from '@/utils/fontScale'

/**
 * ConnectionsPanel — TCP/UDP sockets and process count.
 *
 * Absolute numbers mean little across a fleet (a busy proxy and an idle relay
 * have nothing in common), so the history is coloured against the node's OWN
 * windowed mean. A count several times its own baseline is what matters: the
 * first visible sign of a port scan, a connection leak, or a flood.
 */
function fmtCount(v?: number): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Math.round(v).toLocaleString('en-US')
}

function ConnectionsPanel_({
  tcp,
  udp,
  proc,
  tcpNow,
  udpNow,
  procNow,
  tcpMean,
  code = 'CON · 10',
  windowLabel,
}: {
  tcp: number[]
  udp: number[]
  proc: number[]
  tcpNow?: number
  udpNow?: number
  procNow?: number
  tcpMean?: number
  code?: string
  windowLabel?: string
}) {
  const peak = tcp.length > 0 ? Math.max(...tcp) : 0
  const spike = tcpMean != null && tcpMean > 0 && tcpNow != null ? tcpNow / tcpMean : undefined

  const readout = (label: string, value: string) => (
    <div className="precision-inset" style={{ flex: 1, padding: '7px 9px', minWidth: 0 }}>
      <div
        style={{
          fontSize: contentFs(8),
          color: 'var(--fg-3)',
          letterSpacing: '0.1em',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {label}
      </div>
      <div
        className="mono tnum"
        style={{
          fontSize: contentFs(15),
          fontWeight: 600,
          marginTop: 1,
          color: 'var(--fg-0)',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  )

  return (
    <CardFrame title="Connections & Processes" code={code}>
      <div style={{ padding: '11px 12px 12px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {readout('TCP', fmtCount(tcpNow))}
          {readout('UDP', fmtCount(udpNow))}
          {readout('PROC', fmtCount(procNow))}
        </div>

        <div
          style={{
            fontSize: contentFs(9),
            color: 'var(--fg-3)',
            letterSpacing: '0.08em',
            marginBottom: 6,
            fontFamily: 'var(--font-mono)',
          }}
        >
          TCP{windowLabel ? ` · ${windowLabel}` : ''}
        </div>

        <div
          className="precision-inset"
          style={{
            height: 56,
            padding: '5px 6px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 2,
          }}
        >
          {tcp.length === 0 ? (
            <div
              style={{
                width: '100%',
                textAlign: 'center',
                color: 'var(--fg-3)',
                fontSize: contentFs(9),
                letterSpacing: '0.16em',
                alignSelf: 'center',
                fontFamily: 'var(--font-mono)',
              }}
            >
              NO DATA
            </div>
          ) : (
            tcp.map((v, i) => {
              // Colour against this node's own baseline, not an absolute scale.
              const rel = tcpMean != null && tcpMean > 0 ? v / tcpMean : 1
              const color =
                rel >= 2 ? 'var(--signal-bad)' : rel >= 1.3 ? 'var(--signal-warn)' : 'var(--accent)'
              return (
                <span
                  key={i}
                  style={{
                    flex: 1,
                    minWidth: 1,
                    height: `${peak > 0 ? Math.max(3, (v / peak) * 100) : 3}%`,
                    background: color,
                    borderRadius: 1,
                    boxShadow: rel >= 2 ? `0 0 5px ${color}` : 'none',
                  }}
                />
              )
            })
          )}
        </div>

        {spike != null && (
          <div style={{ marginTop: 7, fontSize: contentFs(8), color: 'var(--fg-3)' }}>
            较窗口均值{' '}
            <span
              className="mono tnum"
              style={{
                color: spike >= 2 ? 'var(--signal-bad)' : spike >= 1.3 ? 'var(--signal-warn)' : 'var(--fg-2)',
                fontWeight: 600,
              }}
            >
              {spike >= 1 ? '↑' : '↓'} {spike.toFixed(1)}×
            </span>
            {' · '}峰值 {fmtCount(peak)}
          </div>
        )}
      </div>
    </CardFrame>
  )
}

export const ConnectionsPanel = memo(ConnectionsPanel_)
