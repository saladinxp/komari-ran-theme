import { useEffect, type ReactNode } from 'react'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { Icon } from '@/components/atoms/icons'
import { useIsMobile } from '@/hooks/useMediaQuery'
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
  /**
   * Mobile-drawer state. When the viewport is narrow (< md) the sidebar
   * leaves the document flow and slides in from the left as a fixed-position
   * drawer over the main content. Callers pass these from a Topbar hamburger
   * button. On desktop these props are ignored.
   */
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({
  active,
  region = '岚 / RAN',
  version = 'v1.0.0',
  hubTargetUuid,
  crossPage = false,
  mobileOpen = false,
  onMobileClose,
}: Props) {
  const isMobile = useIsMobile()

  // Auto-close the drawer on route change. Hash-routes update the URL hash,
  // cross-page nav updates pathname; both should dismiss the drawer.
  useEffect(() => {
    if (!isMobile || !mobileOpen) return
    const close = () => onMobileClose?.()
    window.addEventListener('hashchange', close)
    window.addEventListener('popstate', close)
    return () => {
      window.removeEventListener('hashchange', close)
      window.removeEventListener('popstate', close)
    }
  }, [isMobile, mobileOpen, onMobileClose])

  // Lock body scroll while the mobile drawer is open. Otherwise the page
  // behind the overlay still scrolls under the user's finger, which feels
  // broken on iOS Safari.
  useEffect(() => {
    if (!isMobile) return
    if (mobileOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [isMobile, mobileOpen])

  const nav: NavItem[] = NAV_BASE.map((item) => {
    if (item.id === 'hub') {
      return {
        ...item,
        enabled: !!hubTargetUuid,
        uuidLink: hubTargetUuid,
      }
    }
    return { ...item, enabled: true }
  })

  // Mobile-drawer mode lifts the aside out of the document flow and
  // slide-transitions it in from the left. Desktop mode keeps the existing
  // sticky-rail layout — same visual, just placement changes.
  const asideStyle: React.CSSProperties = isMobile
    ? {
        width: 240,
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--edge-mid)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 51,
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        boxShadow: mobileOpen ? '4px 0 24px rgba(0,0,0,0.28)' : 'none',
        overflowY: 'auto',
        // Disable pointer events when offscreen so it can't accidentally
        // intercept touch on the underlying main content.
        pointerEvents: mobileOpen ? 'auto' : 'none',
        // Respect iOS notch/safe area.
        paddingLeft: 'env(safe-area-inset-left)',
      }
    : {
        width: 200,
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--edge-mid)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        alignSelf: 'flex-start',
        overflowY: 'auto',
      }

  return (
    <>
      {/* Mobile overlay — tap to dismiss. Rendered as a sibling so
          its z-index sits below the aside. */}
      {isMobile && (
        <div
          onClick={onMobileClose}
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.42)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
            zIndex: 50,
            opacity: mobileOpen ? 1 : 0,
            pointerEvents: mobileOpen ? 'auto' : 'none',
            transition: 'opacity 200ms ease',
          }}
        />
      )}

      <aside style={asideStyle}>
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
            href={crossPage ? './' : hashFor({ name: 'overview' })}
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
              : {
                  onClick: () => {
                    // On mobile, picking a nav item should close the drawer
                    // immediately. The hashchange listener also handles this
                    // for hash routes, but cross-page links don't fire one
                    // before navigation, so do it eagerly here.
                    if (isMobile) onMobileClose?.()
                  },
                }

            // Three cases:
            //   1. map → always points at ./map.html. On the map page itself
            //      this is effectively a no-op refresh; from anywhere else
            //      it loads the standalone geo page.
            //   2. hub → uuid-suffixed hash route.
            //   3. everything else → bare name hash route.
            //
            // On a cross-page render (i.e. the sidebar is shown on map.html),
            // non-map links need to navigate back to the main app's HTML file.
            // We prefix with './' (NOT './index.html') so the URL bar stays
            // clean — server serves index.html by default for the directory.
            const href =
              item.id === 'map'
                ? './map.html'
                : item.id === 'hub' && item.uuidLink
                  ? (crossPage ? './' : '') + hashFor({ name: 'hub', uuid: item.uuidLink })
                  : (crossPage ? './' : '') + hashFor({ name: item.id } as Route)

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
    </>
  )
}
