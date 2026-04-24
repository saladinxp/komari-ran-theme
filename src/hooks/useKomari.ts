import { useEffect, useMemo, useState } from 'react'
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
 * mergePingIntoRecords — fold per-node ping latency + loss into the live
 * records map. Reads PingHistory.records (each carries `client = uuid`,
 * `value = latency ms`, `value <= 0` meaning a lost ping), groups by uuid,
 * computes the average latency and loss percentage over the recent window,
 * and writes them onto each record's `ping` / `loss` fields.
 *
 * Ping data is fetched separately on a 60s interval, so this folds in
 * lazily — first paint may show '—' for ping/loss for a beat. That's fine.
 */
function mergePingIntoRecords(
  records: Record<string, KomariRecord>,
  ping: PingHistory,
): Record<string, KomariRecord> {
  const pingRecords = Array.isArray(ping?.records) ? ping.records : []
  if (pingRecords.length === 0) return records

  // Group recent ping samples by uuid. Komari sets `client = uuid` when the
  // global endpoint /api/records/ping is queried without a uuid filter.
  const byUuid = new Map<string, { values: number[]; lost: number; total: number }>()
  for (const r of pingRecords) {
    const uuid = r?.client
    if (!uuid) continue
    let slot = byUuid.get(uuid)
    if (!slot) {
      slot = { values: [], lost: 0, total: 0 }
      byUuid.set(uuid, slot)
    }
    slot.total += 1
    if (r.value > 0) slot.values.push(r.value)
    else slot.lost += 1
  }

  if (byUuid.size === 0) return records

  // Build a new map only when at least one uuid actually picked up data —
  // otherwise return the original to keep referential equality where
  // possible (avoids spurious renders downstream).
  const out: Record<string, KomariRecord> = { ...records }
  for (const [uuid, slot] of byUuid) {
    const existing = out[uuid]
    if (!existing) continue
    const avg =
      slot.values.length === 0
        ? undefined
        : slot.values.reduce((a, b) => a + b, 0) / slot.values.length
    const loss = slot.total > 0 ? (slot.lost / slot.total) * 100 : undefined
    out[uuid] = { ...existing, ping: avg, loss }
  }
  return out
}

/**
 * useKomari — wires REST node list + WS live records + periodic ping fetch.
 * - WS reconnects automatically. Nodes not in `online[]` are marked offline.
 * - Ping history refreshes every 60s; covers the last 1 hour of all targets.
 * - `records` returned from this hook has per-node ping/loss merged in
 *   from the ping history endpoint (WS itself doesn't carry these).
 */
export function useKomari(): KomariState {
  const [state, setState] = useState<KomariState>(INITIAL)

  useEffect(() => {
    let cancelled = false

    Promise.all([fetchNodes(), fetchPublic()])
      .then(([rawNodes, config]) => {
        if (cancelled) return
        // Sort by `weight` ascending — Komari's admin drag-to-reorder writes
        // the resulting position into this field (weight 0 = top of list).
        // Nodes without a weight fall back to the end, then by name to keep
        // the order stable across renders.
        const nodes = rawNodes
          .map(normalizeNode)
          .filter((n) => !n.hidden)
          .sort((a, b) => {
            const aw = a.weight ?? Number.POSITIVE_INFINITY
            const bw = b.weight ?? Number.POSITIVE_INFINITY
            if (aw !== bw) return aw - bw
            return (a.name ?? '').localeCompare(b.name ?? '')
          })
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

  // Fold per-node ping/loss into the records before exposing them. We do
  // this in a memo (not in the WS handler) so a fresh ping fetch updates
  // every consumer without needing to re-derive WS state.
  const recordsWithPing = useMemo(
    () => mergePingIntoRecords(state.records, state.ping),
    [state.records, state.ping],
  )

  return { ...state, records: recordsWithPing }
}
