import { memo } from 'react'
import { CardFrame } from '@/components/panels/CardFrame'
import type { PingQualityStat } from '@/api/rpc2'
import { contentFs } from '@/utils/fontScale'

/**
 * NetworkQualityPanel — latency distribution, not just its mean.
 *
 * A mean hides the failure mode that actually hurts: a route averaging 46ms
 * with a 312ms p99 stutters badly, while a steady 50ms does not. Komari 1.2.6
 * computes p50/p99/stddev server-side, so the shape of the distribution is
 * finally free to show.
 *
 * `p99_p50_ratio` from the API is a RELATIVE EXCESS — (p99-p50)/p50 — not a
 * multiple. 0.004 means p99 sits 0.4% above p50 (rock steady); 1.0 means it is
 * double. Rendered as a percentage so the number cannot be misread as "×".
 */

/** Jitter bands, in relative excess of p99 over p50. */
function jitterColor(ratio: number): string {
  if (ratio >= 1) return 'var(--signal-bad)' // p99 at least 2× p50
  if (ratio >= 0.3) return 'var(--signal-warn)'
  return 'var(--signal-good)'
}

function fmtMs(v?: number): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v < 10 ? v.toFixed(1) : v.toFixed(0)
}

/** Bar width: full scale at 1.0 (p99 double p50) — beyond that it pins. */
function jitterWidth(ratio: number): number {
  return Math.min(100, Math.max(2, ratio * 100))
}

function NetworkQualityPanel_({
  stats,
  code = 'NET · 09',
  windowLabel,
}: {
  stats: PingQualityStat[]
  code?: string
  windowLabel?: string
}) {
  // Aggregate headline across targets that returned valid samples.
  const valid = stats.filter((s) => s.p50 != null && s.p99 != null)
  const worst = valid.reduce<PingQualityStat | undefined>(
    (acc, s) => (acc == null || (s.p99_p50_ratio ?? 0) > (acc.p99_p50_ratio ?? 0) ? s : acc),
    undefined,
  )
  const p50 = valid.length > 0 ? Math.min(...valid.map((s) => s.p50 as number)) : undefined
  const p99 = valid.length > 0 ? Math.max(...valid.map((s) => s.p99 as number)) : undefined
  const worstRatio = worst?.p99_p50_ratio ?? 0

  const readout = (label: string, value: string, unit?: string, color?: string) => (
    <div
      className="precision-inset"
      style={{ flex: 1, padding: '7px 9px', minWidth: 0 }}
    >
      <div
        style={{
          fontSize: contentFs(8),
          color: 'var(--fg-3)',
          letterSpacing: '0.1em',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {label}
      </div>
      <div
        className="mono tnum"
        style={{
          fontSize: contentFs(15),
          fontWeight: 600,
          marginTop: 1,
          color: color ?? 'var(--fg-0)',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: contentFs(9), color: 'var(--fg-3)', marginLeft: 1 }}>{unit}</span>
        )}
      </div>
    </div>
  )

  return (
    <CardFrame title="Network Quality" code={code}>
      <div style={{ padding: '11px 12px 12px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 11 }}>
          {readout('P50', fmtMs(p50), 'ms')}
          {readout('P99', fmtMs(p99), 'ms', p99 != null && p50 != null && p99 > p50 * 2 ? 'var(--signal-warn)' : undefined)}
          {readout('抖动', `${(worstRatio * 100).toFixed(0)}%`, undefined, jitterColor(worstRatio))}
        </div>

        <div
          style={{
            fontSize: contentFs(9),
            color: 'var(--fg-3)',
            letterSpacing: '0.08em',
            marginBottom: 6,
            fontFamily: 'var(--font-mono)',
          }}
        >
          按线路 · P99 超出 P50{windowLabel ? ` · ${windowLabel}` : ''}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {stats.map((s) => {
            const id = String(s.task_id ?? s.tags?.task_id ?? '')
            const dead = s.p50 == null || (s.loss ?? 0) >= 100
            const ratio = s.p99_p50_ratio ?? 0
            const color = jitterColor(ratio)
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span
                  style={{
                    fontSize: contentFs(10),
                    color: 'var(--fg-2)',
                    width: 92,
                    flexShrink: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={s.name}
                >
                  {s.name ?? `Task ${id}`}
                </span>
                <div
                  className="precision-inset"
                  style={{ flex: 1, height: 9, position: 'relative', overflow: 'hidden' }}
                >
                  {dead ? (
                    // No valid samples — hatched, not a zero-width bar, so a
                    // dead link never reads as a perfectly stable one.
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'repeating-linear-gradient(45deg, color-mix(in srgb, var(--signal-bad) 30%, transparent) 0 4px, transparent 4px 8px)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: `${jitterWidth(ratio)}%`,
                        height: '100%',
                        background: color,
                        boxShadow: 'inset 0 1px 0 var(--edge-bright)',
                      }}
                    />
                  )}
                </div>
                <span
                  className="mono tnum"
                  style={{
                    fontSize: contentFs(10),
                    color: dead ? 'var(--signal-bad)' : color,
                    width: 40,
                    textAlign: 'right',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {dead ? '100%' : `${(ratio * 100).toFixed(0)}%`}
                </span>
              </div>
            )
          })}
        </div>

        {stats.some((s) => (s.loss ?? 0) >= 100) && (
          <div style={{ marginTop: 9, fontSize: contentFs(8), color: 'var(--fg-3)' }}>
            斜纹 = 全丢包,无有效样本
          </div>
        )}
      </div>
    </CardFrame>
  )
}

export const NetworkQualityPanel = memo(NetworkQualityPanel_)
