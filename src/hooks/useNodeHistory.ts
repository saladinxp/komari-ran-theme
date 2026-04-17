import { useEffect, useState } from 'react'
import {
  fetchNodeLoadHistory,
  fetchNodePingHistory,
  type LoadHistory,
  type PingHistory,
} from '@/api/client'

interface NodeHistoryState {
  load: LoadHistory
  ping: PingHistory
  /** True while either fetch is in flight (initial load only). */
  loading: boolean
}

const EMPTY_LOAD: LoadHistory = { count: 0, records: [] }
const EMPTY_PING: PingHistory = { count: 0, tasks: [], records: [] }

/**
 * useNodeHistory — load + ping history for one node, both for `hours` window.
 * Refreshes every `refreshMs` (default 60s).
 */
export function useNodeHistory(uuid: string, hours = 1, refreshMs = 60_000): NodeHistoryState {
  const [state, setState] = useState<NodeHistoryState>({
    load: EMPTY_LOAD,
    ping: EMPTY_PING,
    loading: true,
  })

  useEffect(() => {
    if (!uuid) return
    let cancelled = false

    const refresh = async () => {
      const [load, ping] = await Promise.all([
        fetchNodeLoadHistory(uuid, hours),
        fetchNodePingHistory(uuid, hours),
      ])
      if (cancelled) return
      setState({ load, ping, loading: false })
    }

    setState((prev) => ({ ...prev, loading: true }))
    refresh()
    const t = setInterval(refresh, refreshMs)

    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [uuid, hours, refreshMs])

  return state
}
