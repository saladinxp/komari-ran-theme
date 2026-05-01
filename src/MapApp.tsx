/**
 * MapApp — 独立 HTML 入口(map.html → src/map-entry.tsx)
 *
 * 跟主 App.tsx 平行,共享 useKomari 数据流和所有 chrome 组件,但只渲染
 * Geo Map 一种视图。这样首屏(index.html)不背地图代码体积,
 * 同时地图自己能放开膀子做"华丽版"(d3-geo + natural-earth + 缩放等)。
 *
 * 跨页跳转:Sidebar 设置 crossPage=true,所有非 map 链接都会带上
 * `./index.html#/...` 前缀,确保浏览器跳回主 app 而不是只更新 map.html
 * 自己的 hash。
 *
 * 主题持久化:跟主 app 共用 localStorage 的 `ran.theme` key —— 用户在
 * index.html 切到 Mist,跳到 map.html 时也是 Mist。
 */

import { useEffect, useMemo, useState } from 'react'
import { Topbar } from '@/components/panels/Topbar'
import { Sidebar } from '@/components/panels/Sidebar'
import { Footer } from '@/components/panels/Footer'
import { CardFrame } from '@/components/panels/CardFrame'
import { Etch } from '@/components/atoms/Etch'
import { Icon } from '@/components/atoms/icons'
import { WorldMapPro } from '@/components/charts/WorldMapPro'
import { VisitorFocusMap } from '@/components/charts/VisitorFocusMap'
import { useKomari } from '@/hooks/useKomari'
import { useIsMobile, useMobileDrawer } from '@/hooks/useMediaQuery'
import { MOCK_NODES, MOCK_RECORDS } from '@/data/mock'
import { regionToISO } from '@/utils/region'
import { nodeToCityLabel } from '@/utils/cities'
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

