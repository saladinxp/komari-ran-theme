import { memo } from 'react'
import { formatBytes } from '@/utils/format'
import { formatTrafficPercent, trafficColor, type TrafficQuota } from '@/utils/traffic'

/**
 * TrafficBar — usage against Komari's per-node traffic threshold.
 *
 * Rendered only when a threshold is configured; the caller passes undefined
 * otherwise and nothing appears (matching Komari's "0 = disabled" contract).
 *
 * The percent label sits centred on the track. When the fill is a sliver the
 * label would land on the dark trough, so it stays a light grey; once the
 * fill grows past the label it is knocked out against the colored bar
 * instead. That keeps it legible at 0.04% and at 96% alike.
 */
type Variant = 'grid' | 'compact'

function TrafficBar_({ quota, variant = 'grid' }: { quota: TrafficQuota; variant?: Variant }) {
  const compact = variant === 'compact'
  const color = trafficColor(quota.level)
  const pctText = formatTrafficPercent(quota.percent)
  const usedText = formatBytes(quota.used)
  const limitText = formatBytes(quota.limit)

  // Once the fill covers the centred label, invert it for contrast.
  const knockout = quota.ratio > 0.55
  const labelColor = knockout ? 'var(--bg-0)' : 'var(--fg-2)'

  const height = compact ? 11 : 13
  const fontSize = compact ? 8 : 9

  return (
    <div>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: 'var(--fg-3)', letterSpacing: '0.1em' }}>流量阈值</span>
          <span
            style={{
              fontSize: 8,
              color: 'var(--fg-3)',
              marginLeft: 5,
              border: '0.5px solid var(--bg-4)',
              borderRadius: 2,
              padding: '0 3px',
            }}
          >
            {quota.mode === 'sum' ? '求和' : '取最大'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-2)' }}>
            {usedText}
            <span style={{ color: 'var(--fg-3)' }}> / </span>
            {limitText}
          </span>
        </div>
      )}

      <div
        style={{
          position: 'relative',
          height,
          background: 'var(--bg-inset)',
          border: `0.5px solid ${quota.level === 'crit' ? color : 'var(--bg-3)'}`,
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${quota.ratio * 100}%`,
            minWidth: quota.used > 0 ? 2 : 0,
            background: color,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize,
            letterSpacing: '0.08em',
            color: labelColor,
            fontWeight: knockout ? 600 : 400,
            whiteSpace: 'nowrap',
          }}
        >
          {compact ? `${pctText} · ${usedText} / ${limitText}` : `${pctText} USED`}
        </div>
      </div>
    </div>
  )
}

export const TrafficBar = memo(TrafficBar_)
