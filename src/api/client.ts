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

export interface LiveSocket {
  close: () => void
}

/**
 * WebSocket /api/clients — sends "get" on open and receives live updates.
 * Reconnects with exponential backoff up to 15s.
 */
export function openLiveSocket(opts: {
  onMessage: (payload: KomariWSPayload) => void
  onStatus?: (s: 'connecting' | 'open' | 'closed' | 'error') => void
}): LiveSocket {
  let ws: WebSocket | null = null
  let closed = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let attempt = 0

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
      if (timer) clearTimeout(timer)
      ws?.close()
    },
  }
}
