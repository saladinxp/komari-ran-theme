/**
 * Komari Probe API types
 * Based on observed API shape from Komari panel.
 */

export type NodeStatus = 'good' | 'warn' | 'bad'

export interface KomariNode {
  uuid: string
  name: string
  cpu_name?: string
  cpu_cores?: number
  arch?: string
  os?: string
  ip?: string
  region?: string
  flag?: string
  group?: string
  /** Raw tags string from Komari, e.g. "1Gbps<green>;5T<blue>" */
  tags?: string
  /** ISO date string */
  expired_at?: string
  price?: number
  /** Currency / period suffix, e.g. "$/月" */
  billing_cycle?: string
  hidden?: boolean
}

/** Live record snapshot pushed via /api/clients/[uuid]/recent or WS */
export interface KomariRecord {
  uuid: string
  /** CPU usage percent 0..100 */
  cpu?: number
  /**
   * RAM — may be percent (0..100) OR absolute bytes depending on Komari version.
   * Treat values > 100 as bytes; divide by ram_total to derive percent.
   */
  ram?: number
  ram_total?: number
  swap?: number
  swap_total?: number
  disk?: number
  disk_total?: number
  load?: number
  process?: number
  tcp_conn_count?: number
  udp_conn_count?: number
  /** Bytes per second */
  net_in?: number
  net_out?: number
  /** Cumulative bytes since boot — resets on reboot, NOT per-billing */
  net_total_up?: number
  net_total_down?: number
  /** Latest ping ms */
  ping?: number
  /** Packet loss percent */
  loss?: number
  online?: boolean
  /** Uptime seconds */
  uptime?: number
  updated_at?: string
}

export interface KomariPublicConfig {
  site_name?: string
  description?: string
  /** Data retention days for charts */
  record_keep_days?: number
  ping_keep_days?: number
}

export interface KomariAlert {
  id: string | number
  level: 'info' | 'warn' | 'bad'
  level_label?: string
  message: string
  target?: string
  timestamp: string
}

/** Parsed bandwidth/traffic from node.tags */
export interface NodeLabels {
  bandwidth?: { value: string; color?: string }
  traffic?: { value: string; color?: string }
  net_type?: { value: string; color?: string }
  raw: Array<{ value: string; color?: string }>
}
