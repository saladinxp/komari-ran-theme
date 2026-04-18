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
}

const NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: Icon.server, enabled: true },
  { id: 'nodes', label: 'Nodes', icon: Icon.cpu, enabled: true },
  { id: 'traffic', label: 'Traffic', icon: Icon.net, enabled: false },
  { id: 'map', label: 'Geo Map', icon: Icon.globe, enabled: false },
  { id: 'alerts', label: 'Alerts', icon: Icon.alert, enabled: false },
  { id: 'settings', label: 'Settings', icon: Icon.settings, enabled: false },
]

interface Props {
  active: Route['name']
  region?: string
  version?: string
}

export function Sidebar({ active, region = '岚 / RAN', version = 'v0.5.3' }: Props) {
  return (
    <aside
      style={{
        width: 200,
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--edge-mid)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        minHeight: '100%',
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--edge-engrave)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', padding: 8, gap: 1 }}>
        {NAV.map((item) => {
          const isActive = active === item.id
          const disabled = !item.enabled

          const linkProps = disabled
            ? { onClick: (e: React.MouseEvent) => e.preventDefault(), 'aria-disabled': true }
            : {}

          return (
            <a
              key={item.id}
              href={hashFor({ name: item.id } as Route)}
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
