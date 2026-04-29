import { useMemo, useState } from 'react'
import { Sidebar } from '@/components/panels/Sidebar'
import { Topbar } from '@/components/panels/Topbar'
import { CardFrame } from '@/components/panels/CardFrame'
import { HeroStats } from '@/components/panels/HeroStats'
import { Footer } from '@/components/panels/Footer'
import { Etch } from '@/components/atoms/Etch'
import { Numeric } from '@/components/atoms/Numeric'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { Segmented } from '@/components/atoms/Segmented'
import { StatusDot } from '@/components/atoms/StatusDot'
import { AreaChart } from '@/components/charts/AreaChart'
import { BarChart } from '@/components/charts/BarChart'
import type { KomariNode, KomariPublicConfig, KomariRecord } from '@/types/komari'
import type { GlobalHistoryState } from '@/hooks/useGlobalHistory'
import { useGlobalHistory } from '@/hooks/useGlobalHistory'
import { formatBps, formatBytes } from '@/utils/format'
import { filterWindowsByRetention, getRecordRetentionHours } from '@/utils/retention'
import { contentFs } from '@/utils/fontScale'
import { hashFor } from '@/router/route'
import { useMobileDrawer } from '@/hooks/useMediaQuery'

type Theme = 'ran-night' | 'ran-mist'
type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'
type SortBy = 'total' | 'tx' | 'rx' | 'live'
type TimeKey = '1h' | '6h' | '24h' | '7d'

interface TimeWindow {
  key: TimeKey
  label: string
  hours: number
  titleSuffix: string
  /** Inline label spec for the bucket-axis below the area chart. */
  axisLabels: string[]
}

const TIME_WINDOWS: TimeWindow[] = [
  {
    key: '1h',
    label: '1H',
    hours: 1,
    titleSuffix: '1H',
    axisLabels: ['-60m', '-50m', '-40m', '-30m', '-20m', '-10m', 'now'],
  },
  {
    key: '6h',
    label: '6H',
    hours: 6,
    titleSuffix: '6H',
    axisLabels: ['-6h', '-5h', '-4h', '-3h', '-2h', '-1h', 'now'],
  },
  {
    key: '24h',
    label: '24H',
    hours: 24,
    titleSuffix: '24H',
    axisLabels: ['-24h', '-20h', '-16h', '-12h', '-8h', '-4h', 'now'],
  },
  {
    key: '7d',
    label: '7D',
    hours: 168,
    titleSuffix: '7D',
    axisLabels: ['-7d', '-6d', '-5d', '-4d', '-3d', '-2d', '-1d'],
  },
]

function bytesShort(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0'
  const units = ['B', 'K', 'M', 'G', 'T']
  const idx = Math.min(
    Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)),
    units.length - 1,
  )
  const v = bytes / Math.pow(1024, idx)
  return `${v.toFixed(idx === 0 ? 0 : 1)}${units[idx]}`
}

interface Props {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  theme: Theme
  onTheme: (t: Theme) => void
  siteName?: string
  conn?: Conn
  lastUpdate?: number | null
  history?: GlobalHistoryState
  config?: KomariPublicConfig
  hubTargetUuid?: string
}

interface NodeTraffic {
  node: KomariNode
  record?: KomariRecord
  /** Cumulative since-boot tx bytes */
  tx: number
  /** Cumulative since-boot rx bytes */
  rx: number
  total: number
  /** Live throughput bytes/s */
  liveBps: number
  online: boolean
}

