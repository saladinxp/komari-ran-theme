import { useMemo, useState } from 'react'
import { Sidebar } from '@/components/panels/Sidebar'
import { Topbar } from '@/components/panels/Topbar'
import { CardFrame } from '@/components/panels/CardFrame'
import { Footer } from '@/components/panels/Footer'
import { Etch } from '@/components/atoms/Etch'
import { Numeric } from '@/components/atoms/Numeric'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { Segmented } from '@/components/atoms/Segmented'
import { StatusBadge } from '@/components/atoms/StatusBadge'
import { StatusDot } from '@/components/atoms/StatusDot'
import { Tabs } from '@/components/atoms/Tabs'
import { AreaChart } from '@/components/charts/AreaChart'
import { DualSeriesChart } from '@/components/charts/DualSeriesChart'
import { PingChart } from '@/components/charts/PingChart'
import { RadialGauge } from '@/components/charts/RadialGauge'
import type { KomariNode, KomariPublicConfig, KomariRecord } from '@/types/komari'
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
import { filterWindowsByRetention, getRecordRetentionHours } from '@/utils/retention'
import { useNodeHistory } from '@/hooks/useNodeHistory'
import { hashFor } from '@/router/route'
import { useMobileDrawer, useIsMobile } from '@/hooks/useMediaQuery'

type Theme = 'ran-night' | 'ran-mist'
type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'
type WindowKey = '1h' | '6h' | '24h' | '7d'

interface WindowSpec {
  key: WindowKey
  label: string
  hours: number
  buckets: number
  /** 7 X-axis tick labels for the chart, evenly spaced, oldest → newest. */
  xLabels: string[]
  /** Title suffix shown on the chart cards. */
  titleSuffix: string
}

const WINDOWS: WindowSpec[] = [
  {
    key: '1h',
    label: '1H',
    hours: 1,
    buckets: 60,
    xLabels: ['-1h', '-50m', '-40m', '-30m', '-20m', '-10m', 'now'],
    titleSuffix: '1H',
  },
  {
    key: '6h',
    label: '6H',
    hours: 6,
    buckets: 72,
    xLabels: ['-6h', '-5h', '-4h', '-3h', '-2h', '-1h', 'now'],
    titleSuffix: '6H',
  },
  {
    key: '24h',
    label: '24H',
    hours: 24,
    buckets: 96,
    xLabels: ['-24h', '-20h', '-16h', '-12h', '-8h', '-4h', 'now'],
    titleSuffix: '24H',
  },
  {
    key: '7d',
    label: '7D',
    hours: 24 * 7,
    buckets: 84,
    xLabels: ['-7d', '-6d', '-5d', '-4d', '-3d', '-2d', '-1d'],
    titleSuffix: '7D',
  },
]

