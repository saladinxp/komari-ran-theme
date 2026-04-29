/**
 * Formatting utilities — bytes / duration / percent / labels.
 * All functions accept undefined and return safe placeholder strings.
 */

const PLACEHOLDER = '—'

/**
 * 流量单位策略 — 由后台 theme_settings.bps_unit 控制:
 *   - 'auto'    完全自适应 B/KB/MB/GB(默认,最精确但 B↔KB 临界值会闪)
 *   - 'min-kb'  下限锁 KB(< 1 KB 显示 0 KB/s),抹掉 B 级别抖动
 *   - 'lock-kb' 全程锁 KB/s,数字大就大,跨档不变化
 *
 * App / MapApp 在 useEffect 里通过 setBpsUnitMode 设置;
 * formatBps / compactBps 内部按当前 mode 决定切换规则。
 */
export type BpsUnitMode = 'auto' | 'min-kb' | 'lock-kb'

let currentBpsMode: BpsUnitMode = 'auto'

export function setBpsUnitMode(mode: BpsUnitMode): void {
  currentBpsMode = mode
}

export function getBpsUnitMode(): BpsUnitMode {
  return currentBpsMode
}

export function parseBpsUnitMode(v: unknown): BpsUnitMode {
  if (v === 'min-kb' || v === 'lock-kb') return v
  return 'auto'
}

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
  if (bps === 0) return '0 B/s'

  if (currentBpsMode === 'lock-kb') {
    // 全程锁 KB/s,即便几百 MB/s 也显示成 350000 KB/s
    const kb = bps / 1024
    const digits = kb >= 100 ? 0 : 1
    return `${kb.toFixed(digits)} KB/s`
  }

  if (currentBpsMode === 'min-kb' && bps < 1024) {
    // < 1 KB 一律 "0 KB/s",抹平 B 级别抖动
    return '0 KB/s'
  }

  // auto / min-kb (>= 1KB) — 自适应
  return `${formatBytes(bps)}/s`
}

/**
 * Compact bandwidth — short form (e.g. "1.2K", "892", "3.4M").
 * 用在 NodeTable / Hub 等横向密集列表里。
 * 跟随同一个 bps_unit mode。
 */
export function compactBps(bps?: number): string {
  if (bps == null || !Number.isFinite(bps) || bps <= 0) return '0'

  if (currentBpsMode === 'lock-kb') {
    const v = bps / 1000
    if (v < 0.1) return '0K'
    if (v >= 100) return `${Math.round(v)}K`
    return `${v.toFixed(1).replace(/\.0$/, '')}K`
  }

  if (currentBpsMode === 'min-kb' && bps < 1000) {
    return '0K'
  }

  if (bps < 1000) return `${Math.round(bps)}`
  if (bps < 1_000_000) {
    const v = bps / 1000
    return v >= 100 ? `${Math.round(v)}K` : `${v.toFixed(1).replace(/\.0$/, '')}K`
  }
  if (bps < 1_000_000_000) {
    const v = bps / 1_000_000
    return v >= 100 ? `${Math.round(v)}M` : `${v.toFixed(1).replace(/\.0$/, '')}M`
  }
  const v = bps / 1_000_000_000
  return `${v.toFixed(1).replace(/\.0$/, '')}G`
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
