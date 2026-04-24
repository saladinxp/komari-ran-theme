import { useEffect, useMemo, useRef, useState } from 'react'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { StatusDot } from '@/components/atoms/StatusDot'
import { Etch } from '@/components/atoms/Etch'
import { hashFor, type Route } from '@/router/route'

interface Props {
  /** Currently-displayed node — its name is the dropdown trigger label. */
  current: KomariNode
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  /** Which page should the dropdown navigate to? Lets us reuse the switcher
   *  on both the Hub page and (later) the standard detail page. */
  targetRoute?: 'hub' | 'nodes'
}

/**
 * NodeSwitcher — clickable trigger displaying the current node's name; on
 * click opens a dropdown listing every node (with status, region, group),
 * filterable via a top-of-list search box. Selecting a node navigates to
 * its hub (or detail) page.
 *
 * Design notes:
 *  - Online nodes appear first; offline ones are dimmed and grouped at the bottom.
 *  - Outside-click and Escape close the dropdown without navigating.
 *  - The trigger looks like the original hostname text (with an aside arrow
 *    so the affordance is visible without breaking the cockpit-bar feel).
 */
export function NodeSwitcher({
  current,
  nodes,
  records,
  targetRoute = 'hub',
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Focus search on open; close on outside click or Escape.
  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    // Defer to next tick so the input exists.
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)

    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Sort: online first then offline; within each, by name.
  const sorted = useMemo(() => {
    const list = [...nodes]
    list.sort((a, b) => {
      const ao = records[a.uuid]?.online ? 0 : 1
      const bo = records[b.uuid]?.online ? 0 : 1
      if (ao !== bo) return ao - bo
      return (a.name ?? '').localeCompare(b.name ?? '')
    })
    return list
  }, [nodes, records])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((n) => {
      const hay = [n.name ?? '', n.region ?? '', n.group ?? ''].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [sorted, query])

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="点击切换节点"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 8px 2px 4px',
          background: open ? 'var(--bg-3)' : 'transparent',
          color: 'var(--fg-0)',
          border: '1px solid',
          borderColor: open ? 'var(--edge-mid)' : 'transparent',
          borderRadius: 4,
          fontFamily: 'var(--font-sans)',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          cursor: 'pointer',
          lineHeight: 1.1,
          transition: 'background 0.08s ease, border-color 0.08s ease',
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.background = 'var(--bg-2)'
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = 'transparent'
        }}
      >
        <span>{current.name ?? 'Unnamed'}</span>
        <span
          aria-hidden
          style={{
            fontSize: 9,
            color: 'var(--fg-3)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.12s ease',
            paddingLeft: 2,
            paddingRight: 2,
          }}
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 30,
            width: 320,
            maxHeight: 420,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-1)',
            border: '1px solid var(--edge-mid)',
            boxShadow:
              '0 8px 24px rgba(0, 0, 0, 0.25), inset 0 1px 0 var(--edge-bright)',
          }}
        >
          {/* Search */}
          <div
            style={{
              padding: 8,
              borderBottom: '1px solid var(--edge-engrave)',
              background: 'var(--bg-0)',
            }}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索节点 / region / group"
              style={{
                width: '100%',
                padding: '6px 10px',
                background: 'var(--bg-1)',
                color: 'var(--fg-0)',
                border: '1px solid var(--edge-engrave)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.05em',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--edge-engrave)'
              }}
            />
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: '20px 12px',
                  textAlign: 'center',
                  color: 'var(--fg-3)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                }}
              >
                无匹配节点
              </div>
            ) : (
              filtered.map((n) => {
                const r = records[n.uuid]
                const online = r?.online === true
                const isCurrent = n.uuid === current.uuid
                const status: 'good' | 'warn' | 'bad' = !online
                  ? 'bad'
                  : (r?.cpu ?? 0) > 80
                    ? 'warn'
                    : 'good'
                const route: Route = { name: targetRoute, uuid: n.uuid }
                return (
                  <a
                    key={n.uuid}
                    href={hashFor(route)}
                    role="option"
                    aria-selected={isCurrent}
                    onClick={() => setOpen(false)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '14px 1fr auto',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 10px',
                      borderBottom: '1px solid var(--edge-engrave)',
                      background: isCurrent ? 'var(--bg-3)' : 'transparent',
                      borderLeft: isCurrent
                        ? '2px solid var(--accent)'
                        : '2px solid transparent',
                      color: 'inherit',
                      textDecoration: 'none',
                      opacity: online ? 1 : 0.55,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrent)
                        e.currentTarget.style.background = 'var(--bg-2)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrent)
                        e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <StatusDot status={status} size={6} pulse={status === 'good'} />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: 12,
                          fontWeight: isCurrent ? 600 : 500,
                          color: isCurrent ? 'var(--accent-bright)' : 'var(--fg-0)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {n.name ?? n.uuid.slice(0, 8)}
                      </div>
                      {(n.region || n.group) && (
                        <Etch size={8}>
                          {[n.region, n.group].filter(Boolean).join(' · ')}
                        </Etch>
                      )}
                    </div>
                    {isCurrent && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          color: 'var(--accent-bright)',
                          letterSpacing: '0.18em',
                        }}
                      >
                        ACTIVE
                      </span>
                    )}
                  </a>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '6px 10px',
              borderTop: '1px solid var(--edge-engrave)',
              background: 'var(--bg-0)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <Etch>
              {filtered.length} / {nodes.length} NODES
            </Etch>
            <Etch>ESC TO CLOSE</Etch>
          </div>
        </div>
      )}
    </div>
  )
}
