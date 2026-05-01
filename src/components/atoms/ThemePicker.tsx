import { useEffect, useRef, useState } from 'react'

export type Theme = 'ran-night' | 'ran-mist' | 'ran-ember' | 'ran-sakura' | 'ran-lavender'

interface Props {
  value: Theme
  onChange: (t: Theme) => void
}

interface ThemeOption {
  value: Theme
  /** Latin name shown in the picker (also used in the trigger). */
  name: string
  /** Single-character Chinese subtitle for the picker row. */
  zh: string
  /** Three-band swatch: bg-0 (ground), bg-2 (card), accent (chip). */
  swatch: { bg: string; card: string; accent: string }
}

/**
 * Theme catalog — kept in sync with src/styles/tokens.css.
 * Order is the order shown in the picker.
 *
 * Note: rendered at top-level in the ThemePicker component, so they
 * paint with their own colors regardless of which theme is currently
 * applied to <html data-theme>.
 */
const THEMES: ThemeOption[] = [
  {
    value: 'ran-night',
    name: 'NIGHT',
    zh: '夜',
    swatch: { bg: '#0c0d0f', card: '#1a1d22', accent: '#c28840' },
  },
  {
    value: 'ran-mist',
    name: 'MIST',
    zh: '雾',
    swatch: { bg: '#f0e9dc', card: '#fbf5e9', accent: '#a06820' },
  },
  {
    value: 'ran-ember',
    name: 'EMBER',
    zh: '烬',
    swatch: { bg: '#1c0c0a', card: '#2a1815', accent: '#c8853a' },
  },
  {
    value: 'ran-sakura',
    name: 'SAKURA',
    zh: '樱',
    swatch: { bg: '#fbe6ea', card: '#fdeff2', accent: '#c4426a' },
  },
  {
    value: 'ran-lavender',
    name: 'LAVENDER',
    zh: '薰',
    swatch: { bg: '#e4dceb', card: '#ede7f3', accent: '#7048a4' },
  },
]

/**
 * ThemePicker — replaces the cramped 5-button Segmented theme switcher.
 *
 * Trigger: small button showing the current theme's accent dot + name.
 * Panel: dropdown anchored under the trigger; one row per theme with
 * a 3-band swatch (ground / card / accent) so users can recognize the
 * palette without translating jargon. Click-outside and ESC close.
 */
export function ThemePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const current = THEMES.find((t) => t.value === value) ?? THEMES[0]

  // Click-outside to close.
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger — current theme indicator + dropdown caret */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="切换主题"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '4px 9px 4px 7px',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontWeight: 500,
          color: 'var(--fg-1)',
          background: open ? 'var(--bg-3)' : 'var(--bg-inset)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 4,
          cursor: 'pointer',
          boxShadow:
            'inset 0 1px 0 var(--edge-deep), inset 0 -1px 0 var(--edge-bright)',
          transition: 'background 120ms',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: 2,
            background: current.swatch.accent,
            border: '1px solid var(--edge-engrave)',
            flexShrink: 0,
          }}
        />
        <span>{current.name}</span>
        <span
          aria-hidden="true"
          style={{
            fontSize: 8,
            opacity: 0.6,
            marginLeft: 1,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 120ms',
          }}
        >
          ▾
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          aria-label="主题选择"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 180,
            background: 'var(--bg-1)',
            border: '1px solid var(--edge-mid)',
            borderRadius: 4,
            boxShadow:
              '0 1px 0 var(--edge-bright) inset, 0 4px 14px rgba(0,0,0,0.18)',
            padding: 3,
            zIndex: 30,
          }}
        >
          {THEMES.map((opt) => {
            const active = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '7px 9px',
                  border: 'none',
                  background: active ? 'var(--bg-3)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderRadius: 3,
                  borderLeft: active
                    ? '2px solid var(--accent)'
                    : '2px solid transparent',
                  transition: 'background 100ms',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'var(--bg-2)'
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent'
                }}
              >
                {/* 3-band swatch — bg / card / accent. Rendered with
                    inline colors so it shows the option's palette,
                    not the currently-applied theme's. */}
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex',
                    width: 26,
                    height: 16,
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: '1px solid var(--edge-engrave)',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ flex: 1, background: opt.swatch.bg }} />
                  <span style={{ flex: 1, background: opt.swatch.card }} />
                  <span style={{ flex: 1, background: opt.swatch.accent }} />
                </span>
                <span
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 7,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      fontWeight: 500,
                      color: active ? 'var(--fg-0)' : 'var(--fg-1)',
                    }}
                  >
                    {opt.name}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 12,
                      color: 'var(--fg-2)',
                    }}
                  >
                    {opt.zh}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
