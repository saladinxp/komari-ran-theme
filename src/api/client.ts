import type { KomariNode, KomariPublicConfig, KomariWSPayload } from '@/types/komari'

/**
 * Resolve API base — defaults to current origin (theme served by Komari).
 * In dev (vite), VITE_KOMARI_BASE can override to point at a real Komari host.
 */
export function apiBase(): string {
  const env = (import.meta as { env?: Record<string, string> }).env?.VITE_KOMARI_BASE
  if (env) return env.replace(/\/+$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export function wsUrl(path: string): string {
  const base = apiBase()
  if (base.startsWith('http')) {
    return base.replace(/^http/, 'ws') + path
  }
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}${path}`
  }
  return path
}

/** Komari wraps responses in {status, message, data}. Unwrap if present. */
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  const body = await res.json()
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data
  }
  return body as T
}

export async function fetchNodes(): Promise<KomariNode[]> {
  const data = await getJson<KomariNode[]>('/api/nodes')
  return Array.isArray(data) ? data : []
}

export async function fetchPublic(): Promise<KomariPublicConfig> {
  try {
    return await getJson<KomariPublicConfig>('/api/public')
  } catch {
    return {}
  }
}

/** /api/records/ping?hours=N — global ping records across all nodes & tasks */
export interface PingTask {
  id: number
  name: string
  interval: number
  loss: number
}

export interface PingRecord {
  task_id: number
  /** ISO 8601 timestamp */
  time: string
  /** Latency in ms */
  value: number
  /** Optional uuid — present when fetched without uuid filter */
  client?: string
}

export interface PingHistory {
  count: number
  tasks: PingTask[]
  records: PingRecord[]
}

export async function fetchPingHistory(hours = 1): Promise<PingHistory> {
  try {
    return await getJson<PingHistory>(`/api/records/ping?hours=${hours}`)
  } catch {
    return { count: 0, tasks: [], records: [] }
  }
}

/** Per-node ping history — pings for one specific probe over `hours`. */
export async function fetchNodePingHistory(uuid: string, hours = 1): Promise<PingHistory> {
  try {
    return await getJson<PingHistory>(
      `/api/records/ping?uuid=${encodeURIComponent(uuid)}&hours=${hours}`,
    )
  } catch {
    return { count: 0, tasks: [], records: [] }
  }
}

/** /api/records/load?uuid=…&hours=N — flat per-node load history.
 * Each record carries cpu / ram / disk as percent (0..100), bytes for net totals. */
export interface LoadRecord {
  /** ISO 8601 */
  time: string
  cpu?: number
  ram?: number
  ram_total?: number
  disk?: number
  disk_total?: number
  swap?: number
  swap_total?: number
  load?: number
  net_in?: number
  net_out?: number
  net_total_up?: number
  net_total_down?: number
  process?: number
  connections?: number
  connections_udp?: number
}

export interface LoadHistory {
  count: number
  records: LoadRecord[]
}

export async function fetchNodeLoadHistory(uuid: string, hours = 1): Promise<LoadHistory> {
  try {
    return await getJson<LoadHistory>(
      `/api/records/load?uuid=${encodeURIComponent(uuid)}&hours=${hours}`,
    )
  } catch {
    return { count: 0, records: [] }
  }
}

export interface LiveSocket {
  close: () => void
}

/**
 * WebSocket /api/clients — sends "get" on open + every second to poll for updates.
 * Komari's WS is request-response style, not streaming, so we have to poll.
 * Reconnects with exponential backoff up to 15s.
 */
export function openLiveSocket(opts: {
  onMessage: (payload: KomariWSPayload) => void
  onStatus?: (s: 'connecting' | 'open' | 'closed' | 'error') => void
}): LiveSocket {
  let ws: WebSocket | null = null
  let closed = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let attempt = 0

  const stopPoll = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const connect = () => {
    if (closed) return
    opts.onStatus?.('connecting')
    try {
      ws = new WebSocket(wsUrl('/api/clients'))
    } catch (err) {
      console.warn('[ran] ws construct failed', err)
      schedule()
      return
    }
    ws.onopen = () => {
      attempt = 0
      opts.onStatus?.('open')
      try {
        ws?.send('get')
      } catch {
        /* ignore */
      }
      // Poll every 1s — Komari WS doesn't push, it replies on demand.
      stopPoll()
      pollTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send('get')
          } catch {
            /* ignore */
          }
        }
      }, 1000)
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as { status?: string; data?: KomariWSPayload }
        if (msg?.data) opts.onMessage(msg.data)
      } catch (err) {
        console.warn('[ran] ws parse failed', err)
      }
    }
    ws.onerror = () => opts.onStatus?.('error')
    ws.onclose = () => {
      stopPoll()
      opts.onStatus?.('closed')
      schedule()
    }
  }

  const schedule = () => {
    if (closed) return
    attempt++
    const delay = Math.min(1000 * 2 ** Math.min(attempt, 4), 15000)
    timer = setTimeout(connect, delay)
  }

  connect()

  return {
    close: () => {
      closed = true
      stopPoll()
      if (timer) clearTimeout(timer)
      ws?.close()
    },
  }
}
