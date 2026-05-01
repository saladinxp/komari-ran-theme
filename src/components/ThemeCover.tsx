import type { CSSProperties } from 'react'

interface Props {
  /** When set, applies the data-theme directly to this card. */
  theme?: 'ran-night' | 'ran-mist' | 'ran-ember' | 'ran-sakura' | 'ran-lavender'
  width?: number
  height?: number
}

/**
 * ThemeCover — 460x230 thumbnail card for Komari's theme manager.
 *
 * Layout language: poetry + precision instrument.
 * - Thin top/bottom rule with serial stamps (the "instrument" half)
 * - Negative space + a single oversized 岚 character on the right (the "poem")
 * - Distant mountain silhouettes in the lower third — "岚" means
 *   mist drifting through mountains, so the cover should feel that way,
 *   not look like a dashboard screenshot
 * - One small vital sign in the lower-left corner so it still reads
 *   as "monitoring tool", not pure typography
 */
export function ThemeCover({ theme, width = 460, height = 230 }: Props) {
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
      {/* Distant mountain silhouettes — drawn in SVG so they scale crisply */}
      <svg
        viewBox="0 0 460 230"
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0, display: 'block' }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="ran-cover-mist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--fg-0)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--fg-0)" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="ran-cover-mountain-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--fg-0)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--fg-0)" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="ran-cover-mountain-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--fg-0)" stopOpacity="0.07" />
            <stop offset="100%" stopColor="var(--fg-0)" stopOpacity="0.13" />
          </linearGradient>
          <linearGradient id="ran-cover-mountain-near" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--fg-0)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--fg-0)" stopOpacity="0.20" />
          </linearGradient>
        </defs>

        {/* Mist band */}
        <rect x="0" y="135" width="460" height="50" fill="url(#ran-cover-mist)" />

        {/* Far mountains — lowered and softer curves */}
        <path
          d="M 0,178 C 30,170 60,176 95,168 C 130,176 165,166 200,174 C 240,162 280,172 320,164 C 360,170 400,160 440,168 L 460,166 L 460,200 L 0,200 Z"
          fill="url(#ran-cover-mountain-far)"
        />

        {/* Mid mountains */}
        <path
          d="M 0,192 C 25,184 55,194 90,180 C 130,192 175,178 220,190 C 270,176 320,188 370,180 C 420,190 460,184 460,184 L 460,212 L 0,212 Z"
          fill="url(#ran-cover-mountain-mid)"
        />

        {/* Near mountains — closest, lowest */}
        <path
          d="M 0,210 C 35,200 75,206 120,196 C 165,206 210,198 260,208 C 310,200 360,208 410,202 C 440,206 460,206 460,206 L 460,230 L 0,230 Z"
          fill="url(#ran-cover-mountain-near)"
        />

        {/* Tiny accent moon — small amber dot above the mountains */}
        <circle cx="80" cy="76" r="4" fill="var(--accent)" opacity="0.85" />
        <circle cx="80" cy="76" r="9" fill="var(--accent)" opacity="0.18" />
      </svg>

      {/* Top rule — KMR · MONITOR · RAN | SN-7A4F2D */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 18,
          right: 18,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 9,
          fontFamily: 'var(--font-mono)',
          color: 'var(--fg-3)',
          letterSpacing: '0.22em',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span
            style={{
              width: 7,
              height: 7,
              background: 'var(--accent)',
              boxShadow: '0 0 6px var(--accent)',
            }}
          />
          KMR · MONITOR · RAN
        </div>
        <span>SN-7A4F2D</span>
      </div>

      {/* Hairline rule under top stamp */}
      <div
        style={{
          position: 'absolute',
          top: 32,
          left: 18,
          right: 18,
          height: 1,
          background: 'var(--edge-engrave)',
        }}
      />

      {/* Big calligraphic 岚 character on the right — the poem */}
      <div
        style={{
          position: 'absolute',
          top: 50,
          right: 26,
          width: 150,
          height: 150,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '"Inter Tight", "Songti SC", "Noto Serif SC", serif',
          fontSize: 140,
          fontWeight: 300,
          lineHeight: 1,
          color: 'var(--fg-0)',
          opacity: 0.92,
          letterSpacing: '-0.05em',
        }}
      >
        岚
      </div>

      {/* Wordmark + tagline on the left */}
      <div
        style={{
          position: 'absolute',
          left: 22,
          top: 56,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <span
          style={{
            fontSize: 38,
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 0.95,
            color: 'var(--fg-0)',
          }}
        >
          Ran
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--accent-bright)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.24em',
            fontWeight: 500,
            textTransform: 'uppercase',
          }}
        >
          Precision Probe
        </span>
        <span
          style={{
            fontSize: 9,
            color: 'var(--fg-3)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.18em',
            marginTop: 4,
            opacity: 0.85,
          }}
        >
          Mountain mist · server signal
        </span>
      </div>

      {/* Bottom-left vital sign — single in-context reading */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: 22,
          display: 'flex',
          alignItems: 'baseline',
          gap: 14,
          fontFamily: 'var(--font-mono)',
          padding: '4px 10px',
          background: 'color-mix(in oklab, var(--bg-0) 75%, transparent)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 3,
          backdropFilter: 'blur(2px)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 6,
              height: 6,
              background: 'var(--signal-good)',
              boxShadow: '0 0 5px var(--signal-good)',
              borderRadius: 1,
            }}
          />
          <span
            style={{
              fontSize: 9,
              color: 'var(--fg-3)',
              letterSpacing: '0.18em',
            }}
          >
            UPLINK
          </span>
          <span
            style={{
              fontSize: 13,
              color: 'var(--fg-0)',
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            14
          </span>
          <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>/17</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
          <span
            style={{
              fontSize: 9,
              color: 'var(--fg-3)',
              letterSpacing: '0.18em',
            }}
          >
            ↑↓
          </span>
          <span
            style={{
              fontSize: 13,
              color: 'var(--accent-bright)',
              fontWeight: 600,
            }}
          >
            4.21
          </span>
          <span style={{ fontSize: 9, color: 'var(--fg-3)' }}>TB</span>
        </span>
      </div>

      {/* Bottom-right tick scale — subtle "instrument" reminder */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 22,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1,
          height: 8,
        }}
      >
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 1,
              height: i % 6 === 0 ? 8 : i % 3 === 0 ? 5 : 3,
              background: 'var(--fg-3)',
              opacity: i % 6 === 0 ? 0.7 : 0.35,
            }}
          />
        ))}
      </div>

      {/* Crosshair corners */}
      {[
        { top: 38, left: 16 },
        { top: 38, right: 16 },
        { bottom: 38, left: 16 },
        { bottom: 38, right: 16 },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            ...pos,
            width: 5,
            height: 5,
            borderTop: '1px solid var(--accent)',
            borderLeft: '1px solid var(--accent)',
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  )
}