interface Props {
  uuid: string
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  theme: Theme
  onTheme: (t: Theme) => void
  conn?: Conn
  lastUpdate?: number | null
  siteName?: string
  config?: KomariPublicConfig
  hubTargetUuid?: string
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
  config,
  hubTargetUuid,
}: Props) {
  const drawer = useMobileDrawer()
  const isMobile = useIsMobile()
  // Hooks must be called before any early return.
  const [windowKey, setWindowKey] = useState<WindowKey>('1h')

  // Filter windows by Komari record retention (record_preserve_time, in hours).
  const retentionHours = getRecordRetentionHours(config)
  const availableWindows = useMemo(
    () => filterWindowsByRetention(WINDOWS, retentionHours),
    [retentionHours],
  )
  const activeWindowKey: WindowKey = availableWindows.some((w) => w.key === windowKey)
    ? windowKey
    : availableWindows[0].key
  const windowSpec = WINDOWS.find((w) => w.key === activeWindowKey) ?? WINDOWS[0]
  const history = useNodeHistory(uuid, windowSpec.hours)
  const [tab, setTab] = useState<'overview' | 'latency'>('overview')

  const node = useMemo(() => nodes.find((n) => n.uuid === uuid), [nodes, uuid])
  const record = node ? records[node.uuid] : undefined
  const labels = node ? parseLabels(node.tags) : { raw: [] }

  const windowMs = windowSpec.hours * 60 * 60 * 1000
  // Bucketed real history (zero-filled when there's no data yet).
  const buckets = useMemo(
    () => bucketLoadHistory(history.load, windowSpec.buckets, windowMs),
    [history.load, windowSpec.buckets, windowMs],
  )
  // Per-point timestamps for chart tooltips. Same scheme as bucketLoadHistory:
  // bucketMs * (i + 0.5) gives the slot midpoint.
  const bucketTimes = useMemo(() => {
    const now = Date.now()
    const start = now - windowMs
    const bucketMs = windowMs / windowSpec.buckets
    return Array.from({ length: windowSpec.buckets }, (_, i) =>
      Math.round(start + (i + 0.5) * bucketMs),
    )
  }, [windowSpec.buckets, windowMs])
  const pingTargets = useMemo(
    () =>
      hasPingData(history.ping)
        ? aggregatePingByTarget(history.ping, windowSpec.buckets, windowMs, 6)
        : [],
    [history.ping, windowSpec.buckets, windowMs],
  )
  const pingSeries = useMemo(
    () => pingTargets.map((t) => ({ data: t.data, label: t.task.name })),
    [pingTargets],
  )

  // Global stats for the topbar (must run before any early return — Rules of Hooks).
  const globalOnline = useMemo(() => {
    let n = 0
    for (const x of nodes) if (records[x.uuid]?.online) n++
    return n
  }, [nodes, records])

  // Distinguish "still loading the node roster" from "uuid genuinely not found".
  // On a hard refresh of #/nodes/UUID, nodes is briefly [] before /api/nodes responds.
  const rosterLoaded = nodes.length > 0
  if (!node) {
    const stillLoading = !rosterLoaded
    return (
      <div
        style={{
          display: 'flex',
          background: 'var(--bg-0)',
          color: 'var(--fg-0)',
          fontFamily: 'var(--font-sans)',
          minHeight: '100vh',
        }}
      >
        <Sidebar active="nodes" mobileOpen={drawer.open} onMobileClose={drawer.onClose} hubTargetUuid={hubTargetUuid} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Topbar
            title={siteName}
            subtitle={stillLoading ? 'LOADING PROBE …' : 'UNKNOWN PROBE'}
            theme={theme}
            onTheme={onTheme}
            online={0}
            total={0}
            lastUpdate={lastUpdate}
            conn={conn}
                      onMobileMenu={drawer.onOpen}
          />
          <main className="app-main" style={{ flex: 1, padding: 20 }}>
            {stillLoading ? (
              <CardFrame title="Loading probe …" code="…">
                <div
                  style={{
                    padding: 40,
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--fg-3)',
                    fontSize: 11,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                  }}
                >
                  Fetching node roster
                  <br />
                  <span style={{ fontSize: 9, opacity: 0.7 }}>
                    UUID · {uuid.slice(0, 8).toUpperCase()}
                  </span>
                </div>
              </CardFrame>
            ) : (
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
            )}
          </main>
          <Footer config={config} />
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
      <Sidebar active="nodes" mobileOpen={drawer.open} onMobileClose={drawer.onClose} hubTargetUuid={hubTargetUuid} />

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
                  onMobileMenu={drawer.onOpen}
        />

        <main className="app-main" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
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

          {/* Specs strip — 桌面 N 列横排;移动端 2 列网格,允许换行
              不让数字被省略号吃掉(原来 6 列在 380px 屏每格只剩 ~50px) */}
          <div
            className="precision-card"
            style={{
              padding: 14,
              display: 'grid',
              gridTemplateColumns: isMobile
                ? 'repeat(2, 1fr)'
                : `repeat(${specs.length}, 1fr)`,
              rowGap: isMobile ? 12 : 0,
            }}
          >
            {specs.map((s, i) => {
              // 移动端 2 列:右侧那列(奇数 index)无右边框,最后一行无下边框
              const isLastCol = isMobile ? i % 2 === 1 : i === specs.length - 1
              const totalRows = isMobile ? Math.ceil(specs.length / 2) : 1
              const myRow = isMobile ? Math.floor(i / 2) : 0
              const isLastRow = myRow === totalRows - 1
              return (
                <div
                  key={s.label}
                  style={{
                    padding: isMobile ? '6px 10px' : '6px 12px',
                    borderRight: !isLastCol ? '1px solid var(--edge-engrave)' : 'none',
                    borderBottom:
                      isMobile && !isLastRow ? '1px solid var(--edge-engrave)' : 'none',
                    paddingBottom: isMobile && !isLastRow ? 12 : undefined,
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
                      // 桌面保留 nowrap+ellipsis(列窄了也能 hover 看 title);
                      // 移动端允许换行,优先信息完整
                      whiteSpace: isMobile ? 'normal' : 'nowrap',
                      overflow: isMobile ? 'visible' : 'hidden',
                      textOverflow: isMobile ? 'clip' : 'ellipsis',
                      wordBreak: isMobile ? 'break-word' : 'normal',
                      lineHeight: isMobile ? 1.25 : undefined,
                    }}
                    title={String(s.value)}
                  >
                    {s.value}
                  </span>
                  {s.sub && <Etch size={8}>{s.sub}</Etch>}
                </div>
              )
            })}
          </div>

          {/* Live metrics — 桌面用 5 个 RadialGauge,移动端用大数字卡。
              手机上仪表盘的圆环+刻度装饰反而压缩了字号、还要滚屏才能看全,
              改成 2x2+1 居中的卡片网格,数字 mono 大字号,信息密度更高。 */}
          {(() => {
            const metrics = [
              {
                key: 'cpu',
                label: 'CPU',
                value: online ? cpu : 0,
                unit: '%',
                max: 100,
                fmt: (v: number) => v.toFixed(1),
                status: cpu > 80 ? 'bad' : cpu > 60 ? 'warn' : 'good',
              },
              {
                key: 'mem',
                label: 'MEMORY',
                value: online ? ramPct : 0,
                unit: '%',
                max: 100,
                fmt: (v: number) => v.toFixed(1),
                status: ramPct > 80 ? 'bad' : ramPct > 60 ? 'warn' : 'good',
              },
              {
                key: 'disk',
                label: 'DISK',
                value: online ? diskPct : 0,
                unit: '%',
                max: 100,
                fmt: (v: number) => v.toFixed(1),
                status: diskPct > 85 ? 'bad' : diskPct > 70 ? 'warn' : 'good',
              },
              {
                key: 'net',
                label: 'NETWORK',
                value: online ? (record?.network_tx ?? 0) / 1024 / 1024 : 0,
                unit: 'MB/s',
                max: 100,
                fmt: (v: number) => v.toFixed(1),
                status: 'good' as const,
              },
              {
                key: 'load',
                label: 'LOAD AVG',
                value: online ? (record?.load1 ?? 0) : 0,
                unit: '',
                max: Math.max(8, (node.cpu_cores ?? 1) * 2),
                fmt: (v: number) => v.toFixed(2),
                status:
                  (record?.load1 ?? 0) > (node.cpu_cores ?? 1) * 1.5
                    ? 'bad'
                    : (record?.load1 ?? 0) > (node.cpu_cores ?? 1)
                      ? 'warn'
                      : 'good',
              },
            ] as const

            if (isMobile) {
              return (
                <div
                  className="precision-card"
                  style={{
                    padding: 12,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 8,
                  }}
                >
                  {metrics.map((m, i) => {
                    const colorVar =
                      m.status === 'bad'
                        ? 'var(--signal-bad)'
                        : m.status === 'warn'
                          ? 'var(--signal-warn)'
                          : 'var(--fg-0)'
                    const pct = Math.max(0, Math.min(100, (m.value / m.max) * 100))
                    // 5 项时让最后一项(LOAD AVG)跨两列居中,避免奇数留空
                    const isOdd = metrics.length % 2 === 1 && i === metrics.length - 1
                    return (
                      <div
                        key={m.key}
                        style={{
                          gridColumn: isOdd ? '1 / -1' : undefined,
                          padding: '14px 14px 12px',
                          border: '1px solid var(--edge-engrave)',
                          background: 'var(--bg-1)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          minWidth: 0,
                          position: 'relative',
                        }}
                      >
                        <Etch>{m.label}</Etch>
                        <Numeric
                          value={m.fmt(m.value)}
                          unit={m.unit || undefined}
                          size={32}
                          weight={500}
                          color={colorVar}
                        />
                        {/* 底部 2px 进度条 — 仪表盘的隐喻替代品 */}
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: 2,
                            background: 'var(--edge-engrave)',
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background:
                                m.status === 'bad'
                                  ? 'var(--signal-bad)'
                                  : m.status === 'warn'
                                    ? 'var(--signal-warn)'
                                    : 'var(--signal-good)',
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }

            // 桌面:保留原 5 个 RadialGauge
            return (
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
                {metrics.map((m) => (
                  <RadialGauge
                    key={m.key}
                    value={m.value}
                    max={m.max}
                    size={140}
                    label={m.label}
                    unit={m.unit}
                    status={m.status}
                  />
                ))}
              </div>
            )
          })()}

          {/* Tabs + window selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <a
                href={hashFor({ name: 'hub', uuid })}
                title="HUB · 单节点驾驶舱视图"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  padding: '6px 12px',
                  background: 'var(--bg-1)',
                  color: 'var(--accent-bright)',
                  border: '1px solid var(--edge-engrave)',
                  borderLeft: '2px solid var(--accent)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                HUB →
              </a>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Etch>WINDOW</Etch>
                <Segmented
                  size="sm"
                  value={activeWindowKey}
                  onChange={(v) => setWindowKey(v as WindowKey)}
                  options={availableWindows.map((w) => ({ value: w.key, label: w.label }))}
                />
              </div>
            </div>
          </div>

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
                  title={`CPU · ${windowSpec.titleSuffix}`}
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
                      times={bucketTimes}
                      formatValue={(v) => `${v.toFixed(1)}%`}
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
                <CardFrame title={`Memory · ${windowSpec.titleSuffix}`} code="C · 02">
                  <ChartOrEmpty empty={!haveLoadHistory}>
                    <AreaChart
                      data={memHist}
                      times={bucketTimes}
                      formatValue={(v) => `${v.toFixed(1)}%`}
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
                  title={`Disk · ${windowSpec.titleSuffix}`}
                  code="C · 03"
                  action={<Etch>USAGE %</Etch>}
                >
                  <ChartOrEmpty empty={!haveLoadHistory}>
                    <AreaChart
                      data={buckets.disk}
                      times={bucketTimes}
                      formatValue={(v) => `${v.toFixed(1)}%`}
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
                  title={`Network · ${windowSpec.titleSuffix}`}
                  code="C · 04"
                  action={<Etch>↑ / ↓ BYTES/S</Etch>}
                >
                  <ChartOrEmpty empty={!haveLoadHistory}>
                    <DualNetChart up={netUpHist} down={netDownHist} times={bucketTimes} />
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
                    测速点延迟 · {windowSpec.titleSuffix}
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
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 14,
                  }}
                >
                  {pingTargets.map((t, i) => (
                    <PingTargetCard
                      key={t.task.id}
                      target={t}
                      index={i}
                      times={bucketTimes}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>

        <Footer config={config} />
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
function DualNetChart({
  up,
  down,
  times,
}: {
  up: number[]
  down: number[]
  times?: number[]
}) {
  // Use PingChart's multi-series machinery — it already handles tooltip-picks-
  // closest-series. We just relabel the units (B/s instead of ms).
  const maxV = Math.max(...up, ...down, 1)
  const yMax = maxV * 1.2 || 1
  return (
    <div style={{ position: 'relative' }}>
      <DualSeriesChart
        series={[
          { data: up, label: '↑ TX', color: 'var(--accent-bright)', formatGradId: 'ndt-netup' },
          { data: down, label: '↓ RX', color: 'var(--signal-good)', formatGradId: 'ndt-netdown' },
        ]}
        times={times}
        yMax={yMax}
      />
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
          pointerEvents: 'none',
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

/** A single ping target — name, current value, loss%, and a 1H mini area chart. */
function PingTargetCard({
  target,
  index,
  times,
}: {
  target: { task: { id: number; name: string; loss: number; interval: number }; data: number[]; latest?: number }
  index: number
  times?: number[]
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
          times={times}
          formatValue={(v) => `${Math.round(v)} ms`}
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

