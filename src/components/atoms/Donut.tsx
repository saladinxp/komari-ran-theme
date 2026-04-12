import type { ReactNode } from 'react'

interface Props {
  /** 0..100 */
  value: number
  size?: number
  thickness?: number
  color?: string
  trackColor?: string
  label?: ReactNode
  centerLabel?: ReactNode
}

/**
 * Donut — circular gauge ring. Static, no animation.
 * Used for HEALTH, CPU, MEM, DISK summaries.
 */
export function Donut({
  value,
  size = 64,
  thickness = 6,
  color = 'var(--accent)',
  trackColor = 'var(--edge-deep)',
  label,
  centerLabel,
}: Props) {
  const v = Math.max(0, Math.min(100, value))
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - v / 100)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={trackColor}
            strokeWidth={thickness}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="butt"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: size * 0.28,
            fontWeight: 600,
            color: 'var(--fg-0)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}
        >
          {centerLabel ?? Math.round(v)}
        </div>
      </div>
      {label && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: 'var(--fg-3)',
            fontWeight: 500,
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
