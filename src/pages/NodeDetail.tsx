import { useMemo, useState } from 'react'
import { Sidebar } from '@/components/panels/Sidebar'
import { Topbar } from '@/components/panels/Topbar'
import { CardFrame } from '@/components/panels/CardFrame'
import { Footer } from '@/components/panels/Footer'
import { Etch } from '@/components/atoms/Etch'
import { Numeric } from '@/components/atoms/Numeric'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { StatusBadge } from '@/components/atoms/StatusBadge'
import { StatusDot } from '@/components/atoms/StatusDot'
import { Tabs } from '@/components/atoms/Tabs'
import { AreaChart } from '@/components/charts/AreaChart'
import { PingChart } from '@/components/charts/PingChart'
import { RadialGauge } from '@/components/charts/RadialGauge'
import type { KomariNode, KomariRecord } from '@/types/komari'
import {
  formatBytes,
  formatPercent,
  formatUptime,
  parseLabels,
  daysUntil,
  resolveRamPercent,
} from '@/utils/format'
import { bucketLoadHistory, hasLoadData } from '@/utils/load'
import { aggregatePingByTarget, hasPingData } from '@/utils/ping'
import { useNodeHistory } from '@/hooks/useNodeHistory'
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
  lastUpdate?: number | null
  siteName?: string
}

