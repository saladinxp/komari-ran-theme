interface Props {
  data: number[]
  width?: number
  height?: number
  color?: string
  fillOpacity?: number
  /** Show min/max baselines */
  showBaseline?: boolean
  /** Stroke width */
  thickness?: number
  /** When true, the SVG renders at 100% of its container width via viewBox.
   *  `width` then acts only as the viewBox coordinate space (defaults still
   *  work for desktop-fixed callers). */
  responsive?: boolean
}

/**
 * Sparkline — minimal inline trend line. Pure SVG, no animation.
 *
 * Two width modes:
 * - default: SVG renders at the literal `width` pixels (existing call sites)
 * - responsive: SVG fills its container; `width` becomes the viewBox space
 *   only. Use this when the parent is flex/grid and we want the line to
 *   stretch with available width (HeroStats mobile single-col layout).
 */
export function Sparkline({
  data,
  width = 120,
  height = 28,
  color = 'var(--accent)',
  fillOpacity = 0.12,
  showBaseline = false,
  thickness = 1.2,
  responsive = false,
}: Props) {
  // Common SVG sizing props — responsive mode lets CSS drive the rendered
  // pixel width while the viewBox keeps the geometry math intact.
  const svgSize = responsive
    ? { viewBox: `0 0 ${width} ${height}`, width: '100%', height, preserveAspectRatio: 'none' as const }
    : { width, height }

  if (!data || data.length < 2) {
    return (
      <svg {...svgSize} style={{ display: 'block' }}>
        <line
          x1={0}
          x2={width}
          y1={height / 2}
          y2={height / 2}
          stroke="var(--edge-deep)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      </svg>
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const padY = 2

  const points = data
    .map((v, i) => {
      const x = i * stepX
      const y = padY + (height - padY * 2) * (1 - (v - min) / range)
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  const areaPath = `M0,${height} L${points.replace(/ /g, ' L')} L${width},${height} Z`

  return (
    <svg {...svgSize} style={{ display: 'block' }}>
      {showBaseline && (
        <>
          <line x1={0} x2={width} y1={padY} y2={padY} stroke="var(--edge-deep)" strokeWidth="1" strokeDasharray="2 3" />
          <line
            x1={0}
            x2={width}
            y1={height - padY}
            y2={height - padY}
            stroke="var(--edge-deep)"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
        </>
      )}
      <path d={areaPath} fill={color} opacity={fillOpacity} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
