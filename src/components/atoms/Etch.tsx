import type { CSSProperties, ReactNode } from 'react'

interface Props {
  children: ReactNode
  color?: string
  size?: number
  style?: CSSProperties
}

/**
 * Etch — engraved serial-plate text. Used for "FW v1.2", "SN-0421", "NODE.13".
 * Tiny, uppercase, wide-tracked, monospace, low-contrast.
 */
export function Etch({ children, color, size = 9, style }: Props) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: size,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        color: color ?? 'var(--fg-3)',
        fontWeight: 500,
        ...style,
      }}
    >
      {children}
    </span>
  )
}
