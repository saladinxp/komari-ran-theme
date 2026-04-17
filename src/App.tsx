import { useEffect, useState } from 'react'
import { OverviewPage } from '@/pages/Overview'
import { useKomari } from '@/hooks/useKomari'
import { MOCK_NODES, MOCK_RECORDS } from '@/data/mock'
import { ThemeCover } from '@/components/ThemeCover'

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

export default function App() {
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const { nodes, records, config, conn, ping } = useKomari()

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

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

  // Dev fallback: when running outside a Komari panel (no /api/nodes and no WS),
  // show mock data so the theme is previewable.
  const useMockFallback = nodes.length === 0 && conn !== 'open'
  const displayNodes = useMockFallback ? MOCK_NODES : nodes
  const displayRecords = useMockFallback ? MOCK_RECORDS : records

  const siteName = config?.site_name ?? '岚 · Komari'

  return (
    <OverviewPage
      nodes={displayNodes}
      records={displayRecords}
      theme={theme}
      onTheme={setTheme}
      siteName={siteName}
      conn={conn}
      ping={ping}
    />
  )
}
