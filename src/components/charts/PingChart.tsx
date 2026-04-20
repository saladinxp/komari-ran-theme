import { useCallback } from 'react'
import { useElementWidth } from '@/hooks/useElementWidth'
import {
  ChartTooltipOverlay,
  formatTipTime,
  useChartTooltip,
  type TooltipPoint,
} from './ChartTooltip'

interface Series {
  data: number[]
  label?: string
}

interface Props {
  series: Series[]
  /** Initial / fallback width before ResizeObserver mounts. */
  width?: number
  height?: number
  /** When undefined, computed from series max with a 20% margin. */
  yMax?: number
  /** Optional unix-ms timestamps per index (shared across series). */
  times?: number[]
  /** X-axis labels — defaults to the 1H scale below. Pass a custom array for other windows. */
  xLabels?: string[]
}

const COLORS = [
  'var(--accent-bright)',
  'var(--signal-info)',
  'var(--signal-good)',
  'var(--signal-warn)',
]

const DEFAULT_X_LABELS = ['-1h', '-50m', '-40m', '-30m', '-20m', '-10m', 'now']

/**
 * PingChart — multiple latency series. Hover shows nearest sample on whichever
 * series the cursor is closest to, with target name + ms + time.
 *
 * Adapts to parent container width via ResizeObserver.
 */
export function PingChart({
  series,
  width: initialWidth = 480,
  height = 160,
  yMax,
  times,
  xLabels = DEFAULT_X_LABELS,
}: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(initialWidth)

  const hasData = series.length > 0 && series[0].data.length > 0

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
  const len = hasData ? series[0].data.length : 0
  const stepX = len > 1 ? innerW / (len - 1) : 0

  const resolve = useCallback(
    (svgX: number, svgY: number): TooltipPoint | null => {
      if (!hasData || stepX === 0) return null
      const localX = svgX - pad.left
      const idx = Math.max(0, Math.min(len - 1, Math.round(localX / stepX)))
      const cx = pad.left + idx * stepX
      // Choose the series whose sample at idx is closest to cursor Y.
      let bestSi = 0
      let bestDy = Infinity
      let bestY = pad.top + innerH
      let bestV = 0
      for (let si = 0; si < series.length; si++) {
        const v = series[si].data[idx] ?? 0
        const y =
          pad.top + innerH - (Math.min(computedYMax, v) / computedYMax) * innerH
        const dy = Math.abs(svgY - y)
        if (dy < bestDy) {
          bestDy = dy
          bestSi = si
          bestY = y
          bestV = v
        }
      }
      const label = series[bestSi].label
      const t = times?.[idx]
      return {
        cx,
        cy: bestY,
        color: COLORS[bestSi % COLORS.length],
        valueText: `${bestV.toFixed(1)} ms${label ? ` · ${label}` : ''}`,
        subText: t ? formatTipTime(t) : undefined,
      }
    },
    [hasData, stepX, len, pad.left, pad.top, innerH, computedYMax, series, times],
  )

  const tooltip = useChartTooltip({
    width,
    height,
    innerLeft: pad.left,
    innerRight: pad.left + innerW,
    innerTop: pad.top,
    innerBottom: pad.top + innerH,
    resolve,
  })

  const setRefs = (el: HTMLDivElement | null) => {
    ;(wrapRef as { current: HTMLDivElement | null }).current = el
    ;(tooltip.wrapRef as { current: HTMLDivElement | null }).current = el
  }

  if (!hasData) {
    return (
      <div
        ref={wrapRef}
        style={{ width: '100%', height, background: 'var(--bg-inset)' }}
      />
    )
  }

  return (
    <div
      ref={setRefs}
      onMouseMove={tooltip.bind.onMouseMove}
      onMouseLeave={tooltip.bind.onMouseLeave}
      style={{ width: '100%', height, position: 'relative', cursor: 'crosshair' }}
    >
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
        {xLabels.map((l, i) => (
          <text
            key={`x${i}`}
            x={pad.left + (i / Math.max(1, xLabels.length - 1)) * innerW}
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
      <ChartTooltipOverlay hover={tooltip.hover} width={width} height={height} />
    </div>
  )
}
