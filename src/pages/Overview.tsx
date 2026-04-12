import { useMemo } from 'react'
import { Topbar } from '@/components/panels/Topbar'
import { NodeCardCompact } from '@/components/cards/NodeCardCompact'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { genSeries } from '@/utils/series'
import { deriveStatus } from '@/utils/format'

interface Props {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  theme: 'ran-night' | 'ran-mist'
  onTheme: (t: 'ran-night' | 'ran-mist') => void
  siteName?: string
}

export function OverviewPage({ nodes, records, theme, onTheme, siteName = '岚 · Komari Probe' }: Props) {
  const stats = useMemo(() => {
    let online = 0
    for (const n of nodes) {
      const rec = records[n.uuid]
      if (deriveStatus(rec) !== 'bad') online++
    }
    return { online, total: nodes.length }
  }, [nodes, records])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar
        title={siteName}
        subtitle={`${nodes.length} PROBES · LIVE`}
        theme={theme}
        onTheme={onTheme}
        online={stats.online}
        total={stats.total}
      />

      <main style={{ flex: 1, padding: 20 }}>
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
              netSpark={genSeries(40, i + 1, 50, 30)}
              pingSpark={genSeries(28, i + 11, 80, 120)}
            />
          ))}
        </div>
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
        <span>岚 · KOMARI PROBE THEME · v0.1.0</span>
        <span>POWERED BY KOMARI</span>
      </footer>
    </div>
  )
}
