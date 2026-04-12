import type { NodeStatus } from '@/types/komari'

interface Props {
  /** 0..100 */
  value: number
  status?: NodeStatus | 'info' | 'accent'
  height?: number
  /** Render evenly-spaced tick marks across the bar */
  ticks?: number
  showTrack?: boolean
}

const COLOR_MAP: Record<string, string> = {
  good: 'var(--signal-good)',
  warn: 'var(--signal-warn)',
  bad: 'var(--signal-bad)',
  info: 'var(--signal-info)',
  accent: 'var(--accent)',
}

/**
 * ProgressBar — horizontal bar with a sunken track and segmented fill.
 * No glow, no scan animation — only the fill color carries the signal.
 */
export function ProgressBar({ value, status = 'good', height = 6, ticks = 0, showTrack = true }: Props) {
  const v = Math.max(0, Math.min(100, value))
  const color = COLOR_MAP[status] ?? COLOR_MAP.good

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        height,
        background: showTrack ? 'var(--bg-inset)' : 'transparent',
        borderRadius: 1,
        boxShadow: showTrack ? 'inset 0 1px 0 var(--edge-deep)' : 'none',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: `${v}%`,
          background: color,
          opacity: 0.85,
          borderRight: v > 0 && v < 100 ? '1px solid var(--edge-bright)' : 'none',
          transition: 'width 0.4s ease',
        }}
      />
      {ticks > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `repeating-linear-gradient(90deg, transparent 0, transparent calc(${100 / ticks}% - 1px), var(--edge-deep) calc(${100 / ticks}% - 1px), var(--edge-deep) ${100 / ticks}%)`,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
