interface Option {
  value: string
  label: string
}

interface Props {
  options: Option[]
  value: string
  onChange: (v: string) => void
  /** 'sm' = 9px font; 'md' = 10px font */
  size?: 'sm' | 'md'
}

/**
 * Segmented — pill-style toggle group.
 * Active item gets the chamfered raised look; others stay flat.
 */
export function Segmented({ options, value, onChange, size = 'md' }: Props) {
  const fontSize = size === 'sm' ? 9 : 10
  const padX = size === 'sm' ? 8 : 10
  const padY = size === 'sm' ? 3 : 4

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
              padding: `${padY}px ${padX}px`,
              fontFamily: 'var(--font-mono)',
              fontSize,
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
