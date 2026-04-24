import { useEffect, useState } from 'react'

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
  const [theme] = useState<Theme>(loadTheme)

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div style={{ padding: 20, color: 'var(--fg-1)' }}>
      <h1>岚 · Geo Tracking — multi-entry test</h1>
      <p>If you can read this, vite multi-entry works.</p>
    </div>
  )
}