export default function MapApp() {
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const drawer = useMobileDrawer()
  const isMobile = useIsMobile()
  const { nodes, records, config, conn, lastUpdate } = useKomari()

  // embed 模式:被 iframe 嵌入时的精简渲染。
  //   ?embed=1                 — Hub 卡片用,完整 WorldMapPro
  //   ?embed=visitor&lat=&lon= — VisitorAlert 用,纯静态地图 + 一个高亮焦点
  //                               不调 useKomari、不画节点,零额外开销
  // 用 useState 一次性读取(URL 不会变),避免每次渲染都查 location。
  const [embedConfig] = useState(() => {
    if (typeof window === 'undefined') return null
    const sp = new URLSearchParams(window.location.search)
    const v = sp.get('embed')
    if (v === '1') return { mode: 'hub' as const }
    if (v === 'visitor') {
      const lat = parseFloat(sp.get('lat') ?? '')
      const lon = parseFloat(sp.get('lon') ?? '')
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return { mode: 'visitor' as const, lat, lon }
      }
    }
    return null
  })
  const embed = embedConfig !== null

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  // 字号档位 — 跟主页面 App.tsx 同样的 theme_settings.font_scale 接入,
  // 让 map.html 与首页字号体感一致。
  useEffect(() => {
    const raw = config?.theme_settings?.font_scale
    applyFontScale(parseFontScale(raw))
  }, [config?.theme_settings?.font_scale])

  // 流量单位策略 — 同首页一致
  useEffect(() => {
    const raw = config?.theme_settings?.bps_unit
    setBpsUnitMode(parseBpsUnitMode(raw))
  }, [config?.theme_settings?.bps_unit])

  // embed 模式:监听父页 localStorage 改动 → 跟随父页主题切换。
  // storage event 只在"其他文档同源 storage 改动"时触发(同 iframe 内
  // 的 setItem 不会触发自己),正好用来让被嵌入的 map 跟主页主题同步。
  useEffect(() => {
    if (!embed) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_KEY) return
      if (e.newValue === 'ran-night' || e.newValue === 'ran-mist') {
        setTheme(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [embed])

  // Hide the `.html` suffix from the URL bar — same trick NanoMuse's
  // nexus.html uses. The page itself is still served from /map.html;
  // this is purely cosmetic. Skipped in file:// previews and embed mode.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.protocol === 'file:') return
    if (embed) return
    const path = window.location.pathname
    if (path.endsWith('/map.html')) {
      const cleaned = path.replace(/\/map\.html$/, '/map')
      window.history.replaceState(null, '', cleaned + window.location.search + window.location.hash)
    }
  }, [embed])

  // 跟主 app 一致:本地 file:// 预览时降级到 mock
  const isDevPreview =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' || window.location.origin === 'null')
  const useMockFallback = isDevPreview && nodes.length === 0
  const displayNodes = useMockFallback ? MOCK_NODES : nodes
  const displayRecords = useMockFallback ? MOCK_RECORDS : records

  const onlineCount = displayNodes.reduce(
    (acc, n) => acc + (displayRecords[n.uuid]?.online ? 1 : 0),
    0,
  )
  const regionCount = useMemo(
    () => new Set(displayNodes.map((n) => n.region).filter(Boolean)).size,
    [displayNodes],
  )
  const cityCount = useMemo(() => {
    const s = new Set<string>()
    for (const n of displayNodes) {
      const c = nodeToCityLabel(n)
      if (c) s.add(c)
    }
    return s.size
  }, [displayNodes])
  const isoSet = useMemo(() => {
    const s = new Set<string>()
    for (const n of displayNodes) {
      const iso = regionToISO(n.region)
      if (iso) s.add(iso)
    }
    return s
  }, [displayNodes])

  const hubTargetUuid = useMemo(() => {
    const firstOnline = displayNodes.find((n) => displayRecords[n.uuid]?.online)
    return firstOnline?.uuid ?? displayNodes[0]?.uuid
  }, [displayNodes, displayRecords])

  const siteName = config?.site_name ?? '岚 · Komari'
  const subtitle = `${displayNodes.length} NODES · ${regionCount} REGIONS · GEO TRACKING`

  // embed 模式短路:只渲染地图本体,无 sidebar/topbar/footer/底部 stats。
  //   - hub:   Hub 卡片用,完整 WorldMapPro
  //   - visitor: VisitorAlert 用,纯静态轻量地图 + 单个高亮焦点
  if (embedConfig?.mode === 'visitor') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
        }}
      >
        <VisitorFocusMap lat={embedConfig.lat} lon={embedConfig.lon} />
      </div>
    )
  }

  if (embed) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg-1)',
          color: 'var(--fg-1)',
          fontFamily: 'var(--font-sans)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 8,
        }}
      >
        {isMobile ? (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fg-3)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              padding: '24px 12px',
              textAlign: 'center',
            }}
          >
            DESKTOP RECOMMENDED · TAP TO OPEN
          </div>
        ) : (
          <WorldMapPro
            nodes={displayNodes}
            records={displayRecords}
            activeUuid={hubTargetUuid}
          />
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--bg-0)',
        color: 'var(--fg-1)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Sidebar
        active="map"
        version="v1.0.9"
        hubTargetUuid={hubTargetUuid}
        crossPage
        mobileOpen={drawer.open}
        onMobileClose={drawer.onClose}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          title={siteName}
          subtitle={subtitle}
          theme={theme}
          onTheme={setTheme}
          online={onlineCount}
          total={displayNodes.length}
          conn={conn}
          lastUpdate={lastUpdate}
          onMobileMenu={drawer.onOpen}
          nodes={displayNodes}
          records={records}
        />

        <main
          className="app-main"
          style={{
            flex: 1,
            padding: '20px 24px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minWidth: 0,
          }}
        >
          <CardFrame
            title="Global Fleet Map"
            code="GEO · 01"
            action={
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--fg-2)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                <span style={{ color: 'var(--accent-bright)' }}>{Icon.globe}</span>
                {onlineCount}/{displayNodes.length} ACTIVE
              </span>
            }
          >
            {isMobile ? (
              // The pro map (drag pan / wheel zoom / hover tooltips / pinpoint
              // probes) is built for a pointing device; on a touch screen the
              // pan gesture fights the page scroll, and the dense node markers
              // are unreadable below ~600px wide. Show a discreet placeholder
              // and direct mobile users to the desktop view. Fleet Stats and
              // Nodes by Region cards below still render normally so the page
              // isn't a total dead-end.
              <div
                style={{
                  padding: '48px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 14,
                  color: 'var(--fg-2)',
                }}
              >
                <span
                  style={{
                    color: 'var(--accent-bright)',
                    width: 44,
                    height: 44,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg-inset)',
                    border: '1px solid var(--edge-engrave)',
                    borderRadius: 6,
                    boxShadow: 'inset 0 1px 0 var(--edge-deep)',
                  }}
                >
                  {Icon.globe}
                </span>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--fg-3)',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                  }}
                >
                  DESKTOP RECOMMENDED
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--fg-1)',
                    maxWidth: 280,
                    lineHeight: 1.5,
                  }}
                >
                  地图视图针对桌面端拖拽与缩放优化。窄屏触控环境下节点密集会重叠,
                  且滑动手势会与页面滚动冲突。建议在桌面端访问以获得完整体验。
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <a
                    href="./"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      padding: '8px 14px',
                      background: 'var(--bg-0)',
                      border: '1px solid var(--edge-mid)',
                      borderRadius: 4,
                      color: 'var(--fg-0)',
                      textDecoration: 'none',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      boxShadow: 'inset 0 1px 0 var(--edge-bright)',
                    }}
                  >
                    ← Back to Overview
                  </a>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--fg-3)',
                    letterSpacing: '0.14em',
                  }}
                >
                  {onlineCount}/{displayNodes.length} ACTIVE · {regionCount} REGIONS · {cityCount} CITIES
                </div>
              </div>
            ) : (
              <WorldMapPro
                nodes={displayNodes}
                records={displayRecords}
                activeUuid={hubTargetUuid}
              />
            )}
          </CardFrame>

          {/* 底部 telemetry strip + region 节点列表 */}
          <div
            className="map-bottom-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)',
              gap: 16,
              minWidth: 0,
            }}
          >
            <CardFrame title="Fleet Stats" code="GEO · 02">
              <FleetStats
                total={displayNodes.length}
                online={onlineCount}
                regions={regionCount}
                cities={cityCount}
                isoSet={isoSet}
              />
            </CardFrame>
            <CardFrame title="Nodes by Region" code="GEO · 03">
              <NodesByRegion nodes={displayNodes} records={displayRecords} />
            </CardFrame>
          </div>
        </main>

        <Footer version="v1.0.9" config={config} />
      </div>
    </div>
  )
}