export function TrafficPage({
  nodes,
  records,
  theme,
  onTheme,
  siteName = '岚 · Komari',
  conn = 'idle',
  lastUpdate,
  history,
  config,
  hubTargetUuid,
}: Props) {
  const drawer = useMobileDrawer()
  const [sortBy, setSortBy] = useState<SortBy>('total')
  const [timeKey, setTimeKey] = useState<TimeKey>('1h')

  // Filter time windows by Komari's record retention (record_preserve_time, in hours).
  // If retention is e.g. 24h, the 7D option simply isn't offered.
  const retentionHours = getRecordRetentionHours(config)
  const availableWindows = useMemo(
    () => filterWindowsByRetention(TIME_WINDOWS, retentionHours),
    [retentionHours],
  )
  // Clamp the active key to whatever's available (handles config arriving late).
  const activeKey: TimeKey = availableWindows.some((w) => w.key === timeKey)
    ? timeKey
    : availableWindows[0].key
  const win = TIME_WINDOWS.find((w) => w.key === activeKey) ?? TIME_WINDOWS[0]

  // Pull our own windowed history (independent of the global 1H one).
  // For 1H we still use the prop-supplied global history (shared with Overview, no extra fetch).
  // For 6H/24H/7D we fetch our own windowed slice.
  const ownHistory = useGlobalHistory(
    activeKey === '1h' ? [] : nodes.map((n) => n.uuid),
    win.hours,
  )
  const effectiveHistory: GlobalHistoryState | undefined =
    activeKey === '1h' ? history : ownHistory

  // Per-node traffic snapshot — pulled straight from live records.
  const nodeTraffic: NodeTraffic[] = useMemo(() => {
    return nodes.map((n) => {
      const r = records[n.uuid]
      const tx = r?.network_total_up ?? 0
      const rx = r?.network_total_down ?? 0
      return {
        node: n,
        record: r,
        tx,
        rx,
        total: tx + rx,
        liveBps: (r?.network_tx ?? 0) + (r?.network_rx ?? 0),
        online: r?.online === true,
      }
    })
  }, [nodes, records])

  // Top talkers — sorted, top 10
  const topTalkers = useMemo(() => {
    const sortFn: Record<SortBy, (a: NodeTraffic, b: NodeTraffic) => number> = {
      total: (a, b) => b.total - a.total,
      tx: (a, b) => b.tx - a.tx,
      rx: (a, b) => b.rx - a.rx,
      live: (a, b) => b.liveBps - a.liveBps,
    }
    return [...nodeTraffic].sort(sortFn[sortBy]).slice(0, 10)
  }, [nodeTraffic, sortBy])

  // Aggregate stats
  const stats = useMemo(() => {
    let totalTx = 0
    let totalRx = 0
    let liveBps = 0
    let online = 0
    for (const t of nodeTraffic) {
      totalTx += t.tx
      totalRx += t.rx
      liveBps += t.liveBps
      if (t.online) online++
    }
    const total = totalTx + totalRx
    const avgBps = online > 0 ? liveBps / online : 0
    return { total, totalTx, totalRx, liveBps, avgBps, online }
  }, [nodeTraffic])

  // Hero stats — sparklines are derived from the global 1H history aggregate.
  const heroStats = useMemo(() => {
    const totalStr = formatBytes(stats.total).split(' ')
    const txStr = formatBytes(stats.totalTx).split(' ')
    const rxStr = formatBytes(stats.totalRx).split(' ')
    const liveStr = formatBps(stats.liveBps).split(' ')
    const agg = effectiveHistory?.aggregate
    const txSpark = agg?.netOut ?? []
    const rxSpark = agg?.netIn ?? []
    const totalSpark = agg ? agg.netOut.map((v, i) => v + (agg.netIn[i] ?? 0)) : []
    return [
      {
        label: 'CUMULATIVE TOTAL',
        code: 'T01',
        value: totalStr[0] || '0',
        unit: totalStr[1] || 'B',
        spark: totalSpark,
        sparkColor: 'var(--accent)',
      },
      {
        label: 'UPLOAD ↑',
        code: 'T02',
        value: txStr[0] || '0',
        unit: txStr[1] || 'B',
        spark: txSpark,
        sparkColor: 'var(--accent-bright)',
      },
      {
        label: 'DOWNLOAD ↓',
        code: 'T03',
        value: rxStr[0] || '0',
        unit: rxStr[1] || 'B',
        spark: rxSpark,
        sparkColor: 'var(--signal-good)',
      },
      {
        label: 'LIVE THROUGHPUT',
        code: 'T04',
        value: liveStr[0] || '0',
        unit: liveStr[1] ? liveStr[1].replace('/s', '') : 'B',
        spark: totalSpark,
        sparkColor: 'var(--signal-info)',
      },
    ]
  }, [stats, effectiveHistory])

  // Trend chart data — summed bytes/s across all nodes for the selected window.
  const trendData = useMemo(() => {
    const agg = effectiveHistory?.aggregate
    if (!agg) return new Array(60).fill(0)
    return agg.netIn.map((v, i) => v + (agg.netOut[i] ?? 0))
  }, [effectiveHistory])

  // Per-bucket midpoint timestamps for the selected window (60 buckets).
  const bucketTimes = useMemo(() => {
    const now = Date.now()
    const windowMs = win.hours * 60 * 60 * 1000
    const start = now - windowMs
    const stepMs = windowMs / 60
    return Array.from({ length: 60 }, (_, i) => Math.round(start + (i + 0.5) * stepMs))
  }, [win.hours])

  const subtitle = useMemo(() => {
    return `${nodes.length} PROBES · ${formatBytes(stats.total)} CUMULATIVE`
  }, [nodes.length, stats.total])

  // Topbar online count
  const globalOnline = stats.online

  // Max for top-talker bar scale
  const topMax = topTalkers.length > 0 ? topTalkers[0].total || 1 : 1

  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--bg-0)',
        color: 'var(--fg-0)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Sidebar active="traffic" mobileOpen={drawer.open} onMobileClose={drawer.onClose} hubTargetUuid={hubTargetUuid} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          title={siteName}
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
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: contentFs(20),
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: 'var(--fg-0)',
                }}
              >
                Traffic
              </h2>
              <SerialPlate>NETWORK · WIDE</SerialPlate>
              <Etch>SINCE BOOT · UPDATED LIVE</Etch>
            </div>
          </div>

          <HeroStats stats={heroStats} />

          {/* Trend — windowed aggregate from per-node history */}
          <CardFrame
            title={`全网流量趋势 · ${win.titleSuffix}`}
            code="T · 06"
            action={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Etch>WINDOW</Etch>
                <Segmented
                  size="sm"
                  value={activeKey}
                  onChange={(v) => setTimeKey(v as TimeKey)}
                  options={availableWindows.map((w) => ({ value: w.key, label: w.label }))}
                />
              </div>
            }
          >
            <AreaChart
              data={trendData}
              width={1000}
              height={180}
              color="var(--accent)"
              yMin={0}
              yMax={Math.max(...trendData, 1) * 1.2 || 1}
              gradientId="traffic-trend"
              times={bucketTimes}
              formatValue={(v) => `${formatBps(v)}`}
            />
          </CardFrame>

          {/* Top Talkers */}
          <CardFrame
            title="Top Talkers"
            code={`N · ${String(topTalkers.length).padStart(2, '0')}`}
            action={
              <div style={{ display: 'flex', gap: 8 }}>
                <Segmented
                  size="sm"
                  value={sortBy}
                  onChange={(v) => setSortBy(v as SortBy)}
                  options={[
                    { value: 'total', label: 'TOTAL' },
                    { value: 'tx', label: '↑ TX' },
                    { value: 'rx', label: '↓ RX' },
                    { value: 'live', label: 'LIVE' },
                  ]}
                />
              </div>
            }
            inset
          >
            {topTalkers.length === 0 ? (
              <div
                style={{
                  padding: '40px 16px',
                  textAlign: 'center',
                  color: 'var(--fg-3)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: contentFs(11),
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}
              >
                NO PROBES
              </div>
            ) : (
              <div>
                {/* Header */}
                <div
                  className="traffic-talkers-header"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 1fr 90px 100px 100px 1fr',
                    gap: 10,
                    padding: '8px 14px',
                    borderBottom: '1px solid var(--edge-engrave)',
                    background: 'var(--bg-1)',
                    fontSize: contentFs(9),
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--fg-3)',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span className="traffic-col-rank">#</span>
                  <span>NODE</span>
                  <span className="traffic-col-region">REGION</span>
                  <span style={{ textAlign: 'right' }}>↑ TX</span>
                  <span style={{ textAlign: 'right' }}>↓ RX</span>
                  <span className="traffic-col-share">SHARE</span>
                </div>
                {topTalkers.map((t, i) => (
                  <a
                    key={t.node.uuid}
                    href={hashFor({ name: 'nodes', uuid: t.node.uuid })}
                    className="traffic-talkers-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '32px 1fr 90px 100px 100px 1fr',
                      gap: 10,
                      padding: '10px 14px',
                      borderBottom:
                        i < topTalkers.length - 1
                          ? '1px solid var(--edge-engrave)'
                          : 'none',
                      alignItems: 'center',
                      textDecoration: 'none',
                      color: 'inherit',
                      fontSize: contentFs(12),
                    }}
                  >
                    <span
                      className="traffic-col-rank"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: contentFs(11),
                        color: 'var(--fg-3)',
                        letterSpacing: '0.1em',
                      }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div
                      className="traffic-col-node"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        minWidth: 0,
                      }}
                    >
                      <StatusDot status={t.online ? 'good' : 'bad'} size={6} />
                      <span
                        style={{
                          fontWeight: 500,
                          color: 'var(--fg-0)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={t.node.name}
                      >
                        {t.node.flag && (
                          <span
                            style={{
                              fontSize: contentFs(9),
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--accent-bright)',
                              letterSpacing: '0.12em',
                              marginRight: 6,
                            }}
                          >
                            {t.node.flag}
                          </span>
                        )}
                        {t.node.name}
                      </span>
                    </div>
                    <span className="traffic-col-region">
                      <SerialPlate>{t.node.region ?? '—'}</SerialPlate>
                    </span>
                    <span
                      className="mono tnum traffic-col-tx"
                      style={{
                        textAlign: 'right',
                        color: 'var(--accent-bright)',
                        fontSize: contentFs(12),
                      }}
                    >
                      {formatBytes(t.tx)}
                    </span>
                    <span
                      className="mono tnum traffic-col-rx"
                      style={{
                        textAlign: 'right',
                        color: 'var(--signal-good)',
                        fontSize: contentFs(12),
                      }}
                    >
                      {formatBytes(t.rx)}
                    </span>
                    <span className="traffic-col-share">
                      <ShareBar tx={t.tx} rx={t.rx} max={topMax} />
                    </span>
                  </a>
                ))}
              </div>
            )}
          </CardFrame>

          {/* Per-region distribution */}
          <RegionDistribution traffic={nodeTraffic} />
        </main>

        <Footer config={config} />
      </div>
    </div>
  )
}

