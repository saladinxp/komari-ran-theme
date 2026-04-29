import { useEffect, useMemo, useState } from 'react'
import { OverviewPage } from '@/pages/Overview'
import { NodesPage } from '@/pages/Nodes'
import { NodeDetailPage } from '@/pages/NodeDetail'
import { TrafficPage } from '@/pages/Traffic'
import { BillingPage } from '@/pages/Billing'
import { HubPage } from '@/pages/Hub'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useKomari } from '@/hooks/useKomari'
import { useGlobalHistory } from '@/hooks/useGlobalHistory'
import { MOCK_NODES, MOCK_RECORDS } from '@/data/mock'
import { ThemeCover } from '@/components/ThemeCover'
import { useRoute } from '@/router/route'
import { applyFontScale, parseFontScale } from '@/utils/fontScale'
import { setBpsUnitMode, parseBpsUnitMode } from '@/utils/format'

type Theme = 'ran-night' | 'ran-mist'

const THEME_KEY = 'ran.theme'

function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'ran-night' || v === 'ran-mist') return v
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'ran-mist'
  }
  return 'ran-night'
}

/** Detect ?cover URL param to render the theme cover card alone (used to generate preview.png). */
function isCoverMode(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('cover')
}

// Early bailout: if Komari SPA-served us index.html on the /map URL
// (because the user refreshed /map, which has no real file behind it
// after MapApp's history.replaceState), bounce immediately to map.html
// instead of letting the main app render Overview. Runs at module load
// so it happens before React even renders.
if (
  typeof window !== 'undefined' &&
  window.location.protocol !== 'file:' &&
  /\/map\/?$/.test(window.location.pathname)
) {
  window.location.replace(
    './map.html' + window.location.search + window.location.hash,
  )
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const route = useRoute()
  const { nodes, records, config, conn, ping, lastUpdate } = useKomari()

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  // 字号档位 — 跟随 Komari 后台 theme_settings.font_scale 实时变化。
  // 写到 <html> 上的 CSS 变量,各组件通过 contentFs() 读取。
  useEffect(() => {
    const raw = config?.theme_settings?.font_scale
    applyFontScale(parseFontScale(raw))
  }, [config?.theme_settings?.font_scale])

  // 流量单位策略 — 跟随 theme_settings.bps_unit。
  // formatBps / compactBps 内部读取模块状态;改完触发组件 re-render
  // 是靠 config 变化本身(useKomari 返回新 config 引用),
  // 不需要单独发广播。
  useEffect(() => {
    const raw = config?.theme_settings?.bps_unit
    setBpsUnitMode(parseBpsUnitMode(raw))
  }, [config?.theme_settings?.bps_unit])

  // Cover mode — render only the theme thumbnail card.
  if (isCoverMode()) {
    const params = new URLSearchParams(window.location.search)
    const coverTheme = (params.get('theme') as Theme) || theme
    return (
      <div
        style={{
          display: 'inline-block',
          padding: 0,
          margin: 0,
          background: 'transparent',
        }}
      >
        <ThemeCover theme={coverTheme} />
      </div>
    )
  }

  // Dev-only mock fallback: only kick in when running outside a real Komari host
  // (e.g. file:// preview, or an empty origin). On a real http(s) origin we wait
  // for the API to load — using mock there would briefly route a real-uuid detail
  // page to "Node not found" before the WS data lands, causing flicker on refresh.
  const isDevPreview =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' || window.location.origin === 'null')
  const useMockFallback = isDevPreview && nodes.length === 0
  const displayNodes = useMockFallback ? MOCK_NODES : nodes
  const displayRecords = useMockFallback ? MOCK_RECORDS : records

  // Global per-node + aggregated history — fetched once, shared across pages.
  // Skipped in mock-fallback (no real API to hit).
  const realUuids = useMemo(
    () => (useMockFallback ? [] : displayNodes.map((n) => n.uuid)),
    [displayNodes, useMockFallback],
  )
  const globalHistory = useGlobalHistory(realUuids, 1)

  const siteName = config?.site_name ?? '岚 · Komari'

  // Pick a default uuid for the Hub sidebar entry. Prefer the first online
  // node so the cockpit lands on something interesting. Fall back to the
  // first node, and finally undefined (which disables the sidebar entry).
  const hubTargetUuid = useMemo(() => {
    const firstOnline = displayNodes.find((n) => displayRecords[n.uuid]?.online)
    return firstOnline?.uuid ?? displayNodes[0]?.uuid
  }, [displayNodes, displayRecords])

  // Route dispatch
  switch (route.name) {
    case 'hub': {
      // Hub needs a uuid; if missing, redirect to the default target via 404.
      const target = route.uuid ?? hubTargetUuid
      if (!target) {
        // No nodes at all — fall through to overview which already handles empty-state nicely.
        break
      }
      return (
        <ErrorBoundary scope="hub" resetKey={target}>
          <HubPage
            uuid={target}
            nodes={displayNodes}
            records={displayRecords}
            theme={theme}
            onTheme={setTheme}
            siteName={siteName}
            lastUpdate={lastUpdate}
            conn={conn}
            config={config}
            ping={ping}
            hubTargetUuid={hubTargetUuid}
          />
        </ErrorBoundary>
      )
    }

    case 'nodes':
      if (route.uuid) {
        return (
          <NodeDetailPage
            uuid={route.uuid}
            nodes={displayNodes}
            records={displayRecords}
            theme={theme}
            onTheme={setTheme}
            siteName={siteName}
            lastUpdate={lastUpdate}
            conn={conn}
            config={config}
            hubTargetUuid={hubTargetUuid}
          />
        )
      }
      return (
        <NodesPage
          nodes={displayNodes}
          records={displayRecords}
          theme={theme}
          onTheme={setTheme}
          siteName={siteName}
          lastUpdate={lastUpdate}
          conn={conn}
          history={globalHistory}
          config={config}
          hubTargetUuid={hubTargetUuid}
        />
      )

    case 'traffic':
      return (
        <TrafficPage
          nodes={displayNodes}
          records={displayRecords}
          theme={theme}
          onTheme={setTheme}
          siteName={siteName}
          lastUpdate={lastUpdate}
          conn={conn}
          history={globalHistory}
          config={config}
          hubTargetUuid={hubTargetUuid}
        />
      )

    case 'map': {
      // The geo map now lives in a separate HTML entry (dist/map.html).
      // If anyone hits #/map directly (legacy bookmark, manual URL, hub deep
      // link from an older build), bounce them to the standalone page.
      if (typeof window !== 'undefined') {
        window.location.replace('./map.html')
      }
      return null
    }

    case 'billing':
      return (
        <BillingPage
          nodes={displayNodes}
          records={displayRecords}
          theme={theme}
          onTheme={setTheme}
          siteName={siteName}
          lastUpdate={lastUpdate}
          conn={conn}
          config={config}
          hubTargetUuid={hubTargetUuid}
        />
      )

    case 'overview':
    default:
      return (
        <OverviewPage
          nodes={displayNodes}
          records={displayRecords}
          theme={theme}
          onTheme={setTheme}
          siteName={siteName}
          lastUpdate={lastUpdate}
          conn={conn}
          ping={ping}
          history={globalHistory}
          config={config}
          hubTargetUuid={hubTargetUuid}
        />
      )
  }

  // Fallback (e.g. hub with no target and no nodes): render Overview.
  return (
    <OverviewPage
      nodes={displayNodes}
      records={displayRecords}
      theme={theme}
      onTheme={setTheme}
      siteName={siteName}
      lastUpdate={lastUpdate}
      conn={conn}
      ping={ping}
      history={globalHistory}
      config={config}
      hubTargetUuid={hubTargetUuid}
    />
  )
}
