import { useCallback } from 'react'
import { useElementWidth } from '@/hooks/useElementWidth'
import {
  ChartTooltipOverlay,
  formatTipTime,
  useChartTooltip,
  type TooltipPoint,
} from './ChartTooltip'

interface Props {
  data: number[]
  /** Initial / fallback width — actual width adapts to parent via ResizeObserver. */
  width?: number
  height?: number
  color?: string
  yMin?: number
  yMax?: number
  /** Threshold line (e.g. 80% danger). Drawn as dashed warn-color line. */
  threshold?: number
  gridY?: number
  gridX?: number
  /** Optional unique gradient id seed (avoid duplicate ids on the page). */
  gradientId?: string
  /** Format the y-axis label given the value */
  formatY?: (v: number) => string
  /** Optional per-point unix-ms timestamps; enables hover tooltip with time. */
  times?: number[]
  /** Optional formatter for the tooltip value (gets units etc). Defaults to v.toFixed(1). */
  formatValue?: (v: number) => string
}

/**
 * AreaChart — full chart with grid, y-axis labels on the right,
 * area fill gradient, current-value dot, optional threshold dashed line,
 * and a hover tooltip showing value (+ time when `times` is provided).
 */
export function AreaChart({
  data,
  width: initialWidth = 400,
  height = 140,
  color = 'var(--accent)',
  yMin = 0,
  yMax = 100,
  threshold,
  gridY = 4,
  gridX = 6,
  gradientId,
  formatY,
  times,
  formatValue,
}: Props) {
  const [wrapRef, w] = useElementWidth<HTMLDivElement>(initialWidth)

  const pad = { top: 12, right: 36, bottom: 18, left: 8 }
  const innerW = Math.max(0, w - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom
  const range = yMax - yMin || 1
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0

  const id = gradientId ?? `grad-${Math.random().toString(36).slice(2, 8)}`

  const fmt = formatValue ?? ((v: number) => v.toFixed(1))

  const resolve = useCallback(
    (svgX: number): TooltipPoint | null => {
      if (data.length === 0 || stepX === 0) return null
      const localX = svgX - pad.left
      const idx = Math.max(0, Math.min(data.length - 1, Math.round(localX / stepX)))
      const v = data[idx]
      const cx = pad.left + idx * stepX
      const cy =
        pad.top + innerH - ((Math.max(yMin, Math.min(yMax, v)) - yMin) / range) * innerH
      const t = times?.[idx]
      return {
        cx,
        cy,
        color,
        valueText: fmt(v),
        subText: t ? formatTipTime(t) : undefined,
      }
    },
    [data, stepX, pad.left, pad.top, innerH, yMin, yMax, range, times, color, fmt],
  )

  const tooltip = useChartTooltip({
    width: w,
    height,
    innerLeft: pad.left,
    innerRight: pad.left + innerW,
    innerTop: pad.top,
    innerBottom: pad.top + innerH,
    resolve,
  })

  if (data.length === 0) {
    return (
      <div
        ref={wrapRef}
        style={{
          width: '100%',
          height,
          background: 'var(--bg-inset)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 2,
        }}
      />
    )
  }

  const pts = data.map(
    (d, i) =>
      [
        pad.left + i * stepX,
        pad.top + innerH - ((Math.max(yMin, Math.min(yMax, d)) - yMin) / range) * innerH,
      ] as [number, number],
  )
  const path = pts
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(' ')
  const fillPath = `${path} L${pad.left + innerW},${pad.top + innerH} L${pad.left},${pad.top + innerH} Z`

  const formatLabel = formatY ?? ((v: number) => v.toFixed(0))

  // Combine refs: useElementWidth and useChartTooltip both want the wrapper.
  const setRefs = (el: HTMLDivElement | null) => {
    ;(wrapRef as { current: HTMLDivElement | null }).current = el
    ;(tooltip.wrapRef as { current: HTMLDivElement | null }).current = el
  }

  return (
    <div
      ref={setRefs}
      onMouseMove={tooltip.bind.onMouseMove}
      onMouseLeave={tooltip.bind.onMouseLeave}
      style={{ width: '100%', height, position: 'relative', cursor: 'crosshair' }}
    >
      <svg width={w} height={height} style={{ display: 'block' }}>
        {/* horizontal grid */}
        {Array.from({ length: gridY + 1 }, (_, i) => {
          const y = pad.top + (i / gridY) * innerH
          const isEdge = i === 0 || i === gridY
          return (
            <line
              key={`gy${i}`}
              x1={pad.left}
              x2={pad.left + innerW}
              y1={y}
              y2={y}
              stroke="var(--grid-line-strong)"
              strokeWidth={1}
              strokeDasharray={isEdge ? '0' : '2 3'}
              opacity={isEdge ? 1 : 0.6}
            />
          )
        })}
        {/* vertical grid */}
        {Array.from({ length: gridX + 1 }, (_, i) => {
          const x = pad.left + (i / gridX) * innerW
          return (
            <line
              key={`gx${i}`}
              x1={x}
              x2={x}
              y1={pad.top}
              y2={pad.top + innerH}
              stroke="var(--grid-line)"
              strokeWidth={1}
            />
          )
        })}
        {/* threshold */}
        {threshold != null && threshold >= yMin && threshold <= yMax && (
          <line
            x1={pad.left}
            x2={pad.left + innerW}
            y1={pad.top + innerH - ((threshold - yMin) / range) * innerH}
            y2={pad.top + innerH - ((threshold - yMin) / range) * innerH}
            stroke="var(--signal-warn)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.7}
          />
        )}
        {/* fill */}
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill={`url(#${id})`} />
        {/* line */}
        <path
          d={path}
          stroke={color}
          strokeWidth={1.4}
          fill="none"
          strokeLinejoin="round"
        />
        {/* current dot */}
        {pts.length > 0 && (
          <>
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
            <circle
              cx={pts[pts.length - 1][0]}
              cy={pts[pts.length - 1][1]}
              r="5"
              fill={color}
              opacity="0.2"
            />
          </>
        )}
        {/* y-axis labels (right side) */}
        {Array.from({ length: gridY + 1 }, (_, i) => {
          const v = yMax - (i / gridY) * range
          const y = pad.top + (i / gridY) * innerH
          return (
            <text
              key={`yt${i}`}
              x={pad.left + innerW + 5}
              y={y + 3}
              fontSize="9"
              fill="var(--fg-3)"
              fontFamily="var(--font-mono)"
              letterSpacing="0.1em"
            >
              {formatLabel(v)}
            </text>
          )
        })}
      </svg>
      <ChartTooltipOverlay hover={tooltip.hover} width={w} height={height} />
    </div>
  )
}
