/**
 * OverviewV2 — v2.0 redesigned Overview, aligned to the reference design.
 *
 * Layout (top to bottom):
 *
 *   1. StatusStripe (full width)
 *      LIVE · 16 ONLINE · 2 OFFLINE · 1 DEGRADED · 5 REGIONS · 3 ALERTS · AVG LAT · SYNC
 *
 *   2. Top row — 5 summary cards
 *      ┌────────────┬────────────┬────────────┬────────────┬────────────┐
 *      │ HEALTH     │ ACTIVE     │ GLOBAL     │ AVG PACKET │ EXPIRING   │
 *      │ SCORE      │ ALERTS     │ THROUGHPUT │ LOSS       │ SOON       │
 *      └────────────┴────────────┴────────────┴────────────┴────────────┘
 *
 *   3. Global Throughput 24h (full width area chart)
 *
 *   4. Mid row — 4 panels
 *      ┌────────────┬────────────┬────────────┬────────────┐
 *      │ REGION     │ ALERT      │ RECENT     │ HEALTH     │
 *      │ DONUT      │ SUMMARY    │ INCIDENTS  │ TREND 7D   │
 *      └────────────┴────────────┴────────────┴────────────┘
 *
 *   5. Bottom row — 3 panels
 *      ┌──────────────────────┬────────────┬──────────────────────┐
 *      │ ATTENTION TOP 5      │ SYSTEM     │ NETWORK HEATMAP      │
 *      │ NEEDED               │ HEALTH     │ (LOSS %)             │
 *      └──────────────────────┴────────────┴──────────────────────┘
 *
 * Sidebar bottom now carries a SystemStatusFooter (operational status +
 * last-update clock).
 *
 * Everything clickable opens NodeDetailDrawer on the same page.
 */

import { useMemo, useState } from 'react'
import type { PingHistory } from '@/api/client'
import { Sidebar } from '@/components/panels/Sidebar'
import { Topbar } from '@/components/panels/Topbar'
import { Footer } from '@/components/panels/Footer'
import { VisitorAlert } from '@/components/panels/VisitorAlert'
import type { Theme } from '@/components/atoms/ThemePicker'
import type {
  KomariNode,
  KomariRecord,
  KomariPublicConfig,
} from '@/types/komari'
import { useMobileDrawer, useIsMobile } from '@/hooks/useMediaQuery'
import { useGlobalHistory } from '@/hooks/useGlobalHistory'

import {
  useAggregateStats,
  useClusterHealth,
  useAttentionNeeded,
  useAlertSummary,
  useRegionDistribution,
  useHealthTrend,
  useRecentEvents,
  useAlertHistory,
  useMetricHistory,
} from '@/hooks/v2'

import {
  StatusStripe,
  HealthScoreCard,
  RegionDistributionDonut,
  GlobalThroughput24hChart,
  AlertSummaryPanel,
  RecentEventsPanel,
  AttentionNeededTable,
  HealthTrend7DChart,
  NodeDetailDrawer,
  ActiveAlertsCard,
  ThroughputSummaryCard,
  AvgPacketLossCard,
  ExpiringSoonCard,
  SystemHealthPanel,
  NetworkLossHeatmap,
  SystemStatusFooter,
} from '@/components/v2'

type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'

interface Props {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  theme: Theme
  onTheme: (t: Theme) => void
  siteName?: string
  conn?: Conn
  lastUpdate?: number | null
  ping?: PingHistory
  config?: KomariPublicConfig
  hubTargetUuid?: string
  viewVersion?: 'v1' | 'v2'
  onViewVersionChange?: (v: 'v1' | 'v2') => void
}

const HOURS_24 = 24 * 60 * 60 * 1000
const HOURS_6 = 6 * 60 * 60 * 1000

