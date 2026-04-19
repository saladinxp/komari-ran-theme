import { useEffect, useState } from 'react'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { StatusDot } from '@/components/atoms/StatusDot'
import { Segmented } from '@/components/atoms/Segmented'
import { Icon } from '@/components/atoms/icons'

type Theme = 'ran-night' | 'ran-mist'
type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'

interface Props {
  title: string
  subtitle?: string
  theme: Theme
  onTheme: (t: Theme) => void
  online: number
  total: number
  conn: Conn
  /** Timestamp of the last successful WS message, for the "Xs ago" hint. */
  lastUpdate?: number | null
}

/**
 * Topbar — title + status pill + search field + theme segmented control.
 * Shows a live-updating "Xs ago" hint so the page reads as alive even
 * when all metrics happen to be flat (e.g. an idle 1-core node).
 */
export function Topbar({ title, subtitle, theme, onTheme, online, total, conn, lastUpdate }: Props) {
  const connStatus =
    conn === 'open' ? 'good' : conn === 'connecting' ? 'info' : conn === 'error' ? 'bad' : 'idle'
  const connLabel =
    conn === 'open' ? 'LIVE' : conn === 'connecting' ? 'CONNECTING' : conn === 'error' ? 'ERROR' : 'OFFLINE'

  // Tick once per second so the "Xs ago" badge stays current.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  let agoLabel: string | null = null
  if (lastUpdate && conn === 'open') {
    const sec = Math.max(0, Math.round((now - lastUpdate) / 1000))
    agoLabel = sec < 2 ? 'JUST NOW' : `${sec}s ago`
  }

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--edge-mid)',
        boxShadow: '0 1px 0 var(--edge-bright)',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: 1 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--fg-0)',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </span>
            <SerialPlate>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <StatusDot status={connStatus} size={5} pulse={conn === 'open'} />
                {online}/{total} · {connLabel}
              </span>
            </SerialPlate>
            {agoLabel && (
              <span
                style={{
                  fontSize: 9,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--fg-3)',
                  letterSpacing: '0.14em',
                  opacity: 0.85,
                }}
              >
                · {agoLabel}
              </span>
            )}
          </div>
          {subtitle && <Etch>{subtitle}</Etch>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Search field — visual only for now */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 10px',
            background: 'var(--bg-inset)',
            border: '1px solid var(--edge-engrave)',
            borderRadius: 4,
            minWidth: 220,
            boxShadow: 'inset 0 1px 0 var(--edge-deep)',
          }}
        >
          <span style={{ color: 'var(--fg-3)' }}>{Icon.search}</span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--fg-3)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.06em',
              flex: 1,
            }}
          >
            SEARCH NODES
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--fg-3)',
              padding: '1px 4px',
              border: '1px solid var(--edge-engrave)',
              borderRadius: 2,
            }}
          >
            ⌘K
          </span>
        </div>

        <Segmented
          options={[
            { value: 'ran-night', label: 'NIGHT' },
            { value: 'ran-mist', label: 'MIST' },
          ]}
          value={theme}
          onChange={(v) => onTheme(v as Theme)}
        />
      </div>
    </header>
  )
}
