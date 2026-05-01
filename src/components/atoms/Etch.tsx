import type { CSSProperties, ReactNode } from 'react'

interface Props {
  children: ReactNode
  color?: string
  size?: number
  style?: CSSProperties
}

/**
 * Etch — engraved serial-plate text. Used for "FW v1.2", "SN-0421", "NODE.13".
 * Tiny, uppercase, wide-tracked, monospace.
 * v2: weight 600 + AA-grade fg-2 default (matches .etch CSS class and design
 * spec). Callers can override color for de-emphasized variants. No text-shadow
 * — at 9px the shadow blurs rather than engraves.
 */
export function Etch({ children, color, size = 9, style }: Props) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: size,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        color: color ?? 'var(--fg-2)',
        fontWeight: 600,
        ...style,
      }}
    >
      {children}
    </span>
  )
}
