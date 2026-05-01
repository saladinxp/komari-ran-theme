import { useEffect, useMemo, useRef, useState } from 'react'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { StatusDot } from '@/components/atoms/StatusDot'
import { ThemePicker } from '@/components/atoms/ThemePicker'
import { Icon } from '@/components/atoms/icons'
import { useIsMobile, useIsNarrow } from '@/hooks/useMediaQuery'
import { useSearchQuery, nodeMatchesQuery } from '@/hooks/useSearchQuery'
import { contentFs } from '@/utils/fontScale'
import type { KomariNode, KomariRecord } from '@/types/komari'

type Theme = 'ran-night' | 'ran-mist' | 'ran-ember' | 'ran-sakura' | 'ran-lavender'
type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'

interface Props {
  title: string
  subtitle?: string
  theme: Theme
  onTheme: (t: Theme) => void
  online: number
  total: number
  conn: Conn
  /** Timestamp of the last successful WS message, for the "Xs ago" hint. */
  lastUpdate?: number | null
  /**
   * When provided, render a hamburger button on the left that calls this
   * to open the mobile sidebar drawer. Desktop hides it via media query.
   */
  onMobileMenu?: () => void
  /**
   * When provided, the search box becomes a live filter + node jumper.
   * Without these props the search box is hidden — pages that don't have
   * a node list (NodeDetail, Traffic, Billing) can opt out simply by not
   * passing nodes/records.
   */
  nodes?: KomariNode[]
  records?: Record<string, KomariRecord>
}

const MAX_SUGGESTIONS = 8

/**
 * Topbar — title + status pill + search field + theme segmented control.
 * Shows a live-updating "Xs ago" hint so the page reads as alive even
 * when all metrics happen to be flat (e.g. an idle 1-core node).
 *
 * Responsive behavior:
 * - md (≤768px): hamburger button appears, search collapses to icon-only,
 *   subtitle is hidden, theme switch shrinks
 * - sm (≤480px): "Xs ago" hint hidden, title gets ellipsis cap
 *
 * Search behavior (when nodes/records props are provided):
 * - Typing fires `setQuery` from useSearchQuery — Overview / Nodes pages
 *   subscribe and filter their node lists in realtime.
 * - A dropdown shows up to 8 matching nodes; ↑↓ to select, Enter to jump
 *   to NodeDetail, Esc to clear-and-blur. Click also jumps.
 * - Cmd+K / Ctrl+K / `/` (when no other input is focused) — focus search.
 */
