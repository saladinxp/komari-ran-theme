import type { NodeStatus } from '@/types/komari'

interface Props {
  status?: NodeStatus | 'info' | 'idle'
  size?: number
  /** Static halo glow around the dot */
  halo?: boolean
  /** Animated pulse ring (CSS-only, GPU-composited). */
  pulse?: boolean
}

const COLOR_MAP: Record<string, string> = {
  good: 'var(--signal-good)',
  warn: 'var(--signal-warn)',
  bad: 'var(--signal-bad)',
  info: 'var(--signal-info)',
  idle: 'var(--fg-3)',
}

/**
 * StatusDot — colored dot with optional halo glow and pulse ring.
 * Pulse uses transform+opacity (GPU-composited, ~zero CPU).
 */
export function StatusDot({ status = 'good', size = 8, halo = true, pulse = false }: Props) {
  const color = COLOR_MAP[status] ?? COLOR_MAP.idle
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: color,
          // Two stages: a tight opaque-ish ring hugging the dot, then a soft
          // bloom beyond it. A single blur reads as a smudge; the ring gives
          // the lamp an edge, so it looks lit rather than merely coloured.
          boxShadow: halo
            ? `0 0 0 ${Math.max(2, size * 0.32)}px color-mix(in srgb, ${color} 18%, transparent),
               0 0 ${size * 0.8}px color-mix(in srgb, ${color} 55%, transparent)`
            : 'none',
        }}
      />
      {pulse && (
        <span
          style={{
            position: 'absolute',
            inset: -size * 0.5,
            borderRadius: '50%',
            border: `1px solid ${color}`,
            opacity: 0.5,
            animation: 'ran-pulse 2s ease-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}
    </span>
  )
}
