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
import { useKomari } from '@/hooks/useKomari'
import { MOCK_NODES, MOCK_RECORDS } from '@/data/mock'

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
  const { nodes, records, config, conn, lastUpdate } = useKomari()

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

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

  const hubTargetUuid = useMemo(() => {
    const firstOnline = displayNodes.find((n) => displayRecords[n.uuid]?.online)
    return firstOnline?.uuid ?? displayNodes[0]?.uuid
  }, [displayNodes, displayRecords])

  const siteName = config?.site_name ?? '岚 · Komari'
  const subtitle = `${displayNodes.length} NODES · ${regionCount} REGIONS · GEO TRACKING`

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
        version="v0.9.11"
        hubTargetUuid={hubTargetUuid}
        crossPage
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
        />

        <main
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
            {/* TODO milestone 4: render the actual map here. */}
            <div
              style={{
                minHeight: 480,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                background:
                  'repeating-linear-gradient(45deg, transparent, transparent 6px, var(--edge-engrave) 6px, var(--edge-engrave) 7px)',
                color: 'var(--fg-2)',
              }}
            >
              <Etch>STANDALONE PAGE · MAP.HTML</Etch>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                MAP RENDERER · MILESTONE 4
              </span>
              <Etch>D3-GEO + NATURAL EARTH · INCOMING</Etch>
            </div>
          </CardFrame>
        </main>

        <Footer version="v0.9.11" config={config} />
      </div>
    </div>
  )
}
