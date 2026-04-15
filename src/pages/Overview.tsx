import { useMemo } from 'react'
import { Topbar } from '@/components/panels/Topbar'
import { NodeCardCompact } from '@/components/cards/NodeCardCompact'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { genSeries } from '@/utils/series'

type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'

interface Props {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  theme: 'ran-night' | 'ran-mist'
  onTheme: (t: 'ran-night' | 'ran-mist') => void
  siteName?: string
  conn?: Conn
}

export function OverviewPage({ nodes, records, theme, onTheme, siteName = '岚 · Komari', conn }: Props) {
  const stats = useMemo(() => {
    let online = 0
    for (const n of nodes) {
      const rec = records[n.uuid]
      if (rec?.online) online++
    }
    return { online, total: nodes.length }
  }, [nodes, records])

  const connLabel =
    conn === 'open' ? 'LIVE' : conn === 'connecting' ? 'CONNECTING' : conn === 'error' ? 'ERROR' : 'OFFLINE'

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Topbar
        title={siteName}
        subtitle={`${nodes.length} PROBES · ${connLabel}`}
        theme={theme}
        onTheme={onTheme}
        online={stats.online}
        total={stats.total}
      />

      <main style={{ flex: 1, padding: 20 }}>
        {nodes.length === 0 ? (
          <div
            style={{
              padding: 80,
              textAlign: 'center',
              color: 'var(--fg-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            {conn === 'open' ? 'NO PROBES CONFIGURED' : 'CONNECTING TO PROBE NETWORK …'}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 14,
            }}
          >
            {nodes.map((node, i) => (
              <NodeCardCompact
                key={node.uuid}
                node={node}
                record={records[node.uuid]}
                netSpark={genSeries(40, hashSeed(node.uuid) + 1, 50, 30)}
                pingSpark={genSeries(28, hashSeed(node.uuid) + 11, 80, 120)}
              />
            ))}
          </div>
        )}
      </main>

      <footer
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--edge-engrave)',
          background: 'var(--bg-1)',
          color: 'var(--fg-3)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>岚 · KOMARI PROBE THEME · v0.2.0</span>
        <span>POWERED BY KOMARI</span>
      </footer>
    </div>
  )
}

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
