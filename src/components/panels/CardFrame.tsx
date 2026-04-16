import type { CSSProperties, ReactNode } from 'react'
import { SerialPlate } from '@/components/atoms/SerialPlate'

interface Props {
  title: string
  code?: string
  action?: ReactNode
  children: ReactNode
  /** Remove inner padding (for tables / lists that fill edge-to-edge) */
  inset?: boolean
  style?: CSSProperties
}

/**
 * CardFrame — chamfered card with a title rail at the top.
 * Used for the bottom rail of the Overview page (Alerts / Ping / Traffic).
 */
export function CardFrame({ title, code, action, children, inset = false, style }: Props) {
  return (
    <div
      className="precision-card"
      style={{ display: 'flex', flexDirection: 'column', ...style }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--edge-engrave)',
          background: 'var(--bg-1)',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: 'var(--fg-0)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </span>
          {code && <SerialPlate>{code}</SerialPlate>}
        </div>
        {action}
      </div>
      <div style={{ padding: inset ? 0 : 14, flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}
