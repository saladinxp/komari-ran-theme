import type { ReactNode } from 'react'

interface Props {
  value: ReactNode
  unit?: string
  size?: number
  weight?: number
  color?: string
  unitColor?: string
}

/**
 * Numeric — tabular monospace value with optional unit suffix.
 * Unit is automatically scaled smaller (~45% of value size) and dimmed.
 */
export function Numeric({
  value,
  unit,
  size = 24,
  weight = 500,
  color = 'var(--fg-0)',
  unitColor = 'var(--fg-2)',
}: Props) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: size,
        fontWeight: weight,
        color,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em',
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
      }}
    >
      {value}
      {unit && (
        <span
          style={{
            fontSize: size * 0.45,
            color: unitColor,
            fontWeight: 400,
            letterSpacing: '0.06em',
          }}
        >
          {unit}
        </span>
      )}
    </span>
  )
}
