import type { KomariNode, KomariRecord, KomariRecordRaw } from '@/types/komari'

/**
 * Normalize raw /api/nodes node into our internal KomariNode.
 * Fills `flag` from region if missing.
 */
export function normalizeNode(raw: KomariNode): KomariNode {
  return {
    ...raw,
    flag: raw.flag ?? deriveFlag(raw.region),
  }
}

/**
 * Convert nested WS payload (cpu.usage, ram.used, ...) into flat record.
 * - cpu.usage → cpu
 * - ram.used/total → memory_used/memory_total
 * - network.up/down → network_tx/network_rx (server upload = "tx")
 * - load.load1/5/15 → load1/load5/load15
 * - connections.tcp/udp → tcp/udp
 */
export function normalizeWsRecord(uuid: string, raw: KomariRecordRaw, online: boolean): KomariRecord {
  return {
    uuid,
    online,
    cpu: raw.cpu?.usage,
    memory_used: raw.ram?.used,
    memory_total: raw.ram?.total,
    swap_used: raw.swap?.used,
    swap_total: raw.swap?.total,
    disk_used: raw.disk?.used,
    disk_total: raw.disk?.total,
    network_tx: raw.network?.up,
    network_rx: raw.network?.down,
    network_total_up: raw.network?.totalUp,
    network_total_down: raw.network?.totalDown,
    tcp: raw.connections?.tcp,
    udp: raw.connections?.udp,
    load1: raw.load?.load1,
    load5: raw.load?.load5,
    load15: raw.load?.load15,
    uptime: raw.uptime,
    process: raw.process,
    os: raw.os,
    cpu_model: raw.cpu_model,
    message: raw.message,
    updated_at: raw.updated_at,
  }
}

/** Build offline placeholder, preserving total fields from prior live record. */
export function makeOfflineRecord(uuid: string, prev?: KomariRecord): KomariRecord {
  return {
    uuid,
    online: false,
    memory_total: prev?.memory_total,
    disk_total: prev?.disk_total,
    swap_total: prev?.swap_total,
  }
}

/** "JP-TYO" → "JP". Returns the 2-letter prefix or undefined. */
function deriveFlag(region?: string): string | undefined {
  if (!region) return undefined
  const code = region.split('-')[0]?.toUpperCase()
  if (!code || code.length !== 2) return undefined
  return code
}
