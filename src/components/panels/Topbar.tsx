import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { StatusDot } from '@/components/atoms/StatusDot'

interface Props {
  title: string
  subtitle?: string
  theme: 'ran-night' | 'ran-mist'
  onTheme: (t: 'ran-night' | 'ran-mist') => void
  online: number
  total: number
}

/**
 * Topbar — system header with title, status summary, theme toggle.
 */
export function Topbar({ title, subtitle, theme, onTheme, online, total }: Props) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid var(--edge-engrave)',
        background: 'var(--bg-1)',
        boxShadow: '0 1px 0 var(--edge-bright)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--fg-0)',
          }}
        >
          {title}
        </span>
        {subtitle && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: 'var(--fg-3)',
            }}
          >
            {subtitle}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <SerialPlate>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <StatusDot status="good" size={5} />
            {online}/{total} ONLINE
          </span>
        </SerialPlate>

        <ThemeToggle theme={theme} onTheme={onTheme} />
      </div>
    </header>
  )
}

function ThemeToggle({
  theme,
  onTheme,
}: {
  theme: 'ran-night' | 'ran-mist'
  onTheme: (t: 'ran-night' | 'ran-mist') => void
}) {
  const next = theme === 'ran-night' ? 'ran-mist' : 'ran-night'
  return (
    <button
      type="button"
      onClick={() => onTheme(next)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        background: 'var(--bg-2)',
        border: '1px solid var(--edge-mid)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: 'var(--shadow-button)',
        color: 'var(--fg-1)',
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
      }}
      title="Toggle theme"
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: theme === 'ran-night' ? '#1a1d22' : '#fbf5e9',
          border: '1px solid var(--edge-deep)',
        }}
      />
      {theme === 'ran-night' ? 'NIGHT' : 'MIST'}
    </button>
  )
}