export function NodeDetailPage({
  uuid,
  nodes,
  records,
  theme,
  onTheme,
  conn = 'idle',
  lastUpdate,
  siteName = '岚 · Komari',
}: Props) {
  // Hooks must be called before any early return.
  const history = useNodeHistory(uuid, 1)
  const [tab, setTab] = useState<'overview' | 'latency'>('overview')

  const node = useMemo(() => nodes.find((n) => n.uuid === uuid), [nodes, uuid])
  const record = node ? records[node.uuid] : undefined
  const labels = node ? parseLabels(node.tags) : { raw: [] }

  // Bucketed real history (zero-filled when there's no data yet).
  const buckets = useMemo(() => bucketLoadHistory(history.load, 60), [history.load])
  const pingTargets = useMemo(
    () => (hasPingData(history.ping) ? aggregatePingByTarget(history.ping, 60, 60 * 60 * 1000, 6) : []),
    [history.ping],
  )
  const pingSeries = useMemo(
    () => pingTargets.map((t) => ({ data: t.data, label: t.task.name })),
    [pingTargets],
  )

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
            lastUpdate={lastUpdate}
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

  // Global stats for the topbar (so it shows network-wide online count, not 1/1).
  const globalOnline = useMemo(() => {
    let n = 0
    for (const x of nodes) if (records[x.uuid]?.online) n++
    return n
  }, [nodes, records])

  const haveLoadHistory = hasLoadData(history.load)
  const cpuHist = buckets.cpu
  const memHist = buckets.ram
  const netUpHist = buckets.netOut
  const netDownHist = buckets.netIn

  // Specs strip
  // Try to extract kernel from os string (e.g. "Debian GNU/Linux 13 · 6.1.0-26 · amd64").
  const osStr = record?.os ?? node.os ?? ''
  const osParts = osStr.split(/[·•]/).map((s) => s.trim()).filter(Boolean)
  const osBase = osParts[0] || '—'
  const kernelHint = osParts.find((p) => /^\d+\.\d+/.test(p))

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
      sub: node.arch ?? undefined,
    },
    {
      label: 'NETWORK',
      value: labels.bandwidth?.value ?? '—',
      sub: labels.traffic ? `LIMIT ${labels.traffic.value}` : undefined,
    },
    {
      label: 'OS · KERNEL',
      value: osBase,
      sub: kernelHint,
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
          online={globalOnline}
          total={nodes.length}
          lastUpdate={lastUpdate}
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

          {/* Live metrics — five RadialGauges (ref: NodeDetailBoard) */}
          <div
            className="precision-card"
            style={{
              padding: '20px 16px',
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <RadialGauge
              value={online ? cpu : 0}
              max={100}
              size={140}
              label="CPU"
              unit="%"
              status={cpu > 80 ? 'bad' : cpu > 60 ? 'warn' : 'good'}
            />
            <RadialGauge
              value={online ? ramPct : 0}
              max={100}
              size={140}
              label="MEMORY"
              unit="%"
              status={ramPct > 80 ? 'bad' : ramPct > 60 ? 'warn' : 'good'}
            />
            <RadialGauge
              value={online ? diskPct : 0}
              max={100}
              size={140}
              label="DISK"
              unit="%"
              status={diskPct > 85 ? 'bad' : diskPct > 70 ? 'warn' : 'good'}
            />
            <RadialGauge
              value={online ? (record?.network_tx ?? 0) / 1024 / 1024 : 0}
              max={100}
              size={140}
              label="NETWORK"
              unit="MB/s"
              status="good"
            />
            <RadialGauge
              value={online ? (record?.load1 ?? 0) : 0}
              max={Math.max(8, (node.cpu_cores ?? 1) * 2)}
              size={140}
              label="LOAD AVG"
              unit=""
              status={(record?.load1 ?? 0) > (node.cpu_cores ?? 1) * 1.5
                ? 'bad'
                : (record?.load1 ?? 0) > (node.cpu_cores ?? 1)
                  ? 'warn'
                  : 'good'}
            />
          </div>

          {/* Tabs separator */}
          <Tabs
            tabs={[
              { id: 'overview', label: 'Overview' },
              {
                id: 'latency',
                label: '测速点延迟',
                badge:
                  pingSeries.length > 0 ? (
                    <SerialPlate>{pingSeries.length}</SerialPlate>
                  ) : null,
              },
            ]}
            active={tab}
            onChange={(t) => setTab(t as 'overview' | 'latency')}
          />

          {tab === 'overview' && (
            <>
              {/* Charts grid — 2×2, real history from /api/records/load */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                }}
              >
                <CardFrame
                  title="CPU · 1H"
                  code="C · 01"
                  action={
                    <Etch>
                      {haveLoadHistory
                        ? `${history.load.count} SAMPLES`
                        : history.loading
                          ? 'LOADING'
                          : 'NO DATA'}
                    </Etch>
                  }
                >
                  <ChartOrEmpty empty={!haveLoadHistory}>
                    <AreaChart
                      data={cpuHist}
                      width={400}
                      height={150}
                      color="var(--accent)"
                      yMin={0}
                      yMax={100}
                      threshold={80}
                      gradientId="ndt-cpu"
                    />
                  </ChartOrEmpty>
                </CardFrame>
                <CardFrame title="Memory · 1H" code="C · 02">
                  <ChartOrEmpty empty={!haveLoadHistory}>
                    <AreaChart
                      data={memHist}
                      width={400}
                      height={150}
                      color="var(--signal-info)"
                      yMin={0}
                      yMax={100}
                      threshold={85}
                      gradientId="ndt-mem"
                    />
                  </ChartOrEmpty>
                </CardFrame>
                <CardFrame
                  title="Disk · 1H"
                  code="C · 03"
                  action={<Etch>USAGE %</Etch>}
                >
                  <ChartOrEmpty empty={!haveLoadHistory}>
                    <AreaChart
                      data={buckets.disk}
                      width={400}
                      height={150}
                      color="var(--signal-good)"
                      yMin={0}
                      yMax={100}
                      threshold={85}
                      gradientId="ndt-disk"
                    />
                  </ChartOrEmpty>
                </CardFrame>
                <CardFrame
                  title="Network · 1H"
                  code="C · 04"
                  action={<Etch>↑ / ↓ BYTES/S</Etch>}
                >
                  <ChartOrEmpty empty={!haveLoadHistory}>
                    <DualNetChart up={netUpHist} down={netDownHist} />
                  </ChartOrEmpty>
                </CardFrame>
              </div>

              {/* Bottom row — Connections (typed counts) / Traffic / Latency */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 16,
                }}
              >
                <CardFrame title="Connections" code="P · 11" action={<Etch>BY KIND</Etch>}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      {
                        l: 'TCP',
                        v: record?.tcp != null ? record.tcp.toLocaleString() : '—',
                        s: 'good',
                      },
                      {
                        l: 'UDP',
                        v: record?.udp != null ? record.udp.toLocaleString() : '—',
                        s: 'info',
                      },
                      {
                        l: 'PROCESSES',
                        v: record?.process != null ? record.process.toLocaleString() : '—',
                        s: (record?.process ?? 0) > 500 ? 'warn' : 'good',
                      },
                    ].map((x, i) => (
                      <div
                        key={x.l}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 0',
                          borderBottom: i < 2 ? '1px solid var(--edge-engrave)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <StatusDot status={x.s as 'good' | 'warn' | 'info'} size={5} />
                          <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{x.l}</span>
                        </div>
                        <Numeric value={x.v} size={14} />
                      </div>
                    ))}
                    <div className="seam" style={{ margin: '6px 0' }} />
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                      }}
                    >
                      <Etch>TOTAL</Etch>
                      <Numeric
                        value={(
                          (record?.tcp ?? 0) +
                          (record?.udp ?? 0)
                        ).toLocaleString()}
                        size={20}
                      />
                    </div>
                  </div>
                </CardFrame>

                <CardFrame title="Traffic" code="T · 11" action={<Etch>SINCE BOOT</Etch>}>
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
                    <div className="seam" style={{ margin: '6px 0' }} />
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                      }}
                    >
                      <Etch>TOTAL</Etch>
                      <Numeric
                        value={formatBytes(
                          (record?.network_total_up ?? 0) + (record?.network_total_down ?? 0),
                        )}
                        size={16}
                      />
                    </div>
                  </div>
                </CardFrame>

                <CardFrame title="Latency" code="L · 11">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <ConnRow
                      label="LATENCY"
                      value={
                        online && record?.ping != null ? `${Math.round(record.ping)} ms` : '—'
                      }
                    />
                    <div style={{ borderTop: '1px solid var(--edge-engrave)' }} />
                    <ConnRow label="PACKET LOSS" value={formatPercent(record?.loss, 1)} />
                    <div className="seam" style={{ margin: '6px 0' }} />
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                      }}
                    >
                      <Etch>UPTIME</Etch>
                      <Numeric
                        value={online ? formatUptime(record?.uptime) : '—'}
                        size={14}
                      />
                    </div>
                  </div>
                </CardFrame>
              </div>
            </>
          )}

          {tab === 'latency' && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    测速点延迟 · 1H
                  </h3>
                  <SerialPlate>
                    {pingTargets.length > 0
                      ? `${pingTargets.length} TARGET${pingTargets.length === 1 ? '' : 'S'}`
                      : history.loading
                        ? 'LOADING'
                        : 'NO TARGETS'}
                  </SerialPlate>
                </div>
                <Etch>SAMPLED FROM THIS PROBE</Etch>
              </div>

              {pingTargets.length === 0 ? (
                <CardFrame title="No ping data" code="∅">
                  <div
                    style={{
                      padding: '60px 16px',
                      textAlign: 'center',
                      color: 'var(--fg-3)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      lineHeight: 1.8,
                    }}
                  >
                    {history.loading ? '加载中…' : '该节点无测速点数据'}
                    {!history.loading && (
                      <>
                        <br />
                        <span style={{ fontSize: 9, color: 'var(--fg-3)', opacity: 0.7 }}>
                          configure ping tasks in komari admin
                        </span>
                      </>
                    )}
                  </div>
                </CardFrame>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 14,
                  }}
                >
                  {pingTargets.map((t, i) => (
                    <PingTargetCard key={t.task.id} target={t} index={i} />
                  ))}
                </div>
              )}
            </>
          )}
        </main>

        <Footer />
      </div>
    </div>
  )
}

