import type { ReactNode } from 'react'
import { Etch } from './Etch'
import { ProgressBar } from './ProgressBar'

type Status = 'good' | 'warn' | 'bad' | 'info' | 'accent'

interface Props {
  label: string
  value: ReactNode
  /** 0..100 */
  bar?: number
  status?: Status
  sub?: string
}

/**
 * Compact metric — label / value / progress bar / sub label,
 * fits horizontally into a row card.
 */
export function CompactMetric({ label, value, bar, status = 'good', sub }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 4,
        }}
      >
        <Etch>{label}</Etch>
        <span
          className="mono tnum"
          style={{ fontSize: 11, color: 'var(--fg-0)', fontWeight: 500 }}
        >
          {value}
        </span>
      </div>
      <ProgressBar value={bar ?? 0} status={status} height={3} />
      {sub && (
        <span
          style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            color: 'var(--fg-3)',
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {sub}
        </span>
      )}
    </div>
  )
}
