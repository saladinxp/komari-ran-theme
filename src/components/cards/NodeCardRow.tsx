import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { StatusDot } from '@/components/atoms/StatusDot'
import { StatusBadge } from '@/components/atoms/StatusBadge'
import { CompactMetric } from '@/components/atoms/CompactMetric'
import { Sparkline } from '@/components/charts/Sparkline'
import { contentFs } from '@/utils/fontScale'
import type { KomariNode, KomariRecord } from '@/types/komari'
import {
  formatBps,
  formatBytes,
  formatPercent,
  formatUptimeShort,
  resolveRamPercent,
} from '@/utils/format'

interface Props {
  node: KomariNode
  record?: KomariRecord
  netSpark?: number[]
  pingSpark?: number[]
}

/**
 * NodeCardRow — single-row layout. Wide horizontal: status / name+os /
 * region / CPU / MEM / DISK / NET / PING+LOSS / status badge + uptime.
 */
export function NodeCardRow({ node, record, netSpark = [], pingSpark = [] }: Props) {
  const online = record?.online === true
  const cpu = record?.cpu ?? 0
  const ramPct = resolveRamPercent(record?.memory_used, record?.memory_total) ?? 0
  const diskPct =
    record?.disk_used != null && record?.disk_total
      ? (record.disk_used / record.disk_total) * 100
      : 0

  const statusKey: 'good' | 'warn' | 'bad' = !online
    ? 'bad'
    : cpu > 80 || (record?.memory_used && ramPct > 90)
      ? 'warn'
      : 'good'

  const cpuStatus = cpu > 80 ? 'bad' : cpu > 60 ? 'warn' : 'info'
  const memStatus = ramPct > 80 ? 'bad' : ramPct > 60 ? 'warn' : 'accent'
  const diskStatus = diskPct > 80 ? 'bad' : 'warn'

  return (
    <div
      className="precision-card"
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 220px 90px 1fr 1fr 1fr 1fr 130px 100px',
        alignItems: 'center',
        padding: '12px 14px',
        gap: 14,
      }}
    >
      <StatusDot status={statusKey} pulse={statusKey === 'good'} size={7} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {node.flag && (
            <span
              style={{
                fontSize: contentFs(9),
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-bright)',
                letterSpacing: '0.12em',
              }}
            >
              {node.flag}
            </span>
          )}
          <span
            style={{
              fontSize: contentFs(13),
              fontWeight: 600,
              color: 'var(--fg-0)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={node.name}
          >
            {node.name}
          </span>
        </div>
        {(record?.os ?? node.os) && (
          <span
            style={{
              fontSize: contentFs(10),
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

      <SerialPlate>{node.region ?? '—'}</SerialPlate>

      <CompactMetric
        label="CPU"
        value={online ? `${Math.round(cpu)}%` : '—'}
        bar={online ? cpu : 0}
        status={cpuStatus}
        sub={node.cpu_cores ? `${node.cpu_cores}C` : undefined}
      />
      <CompactMetric
        label="MEM"
        value={online ? `${Math.round(ramPct)}%` : '—'}
        bar={online ? ramPct : 0}
        status={memStatus}
        sub={
          online && record?.memory_used && record?.memory_total
            ? `${formatBytes(record.memory_used)}`
            : undefined
        }
      />
      <CompactMetric
        label="DISK"
        value={online ? `${Math.round(diskPct)}%` : '—'}
        bar={online ? diskPct : 0}
        status={diskStatus}
        sub={
          online && record?.disk_total
            ? `${formatBytes(record.disk_total)}`
            : undefined
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <Etch>NET ↑/↓</Etch>
        <Sparkline data={netSpark} width={120} height={18} color="var(--accent)" thickness={1} />
        <span
          className="mono tnum"
          style={{
            fontSize: contentFs(10),
            color: 'var(--fg-1)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {online ? `${formatBps(record?.network_tx)} / ${formatBps(record?.network_rx)}` : '—'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <Etch>PING · LOSS</Etch>
        <PingMiniBar data={pingSpark.slice(0, 18)} />
        <span
          className="mono tnum"
          style={{
            fontSize: contentFs(10),
            color: 'var(--fg-1)',
            whiteSpace: 'nowrap',
          }}
        >
          {online && record?.ping != null ? `${Math.round(record.ping)}ms` : '— ms'}
          {' · '}
          {formatPercent(record?.loss, 1)}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <StatusBadge
          status={statusKey === 'good' ? 'good' : statusKey === 'warn' ? 'warn' : 'bad'}
          label={statusKey === 'good' ? 'ONLINE' : statusKey === 'warn' ? 'DEGR' : 'OFFLINE'}
          dense
        />
        <span className="mono tnum" style={{ fontSize: contentFs(10), color: 'var(--fg-2)' }}>
          UP {online ? formatUptimeShort(record?.uptime) : '—'}
        </span>
      </div>
    </div>
  )
}

function PingMiniBar({ data }: { data: number[] }) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height: 12,
          background: 'var(--bg-inset)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 1,
        }}
      />
    )
  }
  return (
    <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 12 }}>
      {data.map((v, i) => {
        const color =
          v > 200 ? 'var(--signal-bad)' : v > 100 ? 'var(--signal-warn)' : 'var(--signal-good)'
        const h = Math.max(2, Math.min(12, (v / 250) * 12 + 2))
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: h,
              background: color,
              boxShadow: `0 0 2px ${color}`,
              borderRadius: 0.5,
            }}
          />
        )
      })}
    </div>
  )
}
