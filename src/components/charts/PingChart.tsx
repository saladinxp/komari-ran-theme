interface Series {
  data: number[]
  label?: string
}

interface Props {
  series: Series[]
  width?: number
  height?: number
  /** When undefined, computed from series max with a 20% margin. */
  yMax?: number
}

const COLORS = [
  'var(--accent-bright)',
  'var(--signal-info)',
  'var(--signal-good)',
  'var(--signal-warn)',
]

const X_LABELS = ['-1h', '-50m', '-40m', '-30m', '-20m', '-10m', 'now']

/**
 * PingChart — multiple latency series over a 1h window.
 * Y axis labeled in ms, X axis at -1h / -50m / .../ now. Optional legend
 * row shows series labels (e.g. ping target names).
 */
export function PingChart({ series, width = 480, height = 160, yMax }: Props) {
  if (!series.length || !series[0].data.length) {
    return <div style={{ width, height, background: 'var(--bg-inset)' }} />
  }

  // Auto Y scale if not provided — find max across all series, round up to nice value
  const computedYMax =
    yMax ??
    (() => {
      let m = 0
      for (const s of series) for (const v of s.data) if (v > m) m = v
      m = Math.max(50, m * 1.2)
      // round to nearest 25
      return Math.ceil(m / 25) * 25
    })()

  const hasLegend = series.some((s) => s.label)
  const legendH = hasLegend ? 18 : 0

  const pad = { top: 14, right: 44, bottom: 22, left: 8 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom - legendH
  const stepX = innerW / Math.max(1, series[0].data.length - 1)

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* horizontal grid + y labels */}
      {Array.from({ length: 5 }, (_, i) => {
        const y = pad.top + (i / 4) * innerH
        return (
          <g key={`h${i}`}>
            <line
              x1={pad.left}
              x2={pad.left + innerW}
              y1={y}
              y2={y}
              stroke="var(--grid-line-strong)"
              strokeWidth="1"
              strokeDasharray={i === 0 || i === 4 ? '0' : '2 3'}
              opacity={i === 0 || i === 4 ? 1 : 0.6}
            />
            <text
              x={pad.left + innerW + 5}
              y={y + 3}
              fontSize="9"
              fill="var(--fg-3)"
              fontFamily="var(--font-mono)"
              letterSpacing="0.1em"
            >
              {Math.round(computedYMax - (i / 4) * computedYMax)}ms
            </text>
          </g>
        )
      })}
      {/* vertical grid */}
      {Array.from({ length: 7 }, (_, i) => (
        <line
          key={`v${i}`}
          x1={pad.left + (i / 6) * innerW}
          x2={pad.left + (i / 6) * innerW}
          y1={pad.top}
          y2={pad.top + innerH}
          stroke="var(--grid-line)"
          strokeWidth="1"
        />
      ))}
      {/* series */}
      {series.map((s, si) => {
        const c = COLORS[si % COLORS.length]
        const pts = s.data.map(
          (d, i) =>
            [
              pad.left + i * stepX,
              pad.top + innerH - (Math.min(computedYMax, d) / computedYMax) * innerH,
            ] as [number, number],
        )
        // Skip zero-only segments to avoid baseline noise when target hadn't reported
        const path = pts
          .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
          .join(' ')
        const last = pts[pts.length - 1]
        return (
          <g key={`s${si}`}>
            <path
              d={path}
              stroke={c}
              strokeWidth={1.3}
              fill="none"
              strokeLinejoin="round"
              opacity={0.85}
            />
            <circle cx={last[0]} cy={last[1]} r={2} fill={c} />
          </g>
        )
      })}
      {/* X labels */}
      {X_LABELS.map((l, i) => (
        <text
          key={`x${i}`}
          x={pad.left + (i / 6) * innerW}
          y={pad.top + innerH + 14}
          fontSize="9"
          fill="var(--fg-3)"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
          letterSpacing="0.08em"
        >
          {l}
        </text>
      ))}
      {/* Legend */}
      {hasLegend &&
        series.map((s, si) => {
          const c = COLORS[si % COLORS.length]
          // Distribute legend items across the chart width
          const itemW = innerW / Math.max(1, series.length)
          const x = pad.left + si * itemW + 4
          const y = height - 4
          return (
            <g key={`lg${si}`}>
              <rect x={x} y={y - 8} width={8} height={2} fill={c} />
              <text
                x={x + 12}
                y={y - 1}
                fontSize="9"
                fill="var(--fg-2)"
                fontFamily="var(--font-mono)"
                letterSpacing="0.06em"
              >
                {(s.label ?? '').slice(0, Math.floor(itemW / 6))}
              </text>
            </g>
          )
        })}
    </svg>
  )
}
