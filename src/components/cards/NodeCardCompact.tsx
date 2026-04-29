import { Etch } from '@/components/atoms/Etch'
import { StatusDot } from '@/components/atoms/StatusDot'
import { Sparkline } from '@/components/charts/Sparkline'
import type { KomariNode, KomariRecord, NodeStatus } from '@/types/komari'
import { formatBps, formatBytes, formatPercent, formatUptimeShort, parseLabels, daysUntil } from '@/utils/format'
import { contentFs } from '@/utils/fontScale'

interface Props {
  node: KomariNode
  record?: KomariRecord
  netSpark?: number[]
  pingSpark?: number[]
}

const COLOR_BY_STATUS: Record<NodeStatus, string> = {
  good: 'var(--signal-good)',
  warn: 'var(--signal-warn)',
  bad: 'var(--signal-bad)',
}

function deriveStatus(r?: KomariRecord): NodeStatus {
  if (!r || r.online === false) return 'bad'
  if ((r.cpu ?? 0) > 80 || (r.loss ?? 0) > 5) return 'warn'
  return 'good'
}

/** Block meter — segmented bar with subtle glow on filled blocks. */
function BlockMeter({ value, blocks = 20, color = 'var(--accent)' }: { value: number; blocks?: number; color?: string }) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * blocks)
  return (
    <div style={{ display: 'flex', gap: 1.5 }}>
      {Array.from({ length: blocks }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 6,
            background: i < filled ? color : 'var(--bg-inset)',
            border: '1px solid var(--edge-engrave)',
            borderRadius: 1,
            boxShadow: i < filled ? `0 0 3px ${color}` : 'none',
            opacity: i < filled ? 0.95 : 0.6,
          }}
        />
      ))}
    </div>
  )
}