function ChartOrEmpty({ empty, children }: { empty: boolean; children: React.ReactNode }) {
  if (empty) {
    return (
      <div
        style={{
          height: 150,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--fg-3)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          background: 'var(--bg-inset)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 2,
        }}
      >
        NO HISTORY DATA
      </div>
    )
  }
  return <>{children}</>
}

/** Network ↑/↓ overlaid in one chart with mirrored emphasis. */
function DualNetChart({ up, down }: { up: number[]; down: number[] }) {
  const maxV = Math.max(...up, ...down, 1)
  const yMax = maxV * 1.2 || 1
  return (
    <div style={{ position: 'relative' }}>
      <AreaChart
        data={up}
        width={400}
        height={150}
        color="var(--accent-bright)"
        yMin={0}
        yMax={yMax}
        gradientId="ndt-netup"
        formatY={(v) => formatBytesShort(v)}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          mixBlendMode: 'normal',
        }}
      >
        <AreaChart
          data={down}
          width={400}
          height={150}
          color="var(--signal-good)"
          yMin={0}
          yMax={yMax}
          gradientId="ndt-netdown"
          formatY={(v) => formatBytesShort(v)}
        />
      </div>
      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          top: 6,
          left: 12,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--fg-2)',
          letterSpacing: '0.1em',
          background: 'var(--bg-1)',
          padding: '2px 6px',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 2,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 8,
              height: 2,
              background: 'var(--accent-bright)',
              boxShadow: '0 0 3px var(--accent-bright)',
            }}
          />
          ↑ TX
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 8,
              height: 2,
              background: 'var(--signal-good)',
              boxShadow: '0 0 3px var(--signal-good)',
            }}
          />
          ↓ RX
        </span>
      </div>
    </div>
  )
}

