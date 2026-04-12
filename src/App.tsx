import { useEffect, useState } from 'react'
import { OverviewPage } from '@/pages/Overview'
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

export default function App() {
  const [theme, setTheme] = useState<Theme>(loadTheme)

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  return (
    <OverviewPage
      nodes={MOCK_NODES}
      records={MOCK_RECORDS}
      theme={theme}
      onTheme={setTheme}
    />
  )
}