export function Topbar({
  title,
  subtitle,
  theme,
  onTheme,
  online,
  total,
  conn,
  lastUpdate,
  onMobileMenu,
  nodes,
  records,
}: Props) {
  const isMobile = useIsMobile()
  const isNarrow = useIsNarrow()
  const connStatus =
    conn === 'open' ? 'good' : conn === 'connecting' ? 'info' : conn === 'error' ? 'bad' : 'idle'
  const connLabel =
    conn === 'open' ? 'LIVE' : conn === 'connecting' ? 'CONNECTING' : conn === 'error' ? 'ERROR' : 'OFFLINE'

  // Tick once per second so the "Xs ago" badge stays current.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  let agoLabel: string | null = null
  if (lastUpdate && conn === 'open') {
    const sec = Math.max(0, Math.round((now - lastUpdate) / 1000))
    agoLabel = sec < 2 ? 'JUST NOW' : `${sec}s ago`
  }

  // ────────── Search wiring ──────────
  const searchEnabled = !!nodes
  const [query, setQuery] = useSearchQuery()
  const [focused, setFocused] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const desktopInputRef = useRef<HTMLInputElement | null>(null)
  const mobileInputRef = useRef<HTMLInputElement | null>(null)

  // Compute suggestions — case-insensitive multi-field match.
  const suggestions = useMemo(() => {
    if (!searchEnabled || !query.trim() || !nodes) return []
    const out: KomariNode[] = []
    for (const n of nodes) {
      if (nodeMatchesQuery(n, query)) {
        out.push(n)
        if (out.length >= MAX_SUGGESTIONS) break
      }
    }
    return out
  }, [nodes, query, searchEnabled])

  // Reset highlighted index when the query changes — pure response to a state
  // we own; the lint rule's cascading-render concern doesn't apply here since
  // setActiveIdx(0) is idempotent and the effect only fires on query change.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  function focusSearch() {
    if (isMobile) {
      setMobileSearchOpen(true)
      // Defer so the panel is in the DOM before we focus.
      requestAnimationFrame(() => mobileInputRef.current?.focus())
    } else {
      desktopInputRef.current?.focus()
    }
  }

  // Global hotkeys: Cmd+K / Ctrl+K / "/" → focus search; Esc handled by input.
  useEffect(() => {
    if (!searchEnabled) return
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        focusSearch()
        return
      }
      // "/" — only when not already typing in another field.
      if (e.key === '/' && !meta) {
        const el = document.activeElement as HTMLElement | null
        const tag = el?.tagName
        const editable = el?.isContentEditable
        if (tag === 'INPUT' || tag === 'TEXTAREA' || editable) return
        e.preventDefault()
        focusSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchEnabled, isMobile])

  function jumpToNode(uuid: string) {
    // Use the same hash convention as the rest of the app: /nodes/:uuid
    window.location.hash = `#/nodes/${uuid}`
    // Don't clear the query — user might want to refine. Just close UI.
    setFocused(false)
    setMobileSearchOpen(false)
    desktopInputRef.current?.blur()
    mobileInputRef.current?.blur()
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setQuery('')
      setFocused(false)
      setMobileSearchOpen(false)
      e.currentTarget.blur()
      return
    }
    if (suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const node = suggestions[activeIdx]
      if (node) jumpToNode(node.uuid)
    }
  }

  const showHamburger = isMobile && !!onMobileMenu
  const showDropdown = searchEnabled && focused && query.trim().length > 0

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '10px 14px' : '12px 24px',
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--edge-mid)',
        boxShadow: '0 1px 0 var(--edge-bright)',
        gap: isMobile ? 8 : 16,
        // Honour iOS safe-area on the right (notch in landscape).
        paddingRight: `calc(${isMobile ? 14 : 24}px + env(safe-area-inset-right))`,
        paddingLeft: `calc(${isMobile ? 14 : 24}px + env(safe-area-inset-left))`,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16, minWidth: 0, flex: 1 }}>
        {/* Hamburger — mobile only */}
        {showHamburger && (
          <button
            onClick={onMobileMenu}
            aria-label="Open navigation menu"
            style={{
              flexShrink: 0,
              width: 34,
              height: 34,
              padding: 0,
              background: 'var(--bg-inset)',
              border: '1px solid var(--edge-engrave)',
              borderRadius: 4,
              boxShadow: 'inset 0 1px 0 var(--edge-deep)',
              color: 'var(--fg-1)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        )}

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: isMobile ? 6 : 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: isMobile ? 15 : 18,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--fg-0)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: isNarrow ? 120 : '100%',
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
            {agoLabel && !isNarrow && (
              <span
                style={{
                  fontSize: 9,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--fg-3)',
                  letterSpacing: '0.14em',
                  opacity: 0.85,
                }}
              >
                · {agoLabel}
              </span>
            )}
          </div>
          {/* Subtitle hidden on mobile to free vertical space */}
          {subtitle && !isMobile && <Etch>{subtitle}</Etch>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 12, flexShrink: 0 }}>
        {/* Search — full pill on desktop, icon-only on mobile.
            When searchEnabled is false (pages without node lists), the
            search affordance is hidden entirely so we don't show a control
            that doesn't do anything on this page. */}
        {searchEnabled && (
          isMobile ? (
            <button
              onClick={() => {
                setMobileSearchOpen((v) => {
                  const next = !v
                  if (next) requestAnimationFrame(() => mobileInputRef.current?.focus())
                  return next
                })
              }}
              aria-label="Search nodes"
              style={{
                width: 34,
                height: 34,
                padding: 0,
                background: mobileSearchOpen || query ? 'var(--bg-3)' : 'var(--bg-inset)',
                border: '1px solid var(--edge-engrave)',
                borderRadius: 4,
                boxShadow: 'inset 0 1px 0 var(--edge-deep)',
                color: query ? 'var(--accent)' : 'var(--fg-1)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {Icon.search}
              {query && (
                <span
                  style={{
                    position: 'absolute',
                    top: 3,
                    right: 3,
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    boxShadow: '0 0 4px var(--accent)',
                  }}
                />
              )}
            </button>
          ) : (
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 10px',
                  background: 'var(--bg-inset)',
                  border: `1px solid ${focused ? 'var(--accent)' : 'var(--edge-engrave)'}`,
                  borderRadius: 4,
                  minWidth: 220,
                  boxShadow: focused
                    ? 'inset 0 1px 0 var(--edge-deep), 0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent)'
                    : 'inset 0 1px 0 var(--edge-deep)',
                  transition: 'border-color 120ms ease, box-shadow 120ms ease',
                }}
              >
                <span style={{ color: query ? 'var(--accent)' : 'var(--fg-3)', display: 'inline-flex' }}>
                  {Icon.search}
                </span>
                <input
                  ref={desktopInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => {
                    // Delay so click on a suggestion lands before we collapse.
                    setTimeout(() => setFocused(false), 120)
                  }}
                  onKeyDown={onInputKeyDown}
                  placeholder="SEARCH NODES"
                  spellCheck={false}
                  autoComplete="off"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 11,
                    color: 'var(--fg-0)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.06em',
                    minWidth: 0,
                    padding: 0,
                  }}
                />
                {query ? (
                  <button
                    onMouseDown={(e) => {
                      // Use mousedown so it fires before blur.
                      e.preventDefault()
                      setQuery('')
                      desktopInputRef.current?.focus()
                    }}
                    aria-label="Clear search"
                    style={{
                      width: 14,
                      height: 14,
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--fg-3)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      fontSize: 14,
                    }}
                  >
                    ×
                  </button>
                ) : (
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
                )}
              </div>

              {/* Suggestion dropdown */}
              {showDropdown && (
                <SearchDropdown
                  suggestions={suggestions}
                  records={records}
                  activeIdx={activeIdx}
                  onPick={(uuid) => jumpToNode(uuid)}
                  onHover={(idx) => setActiveIdx(idx)}
                  query={query}
                />
              )}
            </div>
          )
        )}

        <ThemePicker value={theme} onChange={(v) => onTheme(v)} />
      </div>

      {/* Mobile search panel — full-width drop-down below the header. */}
      {searchEnabled && isMobile && mobileSearchOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--bg-1)',
            borderBottom: '1px solid var(--edge-mid)',
            padding: '10px 14px',
            zIndex: 20,
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              background: 'var(--bg-inset)',
              border: `1px solid ${focused ? 'var(--accent)' : 'var(--edge-engrave)'}`,
              borderRadius: 4,
              boxShadow: 'inset 0 1px 0 var(--edge-deep)',
            }}
          >
            <span style={{ color: query ? 'var(--accent)' : 'var(--fg-3)', display: 'inline-flex' }}>
              {Icon.search}
            </span>
            <input
              ref={mobileInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 120)}
              onKeyDown={onInputKeyDown}
              placeholder="SEARCH NODES"
              spellCheck={false}
              autoComplete="off"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 12,
                color: 'var(--fg-0)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.06em',
                minWidth: 0,
                padding: 0,
              }}
            />
            {query && (
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  setQuery('')
                  mobileInputRef.current?.focus()
                }}
                aria-label="Clear search"
                style={{
                  width: 16,
                  height: 16,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--fg-3)',
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Mobile suggestion list */}
          {query.trim().length > 0 && (
            <div style={{ marginTop: 8 }}>
              <SearchDropdown
                suggestions={suggestions}
                records={records}
                activeIdx={activeIdx}
                onPick={(uuid) => jumpToNode(uuid)}
                onHover={(idx) => setActiveIdx(idx)}
                query={query}
                inline
              />
            </div>
          )}
        </div>
      )}
    </header>
  )
}

