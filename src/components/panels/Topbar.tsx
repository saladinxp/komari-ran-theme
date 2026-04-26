import { useEffect, useState } from 'react'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { StatusDot } from '@/components/atoms/StatusDot'
import { Segmented } from '@/components/atoms/Segmented'
import { Icon } from '@/components/atoms/icons'
import { useIsMobile, useIsNarrow } from '@/hooks/useMediaQuery'

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
  /**
   * When provided, render a hamburger button on the left that calls this
   * to open the mobile sidebar drawer. Desktop hides it via media query.
   */
  onMobileMenu?: () => void
}

/**
 * Topbar — title + status pill + search field + theme segmented control.
 * Shows a live-updating "Xs ago" hint so the page reads as alive even
 * when all metrics happen to be flat (e.g. an idle 1-core node).
 *
 * Responsive behavior:
 * - md (≤768px): hamburger button appears, search collapses to icon-only,
 *   subtitle is hidden, theme switch shrinks
 * - sm (≤480px): "Xs ago" hint hidden, title gets ellipsis cap
 */
export function Topbar({ title, subtitle, theme, onTheme, online, total, conn, lastUpdate, onMobileMenu }: Props) {
  const isMobile = useIsMobile()
  const isNarrow = useIsNarrow()
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

  // Mobile search overlay state. The header just shows a search icon button
  // that, when tapped, opens a full-width search panel below the header.
  // Currently visual-only (matches the desktop search pill behavior); when
  // search becomes wired up, both entry points share the same handler.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const showHamburger = isMobile && !!onMobileMenu

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '10px 14px' : '12px 24px',
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--edge-mid)',
        boxShadow: '0 1px 0 var(--edge-bright)',
        gap: isMobile ? 8 : 16,
        // Honour iOS safe-area on the right (notch in landscape).
        paddingRight: `calc(${isMobile ? 14 : 24}px + env(safe-area-inset-right))`,
        paddingLeft: `calc(${isMobile ? 14 : 24}px + env(safe-area-inset-left))`,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16, minWidth: 0, flex: 1 }}>
        {/* Hamburger — mobile only */}
        {showHamburger && (
          <button
            onClick={onMobileMenu}
            aria-label="Open navigation menu"
            style={{
              flexShrink: 0,
              width: 34,
              height: 34,
              padding: 0,
              background: 'var(--bg-inset)',
              border: '1px solid var(--edge-engrave)',
              borderRadius: 4,
              boxShadow: 'inset 0 1px 0 var(--edge-deep)',
              color: 'var(--fg-1)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        )}

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: isMobile ? 6 : 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: isMobile ? 15 : 18,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--fg-0)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: isNarrow ? 120 : '100%',
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
            {agoLabel && !isNarrow && (
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
          {/* Subtitle hidden on mobile to free vertical space */}
          {subtitle && !isMobile && <Etch>{subtitle}</Etch>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 12, flexShrink: 0 }}>
        {/* Search — full pill on desktop, icon-only on mobile */}
        {isMobile ? (
          <button
            onClick={() => setMobileSearchOpen((v) => !v)}
            aria-label="Search nodes"
            style={{
              width: 34,
              height: 34,
              padding: 0,
              background: mobileSearchOpen ? 'var(--bg-3)' : 'var(--bg-inset)',
              border: '1px solid var(--edge-engrave)',
              borderRadius: 4,
              boxShadow: 'inset 0 1px 0 var(--edge-deep)',
              color: 'var(--fg-1)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {Icon.search}
          </button>
        ) : (
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
        )}

        <Segmented
          options={[
            { value: 'ran-night', label: isMobile ? 'N' : 'NIGHT' },
            { value: 'ran-mist', label: isMobile ? 'M' : 'MIST' },
          ]}
          value={theme}
          onChange={(v) => onTheme(v as Theme)}
        />
      </div>

      {/* Mobile search panel — drops down below the header. Visual only,
          matches desktop search pill semantics (placeholder, no input yet). */}
      {isMobile && mobileSearchOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--bg-1)',
            borderBottom: '1px solid var(--edge-mid)',
            padding: '10px 14px',
            zIndex: 20,
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              background: 'var(--bg-inset)',
              border: '1px solid var(--edge-engrave)',
              borderRadius: 4,
              boxShadow: 'inset 0 1px 0 var(--edge-deep)',
            }}
          >
            <span style={{ color: 'var(--fg-3)' }}>{Icon.search}</span>
            <span
              style={{
                fontSize: 12,
                color: 'var(--fg-3)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.06em',
                flex: 1,
              }}
            >
              SEARCH NODES
            </span>
          </div>
        </div>
      )}
    </header>
  )
}
