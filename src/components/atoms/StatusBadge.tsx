import type { ReactNode } from 'react'
import { StatusDot } from './StatusDot'

type Status = 'good' | 'warn' | 'bad' | 'info' | 'idle' | 'accent'

interface Props {
  status?: Status
  label: ReactNode
  dense?: boolean
}

const COLOR: Record<Status, { bg: string; fg: string; border: string }> = {
  good: {
    bg: 'color-mix(in oklab, var(--signal-good) 14%, transparent)',
    fg: 'var(--signal-good)',
    border: 'color-mix(in oklab, var(--signal-good) 30%, transparent)',
  },
  warn: {
    bg: 'color-mix(in oklab, var(--signal-warn) 16%, transparent)',
    fg: 'var(--signal-warn)',
    border: 'color-mix(in oklab, var(--signal-warn) 32%, transparent)',
  },
  bad: {
    bg: 'color-mix(in oklab, var(--signal-bad) 16%, transparent)',
    fg: 'var(--signal-bad)',
    border: 'color-mix(in oklab, var(--signal-bad) 35%, transparent)',
  },
  info: {
    bg: 'color-mix(in oklab, var(--signal-info) 14%, transparent)',
    fg: 'var(--signal-info)',
    border: 'color-mix(in oklab, var(--signal-info) 30%, transparent)',
  },
  idle: { bg: 'var(--bg-3)', fg: 'var(--fg-2)', border: 'var(--edge-mid)' },
  accent: {
    bg: 'color-mix(in oklab, var(--accent) 16%, transparent)',
    fg: 'var(--accent-bright)',
    border: 'color-mix(in oklab, var(--accent) 35%, transparent)',
  },
}

export function StatusBadge({ status = 'good', label, dense = false }: Props) {
  const c = COLOR[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: dense ? '1px 5px' : '2px 7px',
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        borderRadius: 3,
        fontFamily: 'var(--font-mono)',
        fontSize: dense ? 9 : 10,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        fontWeight: 600,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      <StatusDot status={status === 'accent' ? 'good' : status} size={5} halo={false} />
      {label}
    </span>
  )
}
