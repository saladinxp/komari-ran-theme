import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { StatusDot } from '@/components/atoms/StatusDot'
import { Icon } from '@/components/atoms/icons'

type Theme = 'ran-night' | 'ran-mist'
type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'

interface Props {
  title: string
  subtitle?: string
  theme: Theme
  onTheme: (t: Theme) => void
  online: number
  total: number
  conn: Conn
}

/**
 * Topbar — title + status pill + search field + theme segmented control.
 */
export function Topbar({ title, subtitle, theme, onTheme, online, total, conn }: Props) {
  const connStatus =
    conn === 'open' ? 'good' : conn === 'connecting' ? 'info' : conn === 'error' ? 'bad' : 'idle'
  const connLabel =
    conn === 'open' ? 'LIVE' : conn === 'connecting' ? 'CONNECTING' : conn === 'error' ? 'ERROR' : 'OFFLINE'

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--edge-mid)',
        boxShadow: '0 1px 0 var(--edge-bright)',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: 1 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--fg-0)',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </span>
            <SerialPlate>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <StatusDot status={connStatus} size={5} pulse={conn === 'open'} />
                {online}/{total} · {connLabel}
              </span>
            </SerialPlate>
          </div>
          {subtitle && <Etch>{subtitle}</Etch>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Search field — visual only for now */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 10px',
            background: 'var(--bg-inset)',
            border: '1px solid var(--edge-engrave)',
            borderRadius: 4,
            minWidth: 220,
            boxShadow: 'inset 0 1px 0 var(--edge-deep)',
          }}
        >
          <span style={{ color: 'var(--fg-3)' }}>{Icon.search}</span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--fg-3)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.06em',
              flex: 1,
            }}
          >
            SEARCH NODES
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--fg-3)',
              padding: '1px 4px',
              border: '1px solid var(--edge-engrave)',
              borderRadius: 2,
            }}
          >
            ⌘K
          </span>
        </div>

        <Segmented
          options={[
            { value: 'ran-night', label: 'NIGHT' },
            { value: 'ran-mist', label: 'MIST' },
          ]}
          value={theme}
          onChange={(v) => onTheme(v as Theme)}
        />
      </div>
    </header>
  )
}

interface SegmentedProps {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (v: string) => void
}

function Segmented({ options, value, onChange }: SegmentedProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--bg-inset)',
        border: '1px solid var(--edge-engrave)',
        borderRadius: 4,
        padding: 2,
        boxShadow: 'inset 0 1px 0 var(--edge-deep)',
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: '4px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontWeight: 500,
              border: active ? '1px solid var(--edge-mid)' : '1px solid transparent',
              borderRadius: 3,
              background: active ? 'var(--bg-3)' : 'transparent',
              color: active ? 'var(--fg-0)' : 'var(--fg-2)',
              boxShadow: active
                ? '0 1px 0 var(--edge-bright) inset, 0 -1px 0 var(--edge-deep) inset'
                : 'none',
              cursor: 'pointer',
              transition: 'background 120ms, color 120ms',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
