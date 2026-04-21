/**
 * Komari Probe API types (real shape, observed from live panel).
 *
 * Two record shapes coexist:
 *  - Nested (raw, from /api/clients WS): cpu.usage, ram.used, network.up...
 *  - Flat (after normalization): cpu, memory_used, network_tx...
 *
 * We always normalize to flat shape for components.
 */

export type NodeStatus = 'good' | 'warn' | 'bad'

/** /api/nodes — node metadata */
export interface KomariNode {
  uuid: string
  name?: string
  /** OS string from agent boot */
  os?: string
  cpu_name?: string
  cpu_model?: string
  cpu_cores?: number
  arch?: string
  ip?: string
  region?: string
  group?: string
  /** Bandwidth/traffic labels: "1Gbps<green>;5T<blue>" */
  tags?: string
  /** ISO date — node expiry */
  expired_at?: string
  price?: number
  /**
   * Billing cycle in **days** (Komari quirk: numeric, not "monthly"/"yearly"):
   * 30=月, 90=季, 180=半年, 365=年, 1095=三年, -1=免费机.
   * The API surface is sometimes stringified, so we accept both.
   */
  billing_cycle?: number | string
  /** Currency symbol — e.g. "$", "¥", "€". From Komari node settings. */
  currency?: string
  /** VPS / hosting provider name — Hetzner, Vultr, OVH, etc. May not be in Komari yet. */
  provider?: string
  weight?: number
  /** When true, node is hidden from anonymous viewers */
  hidden?: boolean
  /** Country code; sometimes present, sometimes derived from region */
  flag?: string
}

/** Raw nested record from Komari WebSocket /api/clients */
export interface KomariRecordRaw {
  cpu?: { usage?: number }
  ram?: { used?: number; total?: number }
  swap?: { used?: number; total?: number }
  disk?: { used?: number; total?: number }
  network?: { up?: number; down?: number; totalUp?: number; totalDown?: number }
  connections?: { tcp?: number; udp?: number }
  load?: { load1?: number; load5?: number; load15?: number }
  uptime?: number
  process?: number
  os?: string
  cpu_model?: string
  message?: string
  updated_at?: string
}

/** Normalized flat record — what components consume */
export interface KomariRecord {
  uuid: string
  online: boolean
  /** CPU usage percent 0..100 */
  cpu?: number
  memory_used?: number
  memory_total?: number
  swap_used?: number
  swap_total?: number
  disk_used?: number
  disk_total?: number
  /** Bytes per second, instantaneous */
  network_tx?: number
  network_rx?: number
  /** Cumulative bytes since boot — resets on reboot */
  network_total_up?: number
  network_total_down?: number
  tcp?: number
  udp?: number
  load1?: number
  load5?: number
  load15?: number
  uptime?: number
  process?: number
  os?: string
  cpu_model?: string
  message?: string
  updated_at?: string
  /** Recent ping ms (from /api/records/ping) */
  ping?: number
  /** Packet loss percent */
  loss?: number
}

/** /api/public — site config */
export interface KomariPublicConfig {
  site_name?: string
  description?: string
  record_keep_days?: number
  ping_keep_days?: number
  custom_css?: string
  footer_text?: string
  announce_text?: string
  theme_settings?: Record<string, unknown>
}

export interface KomariMe {
  logged_in?: boolean
  username?: string
}

/** Envelope from WS /api/clients */
export interface KomariWSPayload {
  online?: string[]
  data?: Record<string, KomariRecordRaw | KomariRecord>
}