// ─────────────────────────── Suggestion dropdown ───────────────────────────

interface DropdownProps {
  suggestions: KomariNode[]
  records?: Record<string, KomariRecord>
  activeIdx: number
  onPick: (uuid: string) => void
  onHover: (idx: number) => void
  query: string
  /** When true, render in flow (mobile) instead of absolute-positioned. */
  inline?: boolean
}

function SearchDropdown({ suggestions, records, activeIdx, onPick, onHover, query, inline }: DropdownProps) {
  const empty = suggestions.length === 0
  return (
    <div
      role="listbox"
      style={{
        position: inline ? 'static' : 'absolute',
        top: inline ? undefined : 'calc(100% + 4px)',
        left: 0,
        right: 0,
        minWidth: inline ? undefined : 260,
        background: 'var(--bg-1)',
        border: '1px solid var(--edge-mid)',
        borderRadius: 4,
        boxShadow: inline ? 'none' : '0 6px 16px rgba(0,0,0,0.22)',
        zIndex: 30,
        overflow: 'hidden',
      }}
    >
      {/* Header strip — etched count. Shows "0 / N" when no match so users
          know the search ran but nothing matched. */}
      <div
        style={{
          padding: '4px 10px',
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--fg-3)',
          letterSpacing: '0.14em',
          background: 'var(--bg-inset)',
          borderBottom: '1px solid var(--edge-engrave)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>RESULTS · {suggestions.length}</span>
        <span style={{ opacity: 0.7 }}>↵ JUMP · ESC CLEAR</span>
      </div>

      {empty ? (
        <div
          style={{
            padding: '14px 12px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fg-3)',
            textAlign: 'center',
            letterSpacing: '0.08em',
          }}
        >
          NO MATCH FOR "{query.toUpperCase()}"
        </div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: 360, overflowY: 'auto' }}>
          {suggestions.map((n, idx) => {
            const r = records?.[n.uuid]
            const online = r?.online === true
            const active = idx === activeIdx
            return (
              <li
                key={n.uuid}
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  // mousedown so it lands before the input blur fires.
                  e.preventDefault()
                  onPick(n.uuid)
                }}
                onMouseEnter={() => onHover(idx)}
                style={{
                  padding: '7px 10px',
                  cursor: 'pointer',
                  background: active ? 'var(--bg-3)' : 'transparent',
                  borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderBottom: '1px solid var(--edge-engrave)',
                }}
              >
                <StatusDot status={online ? 'good' : 'idle'} size={5} pulse={online} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: contentFs(12),
                      fontWeight: 500,
                      color: 'var(--fg-0)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {highlightMatch(n.name ?? '(unnamed)', query)}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--fg-3)',
                      letterSpacing: '0.08em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: 1,
                    }}
                  >
                    {[n.region, n.group, n.ip].filter(Boolean).join(' · ').toUpperCase() || '—'}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    color: 'var(--fg-3)',
                    letterSpacing: '0.1em',
                    opacity: active ? 1 : 0.6,
                  }}
                >
                  →
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * Highlight matched substring with the accent colour. Case-insensitive,
 * single-occurrence (first match) — keeping it simple; multi-match
 * highlighting in such a tight UI just becomes noise.
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim()
  if (!q) return text
  const lc = text.toLowerCase()
  const idx = lc.indexOf(q.toLowerCase())
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  )
}
