interface Props {
  /** Each entry: 0..100 representing health/quality at that tick */
  data: number[]
  width?: number
  height?: number
  bars?: number
}

/**
 * Heartbeat — discrete vertical bars colored by quality.
 * Used for "last N minutes ping" or "uptime trail".
 */
export function Heartbeat({ data, width = 240, height = 24, bars }: Props) {
  if (!data || data.length === 0) {
    return (
      <svg width={width} height={height}>
        <rect width={width} height={height} fill="var(--bg-inset)" />
      </svg>
    )
  }

  const sliced = bars ? data.slice(-bars) : data
  const n = sliced.length
  const gap = 1
  const barW = (width - gap * (n - 1)) / n

  const colorFor = (v: number): string => {
    if (v <= 0) return 'var(--fg-3)'
    if (v < 30) return 'var(--signal-bad)'
    if (v < 60) return 'var(--signal-warn)'
    return 'var(--signal-good)'
  }

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <rect width={width} height={height} fill="var(--bg-inset)" />
      {sliced.map((v, i) => {
        const h = v <= 0 ? 2 : Math.max(2, (height - 4) * (v / 100))
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={(height - h) / 2}
            width={barW}
            height={h}
            fill={colorFor(v)}
            opacity={v <= 0 ? 0.3 : 0.9}
          />
        )
      })}
    </svg>
  )
}