/** Single bar showing TX (accent) + RX (good) stacked, normalized to max. */
function ShareBar({ tx, rx, max }: { tx: number; rx: number; max: number }) {
  const total = tx + rx
  const totalPct = max > 0 ? (total / max) * 100 : 0
  const txRatio = total > 0 ? tx / total : 0
  return (
    <div
      style={{
        height: 8,
        background: 'var(--bg-inset)',
        border: '1px solid var(--edge-engrave)',
        borderRadius: 1,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${totalPct * txRatio}%`,
          background: 'var(--accent-bright)',
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${totalPct * txRatio}%`,
          top: 0,
          bottom: 0,
          width: `${totalPct * (1 - txRatio)}%`,
          background: 'var(--signal-good)',
          opacity: 0.9,
        }}
      />
    </div>
  )
}

/** Per-region traffic distribution as a horizontal bar chart. */
function RegionDistribution({ traffic }: { traffic: NodeTraffic[] }) {
  const byRegion = useMemo(() => {
    const map = new Map<string, { total: number; nodes: number }>()
    for (const t of traffic) {
      const key = t.node.region?.split('-')[0]?.toUpperCase() ?? '—'
      const ex = map.get(key) ?? { total: 0, nodes: 0 }
      ex.total += t.total
      ex.nodes += 1
      map.set(key, ex)
    }
    return Array.from(map.entries())
      .map(([region, data]) => ({ region, ...data }))
      .sort((a, b) => b.total - a.total)
  }, [traffic])

  if (byRegion.length === 0) return null

  return (
    <CardFrame title="按区域分布" code="R · 06" action={<Etch>{byRegion.length} REGIONS</Etch>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <BarChart
          data={byRegion.map((r) => r.total)}
          width={1000}
          height={120}
          color="var(--accent)"
          labels={byRegion.map((r) => r.region)}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 8,
            paddingTop: 10,
            borderTop: '1px solid var(--edge-engrave)',
          }}
        >
          {byRegion.map((r) => (
            <div
              key={r.region}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: '4px 0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <SerialPlate>{r.region}</SerialPlate>
                <Etch>{r.nodes} NODE{r.nodes === 1 ? '' : 'S'}</Etch>
              </div>
              <Numeric value={formatBytes(r.total)} size={14} weight={500} />
            </div>
          ))}
        </div>
      </div>
    </CardFrame>
  )
}
