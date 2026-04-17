import { useMemo } from 'react'
import { Sidebar } from '@/components/panels/Sidebar'
import { Topbar } from '@/components/panels/Topbar'
import { CardFrame } from '@/components/panels/CardFrame'
import { Footer } from '@/components/panels/Footer'
import { Etch } from '@/components/atoms/Etch'
import { Numeric } from '@/components/atoms/Numeric'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { StatusBadge } from '@/components/atoms/StatusBadge'
import { ProgressBar } from '@/components/atoms/ProgressBar'
import { Sparkline } from '@/components/charts/Sparkline'
import type { KomariNode, KomariRecord } from '@/types/komari'
import {
  formatBps,
  formatBytes,
  formatPercent,
  formatUptime,
  parseLabels,
  daysUntil,
  resolveRamPercent,
} from '@/utils/format'
import { genSeries } from '@/utils/series'
import { hashFor } from '@/router/route'

type Theme = 'ran-night' | 'ran-mist'
type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'

interface Props {
  uuid: string
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  theme: Theme
  onTheme: (t: Theme) => void
  conn?: Conn
  siteName?: string
}

export function NodeDetailPage({
  uuid,
  nodes,
  records,
  theme,
  onTheme,
  conn = 'idle',
  siteName = '岚 · Komari',
}: Props) {
  const node = useMemo(() => nodes.find((n) => n.uuid === uuid), [nodes, uuid])
  const record = node ? records[node.uuid] : undefined
  const labels = node ? parseLabels(node.tags) : { raw: [] }

  if (!node) {
    return (
      <div
        style={{
          display: 'flex',
          background: 'var(--bg-0)',
          color: 'var(--fg-0)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <Sidebar active="nodes" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Topbar
            title={siteName}
            subtitle="UNKNOWN PROBE"
            theme={theme}
            onTheme={onTheme}
            online={0}
            total={0}
            conn={conn}
          />
          <main style={{ flex: 1, padding: 20 }}>
            <CardFrame title="Node not found" code="404">
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--fg-2)',
                    fontSize: 12,
                    letterSpacing: '0.1em',
                    marginBottom: 16,
                  }}
                >
                  PROBE [{uuid.slice(0, 8)}…] NOT IN ROSTER
                </div>
                <a
                  href={hashFor({ name: 'nodes' })}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--accent-bright)',
                    letterSpacing: '0.1em',
                  }}
                >
                  ← BACK TO NODES
                </a>
              </div>
            </CardFrame>
          </main>
          <Footer />
        </div>
      </div>
    )
  }

  const online = record?.online === true
  const cpu = record?.cpu ?? 0
  const ramPct = resolveRamPercent(record?.memory_used, record?.memory_total) ?? 0
  const diskPct =
    record?.disk_used != null && record?.disk_total
      ? (record.disk_used / record.disk_total) * 100
      : 0
  const days = daysUntil(node.expired_at)

  const status: 'good' | 'warn' | 'bad' = !online
    ? 'bad'
    : cpu > 80 || ramPct > 90
      ? 'warn'
      : 'good'

  const subtitle = `${node.region ?? '—'} · ${node.ip ?? '—'} · UP ${online ? formatUptime(record?.uptime) : '—'}`

  // Stats are derived from the live record only; history charts use mock for now.
  // (TODO v0.5: pull real history from /api/records/load?uuid=…)
  const seed = hashSeed(uuid)
  const cpuHist = genSeries(60, seed + 1, cpu || 30, 25)
  const memHist = genSeries(60, seed + 2, ramPct || 50, 15)
  const netUpHist = genSeries(60, seed + 3, 50, 35)
  const netDownHist = genSeries(60, seed + 4, 60, 35)

  // Specs strip
  const specs = [
    {
      label: 'CPU',
      value: node.cpu_name ?? record?.cpu_model ?? '—',
      sub: node.cpu_cores ? `${node.cpu_cores}-CORE` : undefined,
    },
    {
      label: 'MEMORY',
      value: record?.memory_total ? formatBytes(record.memory_total) : '—',
      sub: record?.swap_total ? `SWAP ${formatBytes(record.swap_total)}` : undefined,
    },
    {
      label: 'STORAGE',
      value: record?.disk_total ? formatBytes(record.disk_total) : '—',
      sub: undefined,
    },
    {
      label: 'NETWORK',
      value: labels.bandwidth?.value ?? '—',
      sub: labels.traffic ? `LIMIT ${labels.traffic.value}` : undefined,
    },
    {
      label: 'OS',
      value: (record?.os ?? node.os ?? '—').split('·')[0].trim(),
      sub: node.arch ?? undefined,
    },
    {
      label: 'EXPIRE',
      value: days != null ? `${days} 天` : '—',
      sub: node.price != null ? `$${node.price}/月` : undefined,
    },
  ]

  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--bg-0)',
        color: 'var(--fg-0)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Sidebar active="nodes" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          title={`${node.flag ?? ''} ${node.name}`}
          subtitle={subtitle}
          theme={theme}
          onTheme={onTheme}
          online={online ? 1 : 0}
          total={1}
          conn={conn}
        />

        <main style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Back link + status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <a
              href={hashFor({ name: 'nodes' })}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--fg-2)',
                letterSpacing: '0.14em',
                textDecoration: 'none',
                textTransform: 'uppercase',
              }}
            >
              ← All nodes
            </a>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <SerialPlate>UUID · {uuid.slice(0, 8).toUpperCase()}</SerialPlate>
              <StatusBadge
                status={status}
                label={status === 'good' ? 'ONLINE' : status === 'warn' ? 'DEGRADED' : 'OFFLINE'}
              />
            </div>
          </div>

          {/* Specs strip */}
          <div
            className="precision-card"
            style={{
              padding: 14,
              display: 'grid',
              gridTemplateColumns: `repeat(${specs.length}, 1fr)`,
            }}
          >
            {specs.map((s, i) => (
              <div
                key={s.label}
                style={{
                  padding: '6px 12px',
                  borderRight:
                    i < specs.length - 1 ? '1px solid var(--edge-engrave)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  minWidth: 0,
                }}
              >
                <Etch>{s.label}</Etch>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '-0.01em',
                    color: 'var(--fg-0)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={String(s.value)}
                >
                  {s.value}
                </span>
                {s.sub && <Etch size={8}>{s.sub}</Etch>}
              </div>
            ))}
          </div>

          {/* Live metrics row */}
          <div
            className="precision-card"
            style={{
              padding: '16px 20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 24,
            }}
          >
            <BigMetric
              label="CPU"
              value={online ? Math.round(cpu) : '—'}
              unit="%"
              progress={online ? cpu : 0}
              status={cpu > 80 ? 'bad' : cpu > 60 ? 'warn' : 'good'}
            />
            <BigMetric
              label="MEMORY"
              value={online ? Math.round(ramPct) : '—'}
              unit="%"
              progress={online ? ramPct : 0}
              status={ramPct > 80 ? 'bad' : ramPct > 60 ? 'warn' : 'good'}
              sub={
                online && record?.memory_used && record?.memory_total
                  ? `${formatBytes(record.memory_used)} / ${formatBytes(record.memory_total)}`
                  : undefined
              }
            />
            <BigMetric
              label="DISK"
              value={online ? Math.round(diskPct) : '—'}
              unit="%"
              progress={online ? diskPct : 0}
              status={diskPct > 85 ? 'bad' : diskPct > 70 ? 'warn' : 'good'}
              sub={
                online && record?.disk_used && record?.disk_total
                  ? `${formatBytes(record.disk_used)} / ${formatBytes(record.disk_total)}`
                  : undefined
              }
            />
            <BigMetric
              label="LOAD AVG"
              value={online && record?.load1 != null ? record.load1.toFixed(2) : '—'}
              unit=""
              progress={online ? Math.min(100, (record?.load1 ?? 0) * 30) : 0}
              status={(record?.load1 ?? 0) > 4 ? 'bad' : (record?.load1 ?? 0) > 2 ? 'warn' : 'good'}
              sub={
                online && record?.load1 != null
                  ? `${record.load1.toFixed(2)} / ${record.load5?.toFixed(2) ?? '—'} / ${record.load15?.toFixed(2) ?? '—'}`
                  : undefined
              }
            />
            <BigMetric
              label="NETWORK"
              value={online ? formatBps(record?.network_tx).split(' ')[0] : '—'}
              unit={online ? formatBps(record?.network_tx).split(' ')[1] : ''}
              progress={undefined}
              status="good"
              sub={
                online
                  ? `↑ ${formatBps(record?.network_tx)} / ↓ ${formatBps(record?.network_rx)}`
                  : undefined
              }
            />
          </div>

          {/* Charts grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: 16,
            }}
          >
            <CardFrame title="CPU · 1H" code="C · 01" action={<Etch>SAMPLE 5S</Etch>}>
              <Sparkline
                data={cpuHist}
                width={400}
                height={120}
                color="var(--accent)"
                fillOpacity={0.18}
                showBaseline
                thickness={1.4}
              />
            </CardFrame>
            <CardFrame title="Memory · 1H" code="C · 02">
              <Sparkline
                data={memHist}
                width={400}
                height={120}
                color="var(--signal-info)"
                fillOpacity={0.18}
                showBaseline
                thickness={1.4}
              />
            </CardFrame>
            <CardFrame title="Network ↑ · 1H" code="C · 03" action={<Etch>BYTES/S</Etch>}>
              <Sparkline
                data={netUpHist}
                width={400}
                height={120}
                color="var(--accent-bright)"
                fillOpacity={0.18}
                showBaseline
                thickness={1.4}
              />
            </CardFrame>
            <CardFrame title="Network ↓ · 1H" code="C · 04" action={<Etch>BYTES/S</Etch>}>
              <Sparkline
                data={netDownHist}
                width={400}
                height={120}
                color="var(--signal-good)"
                fillOpacity={0.18}
                showBaseline
                thickness={1.4}
              />
            </CardFrame>
          </div>

          {/* Connections + Traffic totals */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            <CardFrame title="Connections" code="P · 11">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <ConnRow label="TCP" value={record?.tcp ?? '—'} />
                <div style={{ borderTop: '1px solid var(--edge-engrave)' }} />
                <ConnRow label="UDP" value={record?.udp ?? '—'} />
                <div style={{ borderTop: '1px solid var(--edge-engrave)' }} />
                <ConnRow label="PROCESSES" value={record?.process ?? '—'} />
              </div>
            </CardFrame>
            <CardFrame title="Traffic Total" code="T · 11" action={<Etch>SINCE BOOT</Etch>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <ConnRow
                  label="↑ TX"
                  value={online ? formatBytes(record?.network_total_up) : '—'}
                />
                <div style={{ borderTop: '1px solid var(--edge-engrave)' }} />
                <ConnRow
                  label="↓ RX"
                  value={online ? formatBytes(record?.network_total_down) : '—'}
                />
              </div>
            </CardFrame>
            <CardFrame title="Latency" code="L · 11">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <ConnRow
                  label="LATENCY"
                  value={online && record?.ping != null ? `${Math.round(record.ping)} ms` : '—'}
                />
                <div style={{ borderTop: '1px solid var(--edge-engrave)' }} />
                <ConnRow
                  label="PACKET LOSS"
                  value={formatPercent(record?.loss, 1)}
                />
              </div>
            </CardFrame>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

interface BigMetricProps {
  label: string
  value: number | string
  unit: string
  progress?: number
  status: 'good' | 'warn' | 'bad'
  sub?: string
}

function BigMetric({ label, value, unit, progress, status, sub }: BigMetricProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <Etch>{label}</Etch>
      <Numeric value={value} unit={unit} size={28} weight={500} />
      {progress != null && <ProgressBar value={progress} status={status} height={4} />}
      {sub && (
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: 'var(--fg-3)',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={sub}
        >
          {sub}
        </span>
      )}
    </div>
  )
}

function ConnRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <Etch>{label}</Etch>
      <Numeric value={value} size={16} weight={500} />
    </div>
  )
}

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
