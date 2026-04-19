import { useEffect, useState } from 'react'
import { fetchNodes, fetchPingHistory, fetchPublic, openLiveSocket } from '@/api/client'
import type { PingHistory } from '@/api/client'
import { makeOfflineRecord, normalizeNode, normalizeWsRecord } from '@/api/normalize'
import type {
  KomariNode,
  KomariPublicConfig,
  KomariRecord,
  KomariRecordRaw,
} from '@/types/komari'

export type ConnStatus = 'connecting' | 'open' | 'closed' | 'error' | 'idle'

interface KomariState {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  config: KomariPublicConfig
  conn: ConnStatus
  error: string | null
  ping: PingHistory
  /** Timestamp of the most recent successful WS message (ms). */
  lastUpdate: number | null
}

const INITIAL: KomariState = {
  nodes: [],
  records: {},
  config: {},
  conn: 'idle',
  error: null,
  ping: { count: 0, tasks: [], records: [] },
  lastUpdate: null,
}

/**
 * useKomari — wires REST node list + WS live records + periodic ping fetch.
 * - WS reconnects automatically. Nodes not in `online[]` are marked offline.
 * - Ping history refreshes every 60s; covers the last 1 hour of all targets.
 */
export function useKomari(): KomariState {
  const [state, setState] = useState<KomariState>(INITIAL)

  useEffect(() => {
    let cancelled = false

    Promise.all([fetchNodes(), fetchPublic()])
      .then(([rawNodes, config]) => {
        if (cancelled) return
        const nodes = rawNodes.map(normalizeNode).filter((n) => !n.hidden)
        setState((prev) => ({ ...prev, nodes, config }))
      })
      .catch((err) => {
        if (cancelled) return
        setState((prev) => ({ ...prev, error: String(err) }))
      })

    const refreshPing = () => {
      fetchPingHistory(1).then((ping) => {
        if (cancelled) return
        setState((prev) => ({ ...prev, ping }))
      })
    }
    refreshPing()
    const pingTimer = setInterval(refreshPing, 60_000)

    const sock = openLiveSocket({
      onStatus: (conn) => {
        if (cancelled) return
        setState((prev) => ({ ...prev, conn }))
      },
      onMessage: (payload) => {
        if (cancelled) return
        setState((prev) => {
          const records: Record<string, KomariRecord> = { ...prev.records }
          const onlineSet = new Set(payload.online ?? [])

          for (const [uuid, raw] of Object.entries(payload.data ?? {})) {
            records[uuid] = normalizeWsRecord(uuid, raw as KomariRecordRaw, onlineSet.has(uuid))
          }
          for (const n of prev.nodes) {
            if (!onlineSet.has(n.uuid)) {
              records[n.uuid] = makeOfflineRecord(n.uuid, prev.records[n.uuid])
            }
          }
          return { ...prev, records, lastUpdate: Date.now() }
        })
      },
    })

    return () => {
      cancelled = true
      clearInterval(pingTimer)
      sock.close()
    }
  }, [])

  return state
}
