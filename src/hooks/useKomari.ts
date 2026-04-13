import { useEffect, useState } from 'react'
import { fetchNodes, fetchPublic, openLiveSocket } from '@/api/client'
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
}

const INITIAL: KomariState = {
  nodes: [],
  records: {},
  config: {},
  conn: 'idle',
  error: null,
}

/**
 * useKomari — wires REST node list + WS live records.
 * Reconnects automatically. Marks any node not in `online[]` as offline.
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
          return { ...prev, records }
        })
      },
    })

    return () => {
      cancelled = true
      sock.close()
    }
  }, [])

  return state
}
