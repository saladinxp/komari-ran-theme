import type { CSSProperties } from 'react'

interface Props {
  /** When set, applies the data-theme directly to this card (for cover image rendering). */
  theme?: 'ran-night' | 'ran-mist'
  width?: number
  height?: number
  /** Big title — defaults to "Ran" */
  title?: string
  /** Subtitle in mono — defaults to "PRECISION PROBE / 岚" */
  subtitle?: string
  /** Serial code at top-right */
  serial?: string
}

/**
 * ThemeCover — 460x230 (2:1) thumbnail card for Komari's theme manager.
 * Showcases the precision-machined aesthetic at a glance: tick ruler,
 * etched serials, mini dashboard, sunken bottom strip.
 */
export function ThemeCover({
  theme,
  width = 460,
  height = 230,
  title = 'Ran',
  subtitle = '岚 · PRECISION PROBE',
  serial = 'SN-7A4F2D',
}: Props) {
  const wrapperStyle: CSSProperties = {
    width,
    height,
    position: 'relative',
    overflow: 'hidden',
    background: 'var(--bg-0)',
    color: 'var(--fg-0)',
    fontFamily: 'var(--font-sans)',
    borderRadius: 6,
    boxShadow:
      'inset 0 0 0 1px var(--edge-mid), inset 0 1px 0 var(--edge-bright), 0 4px 16px rgba(0,0,0,0.18)',
  }

  return (
    <div data-theme={theme} style={wrapperStyle}>
      {/* Inner stepped frame */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          right: 8,
          bottom: 8,
          border: '1px solid var(--edge-engrave)',
          boxShadow: 'inset 0 0 0 1px var(--bg-1)',
        }}
      />

      {/* Top-left: accent block + series stamp */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            background: 'var(--accent)',
            boxShadow: '0 0 6px var(--accent)',
          }}
        />
        <span
          style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            color: 'var(--fg-3)',
            letterSpacing: '0.2em',
          }}
        >
          KMR · MONITOR · RAN
        </span>
      </div>

      {/* Top-right: serial */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 16,
          fontSize: 9,
          fontFamily: 'var(--font-mono)',
          color: 'var(--fg-3)',
          letterSpacing: '0.2em',
        }}
      >
        {serial}
      </div>

      {/* Tick ruler */}
      <div
        style={{
          position: 'absolute',
          top: 30,
          left: 16,
          right: 16,
          height: 5,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 0,
        }}
      >
        {Array.from({ length: 60 }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: i % 5 === 0 ? 5 : 2,
              background: i % 10 === 0 ? 'var(--fg-3)' : 'var(--edge-mid)',
              marginRight: 1,
            }}
          />
        ))}
      </div>

      {/* Big title */}
      <div
        style={{
          position: 'absolute',
          top: 50,
          left: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 0.95,
            color: 'var(--fg-0)',
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--accent-bright)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.2em',
            fontWeight: 500,
          }}
        >
          {subtitle}
        </span>
      </div>

      {/* Right-side mini dashboard */}
      <div
        style={{
          position: 'absolute',
          top: 50,
          right: 16,
          width: 180,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {/* Status block */}
        <div
          style={{
            padding: '6px 8px',
            background: 'var(--bg-2)',
            border: '1px solid var(--edge-mid)',
            boxShadow: 'inset 0 1px 0 var(--edge-bright)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: 8,
                fontFamily: 'var(--font-mono)',
                color: 'var(--fg-3)',
                letterSpacing: '0.15em',
              }}
            >
              NODE.13 · TYO
            </span>
            <span
              style={{
                width: 5,
                height: 5,
                background: 'var(--signal-good)',
                boxShadow: '0 0 4px var(--signal-good)',
              }}
            />
          </div>
          {[
            { l: 'CPU', v: 34, c: 'var(--signal-info)' },
            { l: 'MEM', v: 58, c: 'var(--accent)' },
            { l: 'DSK', v: 41, c: 'var(--signal-warn)' },
          ].map((m) => (
            <div
              key={m.l}
              style={{
                display: 'grid',
                gridTemplateColumns: '22px 1fr 24px',
                gap: 4,
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: 7,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--fg-3)',
                  letterSpacing: '0.1em',
                }}
              >
                {m.l}
              </span>
              <div
                style={{
                  height: 3,
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
                    width: `${m.v}%`,
                    background: m.c,
                    boxShadow: `0 0 3px ${m.c}`,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 7.5,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--fg-1)',
                  textAlign: 'right',
                }}
              >
                {m.v}%
              </span>
            </div>
          ))}
        </div>

        {/* Mini sparkbar */}
        <div
          style={{
            padding: '5px 8px',
            background: 'var(--bg-2)',
            border: '1px solid var(--edge-mid)',
            boxShadow: 'inset 0 1px 0 var(--edge-bright)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 1,
              height: 14,
            }}
          >
            {[3, 7, 5, 9, 12, 8, 15, 11, 7, 13, 18, 14, 10, 16, 22, 18, 14, 11, 17, 20, 15, 12, 9, 14, 18, 16].map(
              (v, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: v,
                    background: 'var(--accent-bright)',
                    boxShadow: '0 0 2px var(--accent)',
                  }}
                />
              ),
            )}
          </div>
        </div>
      </div>

      {/* Bottom strip readout */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: 16,
          right: 16,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'var(--bg-inset)',
          border: '1px solid var(--edge-engrave)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.25)',
        }}
      >
        {[
          { label: 'NODES', value: '14', sub: '/17', color: 'var(--fg-0)' },
          { label: 'PING', value: '32.4', unit: 'ms', color: 'var(--accent-bright)' },
          { label: '↑↓', value: '4.21', unit: 'TB', color: 'var(--signal-good)' },
          { label: 'UP', value: '99.94', unit: '%', color: 'var(--fg-0)' },
        ].map((s, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                fontSize: 8,
                fontFamily: 'var(--font-mono)',
                color: 'var(--fg-3)',
                letterSpacing: '0.15em',
              }}
            >
              {s.label}
            </span>
            <span
              style={{
                fontSize: 14,
                fontFamily: 'var(--font-mono)',
                color: s.color,
                fontWeight: 600,
              }}
            >
              {s.value}
              {s.sub && <span style={{ color: 'var(--fg-3)' }}>{s.sub}</span>}
              {s.unit && (
                <span style={{ fontSize: 9, color: 'var(--fg-3)', marginLeft: 1 }}>{s.unit}</span>
              )}
            </span>
          </span>
        ))}
      </div>

      {/* Crosshair corners */}
      {[
        { top: 38, left: 14 },
        { top: 38, right: 14 },
        { bottom: 38, left: 14 },
        { bottom: 38, right: 14 },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            ...pos,
            width: 6,
            height: 6,
            borderTop: '1px solid var(--accent)',
            borderLeft: '1px solid var(--accent)',
          }}
        />
      ))}
    </div>
  )
}
