import { Etch } from '@/components/atoms/Etch'
import { Numeric } from '@/components/atoms/Numeric'

type Status = 'good' | 'warn' | 'bad' | 'accent'

interface Props {
  value: number
  max?: number
  size?: number
  label?: string
  unit?: string
  status?: Status
}

const COLOR: Record<Status, string> = {
  good: 'var(--signal-good)',
  warn: 'var(--signal-warn)',
  bad: 'var(--signal-bad)',
  accent: 'var(--accent)',
}

/**
 * RadialGauge — 270° arc, ticks every 10%, value path with glow.
 * Center shows the numeric value + unit, label below.
 */
export function RadialGauge({
  value,
  max = 100,
  size = 140,
  label,
  unit = '%',
  status = 'good',
}: Props) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const color = COLOR[status]
  const r = size / 2 - 12
  const cx = size / 2
  const cy = size / 2
  const startAngle = 135
  const sweep = 270
  const endAngle = startAngle + sweep * pct

  const polarToCartesian = (angle: number): [number, number] => {
    const rad = ((angle - 90) * Math.PI) / 180
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
  }

  const [sx, sy] = polarToCartesian(startAngle)
  const [ex, ey] = polarToCartesian(endAngle)
  const [tx, ty] = polarToCartesian(startAngle + sweep)
  const largeArcTrack = 1
  const largeArc = sweep * pct > 180 ? 1 : 0

  // Track and value paths. Track sweeps from start to end of full sweep.
  const trackPath = `M${sx},${sy} A${r},${r} 0 ${largeArcTrack} 1 ${tx},${ty}`
  const valuePath =
    pct > 0 ? `M${sx},${sy} A${r},${r} 0 ${largeArc} 1 ${ex},${ey}` : ''

  // Tick marks every 10%
  const ticks = []
  for (let i = 0; i <= 10; i++) {
    const angle = startAngle + (i / 10) * sweep
    const isMajor = i % 5 === 0
    const inner = r - (isMajor ? 8 : 4)
    const outer = r - 1
    const rad = ((angle - 90) * Math.PI) / 180
    const x1 = cx + inner * Math.cos(rad)
    const y1 = cy + inner * Math.sin(rad)
    const x2 = cx + outer * Math.cos(rad)
    const y2 = cy + outer * Math.sin(rad)
    ticks.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="var(--fg-3)"
        strokeWidth={isMajor ? 1.2 : 0.8}
        opacity={isMajor ? 0.8 : 0.45}
      />,
    )
  }

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ display: 'block' }}>
        <path
          d={trackPath}
          stroke="var(--bg-inset)"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={trackPath}
          stroke="var(--edge-engrave)"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
        {valuePath && (
          <path
            d={valuePath}
            stroke={color}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            filter={`drop-shadow(0 0 4px ${color})`}
          />
        )}
        {ticks}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          pointerEvents: 'none',
        }}
      >
        <Numeric value={Number.isFinite(value) ? value.toFixed(1) : '—'} unit={unit} size={size * 0.22} />
        {label && <Etch>{label}</Etch>}
      </div>
    </div>
  )
}