function MetricCell({
  label,
  percent,
  sub,
  color,
}: {
  label: string
  percent: number | undefined
  sub?: string
  color: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Etch>{label}</Etch>
        <span className="mono tnum" style={{ fontSize: contentFs(12), color: 'var(--fg-0)', fontWeight: 500 }}>
          {percent != null ? Math.round(percent) : '—'}
          <span style={{ fontSize: contentFs(9), color: 'var(--fg-2)', marginLeft: 1 }}>%</span>
        </span>
      </div>
      {sub && (
        <span
          style={{
            fontSize: contentFs(10),
            color: 'var(--fg-2)',
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={sub}
        >
          {sub}
        </span>
      )}
      <BlockMeter value={percent ?? 0} color={color} />
    </div>
  )
}

export function NodeCardCompact({ node, record, netSpark = [], pingSpark = [] }: Props) {
  const status = deriveStatus(record)
  const offline = status === 'bad'
  const statusColor = COLOR_BY_STATUS[status]
  const labels = parseLabels(node.tags)

  // mem percent: prefer used/total, else direct cpu... no, only mem
  const memPct =
    record?.memory_used != null && record.memory_total
      ? (record.memory_used / record.memory_total) * 100
      : undefined

  const diskPct =
    record?.disk_used != null && record.disk_total
      ? (record.disk_used / record.disk_total) * 100
      : undefined

  const days = daysUntil(node.expired_at)
  const cpuModel = record?.cpu_model || node.cpu_name || node.cpu_model

  return (
    <div
      className="precision-card"
      style={{
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        position: 'relative',
        overflow: 'hidden',
        opacity: offline ? 0.7 : 1,
      }}
    >
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {node.region && (
              <span
                style={{
                  fontSize: contentFs(9),
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-bright)',
                  letterSpacing: '0.12em',
                }}
              >
                {node.region}
              </span>
            )}
            <span
              style={{
                fontSize: contentFs(13),
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: 'var(--fg-0)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={node.name ?? node.uuid}
            >
              {node.name ?? node.uuid.slice(0, 8)}
            </span>
          </div>
          {(record?.os || node.os) && (
            <span
              style={{
                fontSize: contentFs(9.5),
                fontFamily: 'var(--font-mono)',
                color: 'var(--fg-3)',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={record?.os ?? node.os}
            >
              {record?.os ?? node.os}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <StatusDot status={status} size={6} pulse={status === 'good'} />
          <Etch>{status === 'good' ? 'ONLINE' : status === 'warn' ? 'DEGRADED' : 'OFFLINE'}</Etch>
        </div>
      </div>

      <div className="seam" />

      {/* CPU + RAM */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <MetricCell
          label="CPU"
          percent={offline ? undefined : record?.cpu}
          sub={cpuModel ?? `${node.cpu_cores ?? '—'} 核`}
          color="var(--signal-info)"
        />
        <MetricCell
          label="内存"
          percent={offline ? undefined : memPct}
          sub={
            offline
              ? '—'
              : record?.memory_total
                ? `${formatBytes(record.memory_used)} / ${formatBytes(record.memory_total)}`
                : undefined
          }
          color="var(--accent)"
        />
      </div>

      {/* DISK + LOAD */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <MetricCell
          label="磁盘"
          percent={offline ? undefined : diskPct}
          sub={
            offline
              ? '—'
              : record?.disk_total
                ? `${formatBytes(record.disk_used)} / ${formatBytes(record.disk_total)}`
                : undefined
          }
          color="var(--signal-warn)"
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Etch>负载</Etch>
            <span className="mono tnum" style={{ fontSize: contentFs(12), color: 'var(--fg-0)', fontWeight: 500 }}>
              {offline ? '—' : record?.load1 != null ? record.load1.toFixed(2) : '—'}
            </span>
          </div>
          <span style={{ fontSize: contentFs(10), color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>
            {offline
              ? '1m / 5m / 15m'
              : `${(record?.load1 ?? 0).toFixed(2)} / ${(record?.load5 ?? 0).toFixed(2)} / ${(record?.load15 ?? 0).toFixed(2)}`}
          </span>
          <BlockMeter value={offline ? 0 : Math.min(100, (record?.load1 ?? 0) * 30)} color="var(--signal-good)" />
        </div>
      </div>

      <div className="seam" />

      {/* up/down */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: contentFs(11), color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)' }}>↑ 上行</span>
            <span className="mono tnum" style={{ fontSize: contentFs(11), color: 'var(--fg-0)' }}>
              {formatBps(record?.network_tx)}
            </span>
          </div>
          <Sparkline data={netSpark} width={150} height={14} color="var(--accent)" thickness={1} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: contentFs(11), color: 'var(--signal-good)', fontFamily: 'var(--font-mono)' }}>↓ 下行</span>
            <span className="mono tnum" style={{ fontSize: contentFs(11), color: 'var(--fg-0)' }}>
              {formatBps(record?.network_rx)}
            </span>
          </div>
          <Sparkline
            data={netSpark.slice().reverse()}
            width={150}
            height={14}
            color="var(--signal-good)"
            thickness={1}
          />
        </div>
      </div>

      {/* total traffic */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: contentFs(11) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>出站</span>
          <span className="mono tnum" style={{ color: 'var(--fg-0)' }}>{formatBytes(record?.network_total_up)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>入站</span>
          <span className="mono tnum" style={{ color: 'var(--fg-0)' }}>{formatBytes(record?.network_total_down)}</span>
        </div>
      </div>

      {/* ping + loss */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: contentFs(11), color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>延迟</span>
            <span className="mono tnum" style={{ fontSize: contentFs(12), color: statusColor }}>
              {record?.ping != null ? Math.round(record.ping) : '—'}
              <span style={{ fontSize: contentFs(9), color: 'var(--fg-2)', marginLeft: 1 }}>ms</span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: contentFs(11), color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>丢包率</span>
            <span
              className="mono tnum"
              style={{
                fontSize: contentFs(12),
                color: (record?.loss ?? 0) > 1 ? 'var(--signal-warn)' : 'var(--signal-good)',
              }}
            >
              {formatPercent(record?.loss, 1)}
            </span>
          </div>
        </div>
        <PingBar data={pingSpark} />
      </div>

      <div className="seam" />

      {/* footer */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: contentFs(11) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>到期</span>
          <span className="mono tnum" style={{ color: 'var(--fg-1)' }}>{days != null ? `${days} 天` : '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>在线</span>
          <span className="mono tnum" style={{ color: 'var(--accent-bright)' }}>{formatUptimeShort(record?.uptime)}</span>
        </div>
      </div>

      {(labels.bandwidth || labels.traffic) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {labels.bandwidth && <Etch color="var(--signal-info)">{labels.bandwidth.value}</Etch>}
          {labels.traffic && <Etch color="var(--accent-bright)">{labels.traffic.value}</Etch>}
        </div>
      )}
    </div>
  )
}

/** Static ping bar with subtle glow per bar. */
function PingBar({ data }: { data: number[] }) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height: 14,
          background: 'var(--bg-inset)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 1,
        }}
      />
    )
  }
  return (
    <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 14 }}>
      {data.map((v, i) => {
        const color = v > 200 ? 'var(--signal-bad)' : v > 100 ? 'var(--signal-warn)' : 'var(--signal-good)'
        const h = Math.max(3, Math.min(14, (v / 250) * 14 + 3))
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: h,
              background: color,
              boxShadow: `0 0 3px ${color}`,
              borderRadius: 0.5,
            }}
          />
        )
      })}
    </div>
  )
}
