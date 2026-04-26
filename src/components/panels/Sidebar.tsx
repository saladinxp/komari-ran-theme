import type { ReactNode } from 'react'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { Icon } from '@/components/atoms/icons'
import { hashFor, type Route } from '@/router/route'

interface NavItem {
  id: Route['name']
  label: string
  icon: ReactNode
  /** Pages that exist; others render as visible-but-disabled. */
  enabled: boolean
  /** When set, this nav item links to a dynamic uuid-suffixed route instead of the bare name. */
  uuidLink?: string
}

const NAV_BASE: Omit<NavItem, 'enabled' | 'uuidLink'>[] = [
  { id: 'overview', label: 'Overview', icon: Icon.server },
  { id: 'nodes', label: 'Nodes', icon: Icon.cpu },
  { id: 'hub', label: 'Hub', icon: Icon.hub },
  { id: 'traffic', label: 'Traffic', icon: Icon.net },
  { id: 'billing', label: 'Billing', icon: Icon.settings },
  { id: 'map', label: 'Geo Map', icon: Icon.globe },
  { id: 'alerts', label: 'Alerts', icon: Icon.alert },
]

interface Props {
  active: Route['name']
  region?: string
  version?: string
  /**
   * Default uuid the Hub link should target. The Hub page lives at
   * `#/hub/{uuid}` — there's no listing view, so the sidebar entry needs a
   * concrete node to point at. Callers should pass a sensible default
   * (typically the first online node). When undefined, the Hub item
   * disables itself rather than dead-ending on an empty uuid.
   */
  hubTargetUuid?: string
  /**
   * When true, the sidebar is being rendered on a different HTML entry
   * (e.g. map.html). All non-map links must point back to ./index.html#/...
   * instead of relying on hash-only navigation, otherwise the browser would
   * just update the hash on the current map.html page and nothing happens.
   */
  crossPage?: boolean
}

export function Sidebar({
  active,
  region = '岚 / RAN',
  version = 'v0.9.12',
  hubTargetUuid,
  crossPage = false,
}: Props) {
  const nav: NavItem[] = NAV_BASE.map((item) => {
    if (item.id === 'hub') {
      return {
        ...item,
        enabled: !!hubTargetUuid,
        uuidLink: hubTargetUuid,
      }
    }
    if (item.id === 'alerts') {
      return { ...item, enabled: false }
    }
    return { ...item, enabled: true }
  })
  return (
    <aside
      style={{
        width: 200,
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--edge-mid)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        // Stick to the viewport top so the sidebar stays visible while
        // the main content scrolls underneath.
        position: 'sticky',
        top: 0,
        height: '100vh',
        alignSelf: 'flex-start',
        overflowY: 'auto',
      }}
    >
      {/* Brand — clicking takes you home */}
      <div
        style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--edge-engrave)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <a
          href={crossPage ? './index.html' : hashFor({ name: 'overview' })}
          title="返回首页"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'inherit',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              background: 'linear-gradient(135deg, var(--accent-bright), var(--accent-dim))',
              borderRadius: 4,
              border: '1px solid var(--edge-deep)',
              boxShadow: '0 1px 0 var(--edge-bright) inset, 0 -1px 0 var(--edge-deep) inset',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 11,
              color: '#1a1208',
            }}
          >
            岚
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>RAN</span>
            <Etch size={8}>PROBE · {version}</Etch>
          </div>
        </a>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', padding: 8, gap: 1 }}>
        {nav.map((item) => {
          const isActive = active === item.id
          const disabled = !item.enabled

          const linkProps = disabled
            ? { onClick: (e: React.MouseEvent) => e.preventDefault(), 'aria-disabled': true }
            : {}

          // Three cases:
          //   1. map → always points at the standalone map.html (works the same
          //      whether we're on index.html or map.html itself; on map.html
          //      it's effectively a no-op refresh).
          //   2. hub → uuid-suffixed route. On a cross-page render (map.html)
          //      we need to prefix index.html# so the browser actually
          //      navigates back to the main app instead of just twiddling
          //      the hash on map.html.
          //   3. everything else → bare name route, same cross-page logic.
          const href =
            item.id === 'map'
              ? './map.html'
              : item.id === 'hub' && item.uuidLink
                ? (crossPage ? './index.html' : '') + hashFor({ name: 'hub', uuid: item.uuidLink })
                : (crossPage ? './index.html' : '') + hashFor({ name: item.id } as Route)

          return (
            <a
              key={item.id}
              href={href}
              {...linkProps}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 10px',
                background: isActive ? 'var(--bg-3)' : 'transparent',
                color: isActive ? 'var(--fg-0)' : disabled ? 'var(--fg-3)' : 'var(--fg-1)',
                border: isActive ? '1px solid var(--edge-mid)' : '1px solid transparent',
                borderRadius: 4,
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                textAlign: 'left',
                position: 'relative',
                boxShadow: isActive ? '0 1px 0 var(--edge-bright) inset' : 'none',
                opacity: disabled ? 0.55 : 1,
                textDecoration: 'none',
              }}
            >
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    left: -8,
                    top: 8,
                    bottom: 8,
                    width: 2,
                    background: 'var(--accent)',
                    boxShadow: '0 0 6px var(--accent)',
                  }}
                />
              )}
              <span
                style={{
                  display: 'inline-flex',
                  color: isActive ? 'var(--accent-bright)' : 'var(--fg-2)',
                }}
              >
                {item.icon}
              </span>
              {item.label}
            </a>
          )
        })}
      </nav>

      <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid var(--edge-engrave)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Etch>Region · Operator</Etch>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{region}</span>
            <SerialPlate>OP-04A</SerialPlate>
          </div>
        </div>
      </div>
    </aside>
  )
}
