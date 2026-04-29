import type { ReactNode } from 'react'
import { Etch } from '@/components/atoms/Etch'
import { Numeric } from '@/components/atoms/Numeric'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { Sparkline } from '@/components/charts/Sparkline'
import { contentFs } from '@/utils/fontScale'
import { useIsMobile, useIsNarrow } from '@/hooks/useMediaQuery'

export interface HeroStat {
  label: string
  code: string
  value: ReactNode
  unit?: string
  /** Positive = green up arrow, negative = red down arrow */
  delta?: number
  deltaUnit?: string
  spark?: number[]
  sparkColor?: string
}

interface Props {
  stats: HeroStat[]
}

/**
 * HeroStats — top-of-page metric strip.
 * Each cell: etched label + serial code, big numeric value with optional delta,
 * optional sparkline at the bottom. Cells share a single card frame.
 *
 * Responsive:
 * - desktop: N columns (1fr each)
 * - tablet (md): 2 columns when stats.length >= 3
 * - phone (sm / narrow): 1 column, AND each cell flips to a side-by-side
 *   layout (label/value left, sparkline filling remaining width right).
 *   Without the side-by-side flip the sparkline was a fixed 140px in a
 *   ~350px viewport, leaving giant blank gutters on the right of every card.
 *
 * The borderRight separator switches off on the rightmost cell of each row,
 * and a bottom hairline is added between rows when wrapping so the
 * precision-card look survives column changes.
 */
export function HeroStats({ stats }: Props) {
  const isMobile = useIsMobile()
  const isNarrow = useIsNarrow()

  // Pick a column count that doesn't crush the numbers. 4-stat strips
  // collapse to 2x2 on mobile, then 1 column on narrow phones.
  const cols = isNarrow ? 1 : isMobile && stats.length >= 3 ? 2 : stats.length
  const valueSize = isNarrow ? 22 : isMobile ? 24 : 26

  return (
    <div
      className="precision-card"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        overflow: 'hidden',
      }}
    >
      {stats.map((s, i) => {
        // Column position within the current row → decides whether the
        // right-edge separator is needed. Last column of each row drops it.
        const colIdx = i % cols
        const isLastInRow = colIdx === cols - 1
        const isLast = i === stats.length - 1
        // Bottom hairline between rows when we're stacked. The last row
        // skips it (the precision-card frame already provides a base edge).
        const rowIdx = Math.floor(i / cols)
        const totalRows = Math.ceil(stats.length / cols)
        const needsBottomBorder = cols < stats.length && rowIdx < totalRows - 1
        // Single-column (narrow) layout reflows: label/value on the left,
        // sparkline filling the remaining width on the right. Otherwise
        // user sees a stack of half-empty cards (right side blank because
        // the SVG was a fixed 140px in a viewport that's 350+).
        const sideBySide = !!(isNarrow && s.spark)
        return (
          <div
            key={i}
            style={{
              padding: isMobile ? '12px 14px' : '14px 18px',
              borderRight: !isLast && !isLastInRow ? '1px solid var(--edge-engrave)' : 'none',
              borderBottom: needsBottomBorder ? '1px solid var(--edge-engrave)' : 'none',
              position: 'relative',
              display: sideBySide ? 'grid' : 'flex',
              gridTemplateColumns: sideBySide ? 'auto minmax(0, 1fr)' : undefined,
              flexDirection: sideBySide ? undefined : 'column',
              alignItems: sideBySide ? 'center' : undefined,
              columnGap: sideBySide ? 14 : undefined,
              gap: sideBySide ? undefined : 6,
              minWidth: 0,
            }}
          >
            {/* Top hairline highlight — only on the first row to avoid
                doubling up against the row-separator border. */}
            {rowIdx === 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 1,
                  background: 'var(--edge-bright)',
                }}
              />
            )}
            <div
              style={
                sideBySide
                  ? { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }
                  : { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }
              }
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <Etch>{s.label}</Etch>
                {!sideBySide && <SerialPlate>{s.code}</SerialPlate>}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                <Numeric value={s.value} unit={s.unit} size={valueSize} weight={500} />
                {s.delta != null && (
                  <span
                    style={{
                      fontSize: contentFs(10),
                      fontFamily: 'var(--font-mono)',
                      color: s.delta >= 0 ? 'var(--signal-good)' : 'var(--signal-bad)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                      flexShrink: 0,
                    }}
                  >
                    {s.delta >= 0 ? '▲' : '▼'} {Math.abs(s.delta).toFixed(1)}
                    {s.deltaUnit ?? '%'}
                  </span>
                )}
              </div>
            </div>
            {s.spark && (
              <Sparkline
                data={s.spark}
                width={isMobile ? 140 : 180}
                height={sideBySide ? 36 : 22}
                color={s.sparkColor ?? 'var(--accent)'}
                fillOpacity={0.15}
                thickness={1.2}
                responsive={sideBySide}
              />
            )}
            {/* In side-by-side mode the serial code is hidden in the header
                row to save horizontal space; pin it to the top-right corner
                so the precision-card frame doesn't lose its M01/M02/...
                identity entirely. */}
            {sideBySide && (
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 12,
                }}
              >
                <SerialPlate>{s.code}</SerialPlate>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
