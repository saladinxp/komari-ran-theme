import { memo, type ReactNode } from 'react'
import { contentFs } from '@/utils/fontScale'

/**
 * ReadoutGrid — a matrix of instrument windows sharing one recessed panel.
 *
 * The point is the shared frame: one sunken plate, subdivided by hairlines,
 * rather than N floating values. Cells then read as compartments of a single
 * gauge cluster instead of a loose stack of numbers — which is what separates
 * "instrument panel" from "list of stats".
 *
 * Dividers are drawn with a background grid (gap + a background colour showing
 * through) rather than per-cell borders, so interior lines never double up and
 * the outer edge stays clean regardless of how many cells there are.
 */
export interface Readout {
  label: string
  value: ReactNode
  /** Optional secondary line — units, totals, model names. */
  sub?: ReactNode
  /** Value colour; defaults to the primary foreground. */
  color?: string
}

function ReadoutGrid_({
  items,
  columns = 2,
  dense = false,
}: {
  items: Readout[]
  columns?: number
  /** Tighter padding for side panels and narrow cards. */
  dense?: boolean
}) {
  const pad = dense ? '7px 9px' : '9px 11px'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        // The gap *is* the divider: the frame colour shows through the 1px
        // seam between cells.
        gap: 1,
        background: 'var(--edge-engrave)',
        border: 'var(--hairline) solid var(--edge-engrave)',
        borderRadius: 'var(--radius-sm)',
        // Recession comes from the shading, NOT from a darker fill. --bg-inset
        // is sized for slivers like a progress trough; spread across a whole
        // panel it just reads as a dirty patch stuck onto the card. The cells
        // stay near the card's own tone and let the inset shadow do the work.
        boxShadow: 'var(--shadow-inset)',
        overflow: 'hidden',
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            background: 'var(--bg-2)',
            padding: pad,
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: contentFs(8),
              letterSpacing: '0.12em',
              color: 'var(--fg-3)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {it.label}
          </div>
          <div
            className="mono tnum"
            style={{
              fontSize: contentFs(dense ? 12 : 13),
              fontWeight: 600,
              marginTop: 2,
              color: it.color ?? 'var(--fg-0)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {it.value}
          </div>
          {it.sub && (
            <div
              style={{
                fontSize: contentFs(8),
                color: 'var(--fg-3)',
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {it.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export const ReadoutGrid = memo(ReadoutGrid_)