/** Compact byte formatter for chart axis labels (no spaces, fewer chars). */
function formatBytesShort(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0'
  const units = ['B', 'K', 'M', 'G', 'T']
  const idx = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)), units.length - 1)
  const v = bytes / Math.pow(1024, idx)
  return `${v.toFixed(idx === 0 ? 0 : 1)}${units[idx]}`
}

/** A single ping target — name, current value, loss%, and a 1H mini area chart. */
function PingTargetCard({
  target,
  index,
}: {
  target: { task: { id: number; name: string; loss: number; interval: number }; data: number[]; latest?: number }
  index: number
}) {
  const colors = ['var(--accent)', 'var(--signal-info)', 'var(--signal-good)', 'var(--accent-bright)']
  const color = colors[index % colors.length]
  const latest = target.latest
  const loss = target.task.loss ?? 0

  // Auto y-scale based on this target's actual values
  const peak = Math.max(...target.data, 1)
  const yMax = Math.ceil((peak * 1.3) / 10) * 10 || 50

  // Status from loss + latency
  const lossStatus: 'good' | 'warn' | 'bad' = loss > 10 ? 'bad' : loss > 2 ? 'warn' : 'good'

  return (
    <div
      className="precision-card"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid var(--edge-engrave)',
          background: 'var(--bg-1)',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span
            style={{
              width: 8,
              height: 8,
              background: color,
              boxShadow: `0 0 6px ${color}`,
              borderRadius: 1,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--fg-0)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={target.task.name}
          >
            {target.task.name}
          </span>
        </div>
        <SerialPlate>{target.task.interval}s</SerialPlate>
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Etch>NOW</Etch>
            <Numeric
              value={latest != null ? Math.round(latest).toString() : '—'}
              unit="ms"
              size={20}
              weight={500}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
            <Etch>LOSS</Etch>
            <span
              className="mono tnum"
              style={{
                fontSize: 14,
                fontWeight: 500,
                color:
                  lossStatus === 'bad'
                    ? 'var(--signal-bad)'
                    : lossStatus === 'warn'
                      ? 'var(--signal-warn)'
                      : 'var(--signal-good)',
              }}
            >
              {loss.toFixed(1)}%
            </span>
          </div>
        </div>

        <AreaChart
          data={target.data}
          width={260}
          height={70}
          color={color}
          yMin={0}
          yMax={yMax}
          gridY={2}
          gridX={3}
          gradientId={`pt-${target.task.id}`}
          formatY={(v) => `${Math.round(v)}`}
        />
      </div>
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

