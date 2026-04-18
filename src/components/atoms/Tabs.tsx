import { useState, type ReactNode } from 'react'

interface Tab {
  id: string
  label: string
  badge?: ReactNode
}

interface Props {
  tabs: Tab[]
  defaultTab?: string
  active?: string
  onChange?: (id: string) => void
}

/**
 * Tabs — segmented row of tab labels with a 2px accent rail under the active one.
 * Lives at the top of a section; the panel for each tab lives outside this component
 * (parent controls which content to render based on the active id).
 */
export function Tabs({ tabs, defaultTab, active, onChange }: Props) {
  const [internal, setInternal] = useState(defaultTab ?? tabs[0]?.id)
  const current = active ?? internal

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 0,
        borderBottom: '1px solid var(--edge-engrave)',
      }}
    >
      {tabs.map((t) => {
        const isActive = t.id === current
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setInternal(t.id)
              onChange?.(t.id)
            }}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              color: isActive ? 'var(--fg-0)' : 'var(--fg-2)',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'color 120ms',
              marginBottom: -1,
            }}
          >
            {t.label}
            {t.badge}
          </button>
        )
      })}
    </div>
  )
}