export function OverviewV2Page({
  nodes,
  records,
  theme,
  onTheme,
  siteName = '岚',
  conn = 'idle',
  lastUpdate,
  hubTargetUuid,
  ping,
  config,
  viewVersion,
  onViewVersionChange,
}: Props) {
  // ── Data layer ──
  const stats = useAggregateStats(nodes, records, { expiringWithinDays: 30 })
  const health = useClusterHealth(stats)
  const attention = useAttentionNeeded(nodes, records, { topN: 5 })
  const alertSummary = useAlertSummary(nodes, records, { topN: 5 })
  const regions = useRegionDistribution(nodes)
  const trend = useHealthTrend(health.score)
  const events = useRecentEvents(nodes, records)
  const drawer = useMobileDrawer()
  const isMobile = useIsMobile()

  const uuids = useMemo(() => nodes.map((n) => n.uuid), [nodes])

  // Always pull last-24h for the summary cards' sparklines.
  // This page charts cpu/ram/traffic and never reads a ping field, so ping is
  // skipped outright — it was costing two requests per node whose responses
  // were parsed and thrown away.
  const history24 = useGlobalHistory(uuids, 24, 60_000, true, true, true, true)

  // Time window for the GLOBAL THROUGHPUT chart. 24h is the default; we
  // expose 1d / 3d / 7d / 30d to let the user zoom out for trend spotting.
  // The choice is local to this session (not persisted) — users usually
  // want a fresh "last 24h" view on each visit.
  //
  // When the chart's window is 24h, we reuse history24 instead of issuing
  // a second identical pull. When the user picks a longer window we issue
  // a parallel hook call for that range — it's a bigger fetch (more nodes
  // × more buckets) so we do it on demand only.
  const [chartHours, setChartHours] = useState(24)
  const extendedHistory = useGlobalHistory(
    uuids,
    chartHours,
    60_000,
    chartHours !== 24, // gate: only fetch when actually zoomed out
    true, // liveOnly
    true, // skipPing — this page never plots ping
    true, // skipDiskLoad — nor disk/load series
  )
  const historyChart = chartHours === 24 ? history24 : extendedHistory

  // ── Real 24h histories (replaces previous placeholder/synthetic data) ──

  // 24h alert count history → 12 bucket bars for ActiveAlertsCard
  const alertVolumeSeries = useAlertHistory(alertSummary.counts.total)

  // 24h total throughput (in+out bytes accumulated) → spark + vs-yesterday delta
  const throughputHistory = useMetricHistory(
    'throughputTotal',
    stats.totalNetUp + stats.totalNetDown,
  )

  // 24h average packet loss (multiply by 100 since avgLoss is 0..1 fraction)
  const lossHistory = useMetricHistory('avgLoss', stats.avgLoss, {
    multiplier: 100,
  })

  // Yesterday health score for HealthScoreCard
  const yesterdayScore = useMemo(() => {
    const target = Date.now() - HOURS_24
    let best: { dt: number; score: number } | undefined
    for (const p of trend) {
      const dt = Math.abs(p.t - target)
      if (!best || dt < best.dt) best = { dt, score: p.score }
    }
    return best && best.dt < HOURS_6 ? best.score : undefined
  }, [trend])

  // Drawer state
  const [drawerUuid, setDrawerUuid] = useState<string | null>(null)
  const drawerNode = drawerUuid
    ? nodes.find((n) => n.uuid === drawerUuid) ?? null
    : null
  const drawerRecord = drawerUuid ? records[drawerUuid] : undefined

  const isLive = conn === 'open'
  const gap = 12
  const sidePad = isMobile ? 12 : 20

  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--bg-0)',
        color: 'var(--fg-0)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Sidebar + bottom status footer wrapper */}
      <div
        style={{
          position: 'relative',
          display: isMobile ? 'contents' : 'block',
        }}
      >
        <Sidebar
          active="overview"
          mobileOpen={drawer.open}
          onMobileClose={drawer.onClose}
          hubTargetUuid={hubTargetUuid}
        />
        {/* Sidebar footer overlay — desktop only */}
        {!isMobile && (
          <div
            style={{
              position: 'fixed',
              left: 8,
              bottom: 8,
              width: 184,
              zIndex: 5,
            }}
          >
            <SystemStatusFooter conn={conn} lastUpdate={lastUpdate} />
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <Topbar
          title={siteName}
          subtitle={`CLUSTER · ${stats.total} NODES · ${regions.length} REGIONS`}
          theme={theme}
          onTheme={onTheme}
          online={stats.online}
          total={stats.total}
          conn={conn}
          lastUpdate={lastUpdate}
          onMobileMenu={drawer.onOpen}
          nodes={nodes}
          records={records}
          viewVersion={viewVersion}
          onViewVersionChange={onViewVersionChange}
        />
        <main
          className="app-main"
          style={{
            padding: sidePad,
            paddingBottom: isMobile ? 12 : 120, // leave room for sidebar footer overlay
            display: 'flex',
            flexDirection: 'column',
            gap,
          }}
        >
          {/* ── 1. Status Stripe ── */}
          <StatusStripe
            stats={stats}
            alertCount={alertSummary.counts.total}
            regionCount={regions.length}
            isLive={isLive}
            lastUpdate={lastUpdate}
          />

          {/* ── 2. Top row — 5 summary cards ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile
                ? '1fr 1fr'
                : 'repeat(auto-fit, minmax(160px, 1fr))',
              gap,
            }}
          >
            <HealthScoreCard health={health} yesterdayScore={yesterdayScore} />
            <ActiveAlertsCard
              summary={alertSummary}
              volumeSeries={alertVolumeSeries}
            />
            <ThroughputSummaryCard
              totalBytes={stats.totalNetUp + stats.totalNetDown}
              spark={throughputHistory.spark}
              deltaPct={throughputHistory.deltaPct}
            />
            <AvgPacketLossCard
              avgLoss={stats.avgLoss}
              spark={lossHistory.spark}
              deltaPct={lossHistory.deltaPct}
            />
            <ExpiringSoonCard stats={stats} withinDays={30} />
          </div>

          {/* ── 3. Global Throughput — user-selectable time window ── */}
          <GlobalThroughput24hChart
            netIn={historyChart.aggregate.netIn}
            netOut={historyChart.aggregate.netOut}
            totalIn={stats.totalNetDown}
            totalOut={stats.totalNetUp}
            windowLabel={
              chartHours === 24
                ? 'Last 24h'
                : chartHours < 168
                  ? `Last ${chartHours / 24}d`
                  : chartHours === 168
                    ? 'Last 7d'
                    : 'Last 30d'
            }
            timeWindow={chartHours}
            onTimeWindowChange={setChartHours}
          />

          {/* ── 4. Mid row — 4 panels ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(230px, 1fr))',
              gap,
            }}
          >
            <RegionDistributionDonut slices={regions} />
            <AlertSummaryPanel
              summary={alertSummary}
              onAlertClick={(uuid) => setDrawerUuid(uuid)}
              footerLink={{ label: 'View All Alerts', href: '#/v2/overview' }}
            />
            <RecentEventsPanel
              events={events}
              title="RECENT INCIDENTS"
              onEventClick={(uuid) => setDrawerUuid(uuid)}
              footerLink={{ label: 'View All Incidents', href: '#/v2/overview' }}
            />
            <HealthTrend7DChart points={trend} currentScore={health.score} />
          </div>

          {/* ── 5. Bottom row — 3 panels ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile
                ? '1fr'
                : 'repeat(auto-fit, minmax(280px, 1fr))',
              gap,
            }}
          >
            <AttentionNeededTable
              items={attention}
              onNodeClick={(uuid) => setDrawerUuid(uuid)}
              footerLink={{ label: 'View All Nodes', href: '#/v2/nodes' }}
            />
            <SystemHealthPanel
              conn={conn}
              lastUpdate={lastUpdate}
              recordCount={Object.keys(records).length}
              ping={ping}
              footerLink={{ label: 'View All Services', href: '#/v2/overview' }}
            />
            <NetworkLossHeatmap nodes={nodes} records={records} />
          </div>
        </main>
        <Footer />
      </div>

      <NodeDetailDrawer
        node={drawerNode}
        record={drawerRecord}
        onClose={() => setDrawerUuid(null)}
      />

      {/* 访客信息浮卡 — 同 v1 Overview 行为:本会话首次访问右下角浮出,
          10s 后自动消失。后台 theme_settings.visitor_alert='off' 可关闭。 */}
      <VisitorAlert
        enabled={
          (config?.theme_settings?.visitor_alert as string | undefined) !== 'off'
        }
      />
    </div>
  )
}
