/**
 * MapPage — full-page geographic view of the probe fleet.
 *
 * Currently a skeleton: the routing, sidebar entry, hub link-out, and
 * topbar/footer chrome are wired up, but the body is intentionally left
 * as a placeholder until the real map implementation lands. The hub's
 * GEO · 08 card already deep-links here so the navigation flow can be
 * validated independently of map rendering quality.
 *
 * When the real map ships, only the <main> body is replaced — props
 * already include nodes/records, so all the data the map will need is
 * already flowing through this page.
 */

import { Sidebar } from '@/components/panels/Sidebar'
import { Topbar } from '@/components/panels/Topbar'
import { Footer } from '@/components/panels/Footer'
import { CardFrame } from '@/components/panels/CardFrame'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { Icon } from '@/components/atoms/icons'
import type { KomariNode, KomariPublicConfig, KomariRecord } from '@/types/komari'

type Theme = 'ran-night' | 'ran-mist'
type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'

interface Props {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  theme: Theme
  onTheme: (t: Theme) => void
  siteName?: string
  conn?: Conn
  lastUpdate?: number | null
  config?: KomariPublicConfig
  hubTargetUuid?: string
}

export function MapPage({
  nodes,
  records,
  theme,
  onTheme,
  siteName = '岚 · Komari',
  conn = 'idle',
  lastUpdate,
  config,
  hubTargetUuid,
}: Props) {
  const onlineCount = nodes.reduce(
    (acc, n) => acc + (records[n.uuid]?.online ? 1 : 0),
    0,
  )
  const regionCount = new Set(nodes.map((n) => n.region).filter(Boolean)).size

  const subtitle = `${nodes.length} NODES · ${regionCount} REGIONS · GEO VIEW`

  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--bg-0)',
        color: 'var(--fg-0)',
        fontFamily: 'var(--font-sans)',
        minHeight: '100vh',
      }}
    >
      <Sidebar active="map" hubTargetUuid={hubTargetUuid} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          title={siteName}
          subtitle={subtitle}
          theme={theme}
          onTheme={onTheme}
          online={onlineCount}
          total={nodes.length}
          lastUpdate={lastUpdate}
          conn={conn}
        />

        <main style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: 'var(--fg-0)',
                }}
              >
                Geographic View
              </h2>
              <SerialPlate>{`${nodes.length} NODES`}</SerialPlate>
              <Etch>WIP · 0.1</Etch>
            </div>
          </div>

          {/* Under-construction body. Single big card, hatched background,
              clear messaging that this is intentional. */}
          <CardFrame
            title="World Map"
            code="GEO · 01"
            action={<Etch>UNDER CONSTRUCTION</Etch>}
          >
            <div
              style={{
                minHeight: 480,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 18,
                padding: '40px 20px',
                background:
                  'repeating-linear-gradient(45deg, transparent, transparent 8px, var(--edge-engrave) 8px, var(--edge-engrave) 9px)',
              }}
            >
              {/* Centerpiece — globe icon, oversized */}
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  border: '2px solid var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--bg-1)',
                  color: 'var(--accent-bright)',
                  boxShadow:
                    'inset 0 1px 0 var(--edge-bright), 0 0 24px color-mix(in oklab, var(--accent) 25%, transparent)',
                }}
              >
                <span style={{ transform: 'scale(4)', display: 'inline-flex' }}>
                  {Icon.globe}
                </span>
              </div>

              <div
                style={{
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  maxWidth: 480,
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--accent-bright)',
                    letterSpacing: '0.32em',
                    textTransform: 'uppercase',
                  }}
                >
                  GEO · COMING
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: 'var(--fg-0)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  全球节点地图建设中
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--fg-2)',
                    lineHeight: 1.6,
                  }}
                >
                  这里会展示所有探针在世界地图上的位置、节点之间的延迟连线,
                  以及当前查看节点的高亮。第一版即将上线。
                </div>
              </div>

              {/* Tracking strip — what's planned */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 10,
                  width: '100%',
                  maxWidth: 720,
                  marginTop: 8,
                }}
              >
                {[
                  { code: 'A', label: 'Natural-Earth Geojson' },
                  { code: 'B', label: 'Pan / Zoom · 缩放与平移' },
                  { code: 'C', label: 'Inter-node Latency Lines' },
                ].map((p, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg-1)',
                      border: '1px solid var(--edge-engrave)',
                      boxShadow: 'inset 0 1px 0 var(--edge-bright)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <Etch>PLAN · {p.code}</Etch>
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--fg-1)',
                        fontFamily: 'var(--font-mono)',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {p.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardFrame>

          {/* Quick fleet glance — proves the page already has real data
              available, just no map renderer yet. */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 10,
            }}
          >
            <FleetStat label="Probes Online" value={`${onlineCount} / ${nodes.length}`} />
            <FleetStat label="Regions" value={String(regionCount)} />
            <FleetStat
              label="Coverage"
              value={
                nodes.length > 0
                  ? `${Math.round((onlineCount / nodes.length) * 100)}%`
                  : '—'
              }
            />
          </div>
        </main>

        <Footer config={config} />
      </div>
    </div>
  )
}

/** Single-cell strip of fleet-level info — same visual language as the
 *  M01..M04 hero strip on Overview but smaller / inline. */
function FleetStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '10px 14px',
        background: 'var(--bg-1)',
        border: '1px solid var(--edge-engrave)',
        boxShadow: 'inset 0 1px 0 var(--edge-bright)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 9,
          color: 'var(--fg-3)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--fg-0)',
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  )
}