// ---- 子组件 ----

function FleetStats({
  total,
  online,
  regions,
  cities,
  isoSet,
}: {
  total: number
  online: number
  regions: number
  cities: number
  isoSet: Set<string>
}) {
  const offline = total - online
  const onlinePct = total ? Math.round((online / total) * 100) : 0
  const items: Array<[string, string, string]> = [
    ['NODES TOTAL', String(total), 'var(--fg-0)'],
    ['ONLINE', `${online} · ${onlinePct}%`, 'var(--signal-good)'],
    ['OFFLINE', String(offline), offline > 0 ? 'var(--signal-bad)' : 'var(--fg-3)'],
    ['REGIONS', String(regions), 'var(--fg-0)'],
    ['CITIES MAPPED', String(cities), 'var(--fg-0)'],
    ['ISO COVERAGE', `${isoSet.size}`, 'var(--fg-0)'],
  ]
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 0,
        borderTop: '1px solid var(--edge-engrave)',
      }}
    >
      {items.map(([label, value, color], i) => (
        <div
          key={label}
          style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--edge-engrave)',
            borderRight: i % 2 === 0 ? '1px solid var(--edge-engrave)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <Etch>{label}</Etch>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 18,
              fontWeight: 600,
              color,
              letterSpacing: '-0.01em',
            }}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}

function NodesByRegion({
  nodes,
  records,
}: {
  nodes: import('@/types/komari').KomariNode[]
  records: Record<string, import('@/types/komari').KomariRecord>
}) {
  // 按 region (emoji flag) 聚合,统计在线/总数
  const groups = useMemo(() => {
    const m = new Map<string, { iso: string; online: number; total: number; nodes: typeof nodes }>()
    for (const n of nodes) {
      const region = n.region ?? '—'
      const iso = regionToISO(n.region) ?? '—'
      const g = m.get(region) ?? { iso, online: 0, total: 0, nodes: [] }
      g.total += 1
      if (records[n.uuid]?.online) g.online += 1
      g.nodes.push(n)
      m.set(region, g)
    }
    return Array.from(m.entries())
      .map(([region, g]) => ({ region, ...g }))
      .sort((a, b) => b.total - a.total)
  }, [nodes, records])

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {groups.map((g) => {
        const pct = g.total ? (g.online / g.total) * 100 : 0
        return (
          <div
            key={g.region}
            style={{
              display: 'grid',
              gridTemplateColumns: '32px minmax(0, 1fr) 70px 60px',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px',
              borderBottom: '1px solid var(--edge-engrave)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
            }}
          >
            <span style={{ fontSize: 16 }}>{g.region}</span>
            <span style={{ color: 'var(--fg-2)', letterSpacing: '0.1em' }}>{g.iso}</span>
            <div
              style={{
                height: 4,
                background: 'var(--edge-engrave)',
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
                  width: `${pct}%`,
                  background:
                    pct >= 80
                      ? 'var(--signal-good)'
                      : pct >= 50
                        ? 'var(--accent-bright)'
                        : pct > 0
                          ? 'var(--signal-warn)'
                          : 'var(--signal-bad)',
                }}
              />
            </div>
            <span style={{ textAlign: 'right', color: 'var(--fg-1)' }}>
              <span style={{ color: 'var(--signal-good)' }}>{g.online}</span>
              <span style={{ color: 'var(--fg-3)' }}> / </span>
              <span>{g.total}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
