import type { ReactNode } from 'react'
import { Etch } from '@/components/atoms/Etch'
import { Numeric } from '@/components/atoms/Numeric'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { Sparkline } from '@/components/charts/Sparkline'

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
 */
export function HeroStats({ stats }: Props) {
  return (
    <div
      className="precision-card"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
        overflow: 'hidden',
      }}
    >
      {stats.map((s, i) => (
        <div
          key={i}
          style={{
            padding: '14px 18px',
            borderRight: i < stats.length - 1 ? '1px solid var(--edge-engrave)' : 'none',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minWidth: 0,
          }}
        >
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <Etch>{s.label}</Etch>
            <SerialPlate>{s.code}</SerialPlate>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <Numeric value={s.value} unit={s.unit} size={26} weight={500} />
            {s.delta != null && (
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: s.delta >= 0 ? 'var(--signal-good)' : 'var(--signal-bad)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                {s.delta >= 0 ? '▲' : '▼'} {Math.abs(s.delta).toFixed(1)}
                {s.deltaUnit ?? '%'}
              </span>
            )}
          </div>
          {s.spark && (
            <Sparkline
              data={s.spark}
              width={180}
              height={22}
              color={s.sparkColor ?? 'var(--accent)'}
              fillOpacity={0.15}
              thickness={1.2}
            />
          )}
        </div>
      ))}
    </div>
  )
}
