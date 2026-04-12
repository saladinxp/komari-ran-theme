/**
 * Formatting utilities — bytes / duration / percent / labels.
 * All functions accept undefined and return safe placeholder strings.
 */

const PLACEHOLDER = '—'

export function formatBytes(bytes?: number, digits = 1): string {
  if (bytes == null || !Number.isFinite(bytes)) return PLACEHOLDER
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const idx = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)), units.length - 1)
  const v = bytes / Math.pow(1024, idx)
  return `${v.toFixed(idx === 0 ? 0 : digits)} ${units[idx]}`
}

export function formatBps(bps?: number): string {
  if (bps == null || !Number.isFinite(bps)) return PLACEHOLDER
  return `${formatBytes(bps)}/s`
}

export function formatPercent(v?: number, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return PLACEHOLDER
  return `${v.toFixed(digits)}%`
}

/**
 * Komari `ram` field is sometimes percent (0..100), sometimes absolute bytes.
 * Resolve to a percent 0..100.
 */
export function resolveRamPercent(ram?: number, ram_total?: number): number | undefined {
  if (ram == null || !Number.isFinite(ram)) return undefined
  if (ram <= 100) return ram
  if (ram_total && ram_total > 0) return (ram / ram_total) * 100
  return undefined
}

export function formatUptime(seconds?: number): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return PLACEHOLDER
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m`
}

export function formatUptimeShort(seconds?: number): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return PLACEHOLDER
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  if (d > 0) return `${d}d ${h}h`
  return `${h}h`
}

export function daysUntil(iso?: string): number | undefined {
  if (!iso) return undefined
  const target = new Date(iso).getTime()
  if (!Number.isFinite(target)) return undefined
  const now = Date.now()
  return Math.ceil((target - now) / 86400000)
}

/** Parse tags like "2Gbps<green>;3T<blue>" into structured labels */
export function parseLabels(tags?: string): {
  bandwidth?: { value: string; color?: string }
  traffic?: { value: string; color?: string }
  net_type?: { value: string; color?: string }
  raw: Array<{ value: string; color?: string }>
} {
  if (!tags) return { raw: [] }
  const items = tags
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(.+?)(?:<(.+?)>)?$/)
      return { value: (m?.[1] ?? s).trim(), color: m?.[2]?.trim() }
    })

  const out: ReturnType<typeof parseLabels> = { raw: items }
  for (const it of items) {
    if (/bps|gbps|mbps/i.test(it.value)) out.bandwidth = it
    else if (/^\d+\s*[TG]B?$|^\d+\s*[TG]$/i.test(it.value)) out.traffic = it
    else if (/v[46]|ipv[46]/i.test(it.value)) out.net_type = it
  }
  return out
}

/** Status from CPU+ping+online */
export function deriveStatus(rec?: { online?: boolean; cpu?: number; loss?: number }): 'good' | 'warn' | 'bad' {
  if (!rec || rec.online === false) return 'bad'
  if ((rec.cpu ?? 0) > 80 || (rec.loss ?? 0) > 5) return 'warn'
  return 'good'
}
