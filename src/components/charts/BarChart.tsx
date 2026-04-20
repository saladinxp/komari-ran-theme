import { useElementWidth } from '@/hooks/useElementWidth'

interface Props {
  data: number[]
  width?: number
  height?: number
  color?: string
  /** Optional axis labels matching data length (use '' to skip a label) */
  labels?: string[]
}

/**
 * BarChart — vertical bars with subtle glow. Static, no animation.
 * Adapts to parent container width via ResizeObserver.
 */
export function BarChart({
  data,
  width: initialWidth = 360,
  height = 100,
  color = 'var(--accent)',
  labels = [],
}: Props) {
  const [wrapRef, w] = useElementWidth<HTMLDivElement>(initialWidth)

  if (!data || data.length === 0) {
    return (
      <div
        ref={wrapRef}
        style={{ width: '100%', height, background: 'var(--bg-inset)' }}
      />
    )
  }

  const max = Math.max(...data, 1)
  const padBottom = labels.length ? 16 : 0
  const barAreaH = height - padBottom
  const gap = 1.5
  const barW = (w - gap * (data.length - 1)) / data.length

  return (
    <div ref={wrapRef} style={{ width: '100%', height }}>
      <svg width={w} height={height} style={{ display: 'block' }}>
        {data.map((v, i) => {
          const h = Math.max(2, (v / max) * (barAreaH - 4))
          return (
            <g key={i}>
              <rect
                x={i * (barW + gap)}
                y={barAreaH - h}
                width={barW}
                height={h}
                fill={color}
                opacity="0.85"
              />
            </g>
          )
        })}
        {labels.map((l, i) => {
          if (!l) return null
          return (
            <text
              key={`l${i}`}
              x={i * (barW + gap) + barW / 2}
              y={height - 4}
              textAnchor="middle"
              fill="var(--fg-3)"
              fontFamily="var(--font-mono)"
              fontSize="9"
              letterSpacing="0.06em"
            >
              {l}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
