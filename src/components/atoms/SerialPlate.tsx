import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

/**
 * SerialPlate — small etched plaque, like the SN/FW stamp on hi-fi gear.
 * Used inline next to titles and for technical metadata.
 */
export function SerialPlate({ children }: Props) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        color: 'var(--fg-2)',
        padding: '2px 6px',
        background: 'var(--bg-1)',
        border: '1px solid var(--edge-engrave)',
        borderRadius: 2,
        boxShadow: 'inset 0 1px 0 var(--edge-deep)',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
