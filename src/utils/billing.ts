/**
 * Billing parsing — Komari nodes carry { price, billing_cycle (days), currency }.
 * `billing_cycle` is **days**, not a string label. We map it to a cycle suffix
 * and a per-month figure for cost aggregation.
 */
import type { KomariNode } from '@/types/komari'

export interface ParsedBilling {
  /** Price in node's native currency, normalized to per-month */
  monthly: number
  /** Display suffix in zh: /月, /季, /半年, /年, /三年, /Ny */
  cycleStr: string
  /** Currency symbol from the node, falls back to "$" */
  currency: string
  /** Composed display string, e.g. "$10/月" */
  display: string
  /** True when node has price === -1 (free / lifetime sentinel) */
  free: boolean
  /** Days until expiry (negative if past). undefined if no expired_at. */
  daysLeft?: number
  /** Months in this billing cycle (1, 3, 6, 12, ...) */
  months: number
}

/**
 * Parse the billing fields off a node. Returns null if no priced subscription
 * (no price, or price === 0).
 */
export function parseBilling(node: KomariNode): ParsedBilling | null {
  const price = Number(node.price)
  if (!Number.isFinite(price) || price === 0) return null

  const cur = node.currency || '$'
  const days = Number(node.billing_cycle) || 30
  const daysLeft = computeDaysLeft(node.expired_at)

  // Free / lifetime sentinel
  if (price === -1) {
    return {
      monthly: 0,
      cycleStr: '免费',
      currency: '',
      display: '免费',
      free: true,
      daysLeft,
      months: 0,
    }
  }

  let cycleStr: string
  let months: number
  if (days <= 31) {
    cycleStr = '/月'
    months = 1
  } else if (days <= 93) {
    cycleStr = '/季'
    months = 3
  } else if (days <= 186) {
    cycleStr = '/半年'
    months = 6
  } else if (days <= 366) {
    cycleStr = '/年'
    months = 12
  } else if (days <= 1096) {
    cycleStr = '/三年'
    months = 36
  } else {
    const yrs = Math.max(1, Math.round(days / 365))
    cycleStr = `/${yrs}年`
    months = yrs * 12
  }

  return {
    monthly: price / months,
    cycleStr,
    currency: cur,
    display: `${cur}${formatPrice(price)}${cycleStr}`,
    free: false,
    daysLeft,
    months,
  }
}

/**
 * Symbol → ISO code. ¥ / ￥ resolves to CNY:中文区机器实际上几乎全部
 * 用 ¥ 标人民币(几百到上千很常见),日元标价的 VPS 圈基本不用 ¥,
 * 之前的"金额 > 100 当 JPY"启发式会把多数 CNY 误判成日元,弊大于利。
 * 真要标日元就让 Komari 后台直接配 'JPY' / '円' / 'JP¥' 等明确符号。
 */
export const SYMBOL_TO_CODE: Record<string, string> = {
  '$': 'USD',
  'US$': 'USD',
  '¥': 'CNY',
  '￥': 'CNY',
  'CN¥': 'CNY',
  '€': 'EUR',
  '£': 'GBP',
  '₩': 'KRW',
  '₹': 'INR',
  'HK$': 'HKD',
  'NT$': 'TWD',
  'S$': 'SGD',
  'C$': 'CAD',
  'A$': 'AUD',
  'R$': 'BRL',
}

/**
 * Resolve a node's currency symbol to a 3-letter ISO code.
 * Falls back to USD for unknown symbols.
 * (amount 形参保留:旧调用方还在传,删起来跨多文件;无副作用。)
 */
export function symbolToCode(symbol: string, _amount = 0): string {
  if (!symbol) return 'USD'
  return SYMBOL_TO_CODE[symbol] || 'USD'
}

/**
 * Convert from one currency to another using a USD-base rate map.
 * `rates[code]` = how many `code` per 1 USD.
 */
export function convert(
  amount: number,
  fromCode: string,
  toCode: string,
  rates: Record<string, number>,
): number {
  if (fromCode === toCode) return amount
  const fromRate = rates[fromCode]
  const toRate = rates[toCode]
  if (!fromRate || !toRate) return amount
  // amount/fromRate → USD, * toRate → target
  return (amount / fromRate) * toRate
}

const SYMBOL_FOR_CODE: Record<string, string> = {
  USD: '$',
  CNY: '¥',
  EUR: '€',
  GBP: '£',
  KRW: '₩',
  HKD: 'HK$',
  TWD: 'NT$',
  SGD: 'S$',
  CAD: 'C$',
  AUD: 'A$',
  INR: '₹',
  BRL: 'R$',
}

export function symbolFor(code: string): string {
  return SYMBOL_FOR_CODE[code] || code
}

/** Pretty-print money with sensible decimals (no trailing zeros for whole values). */
export function fmtMoney(amount: number, code: string): string {
  if (!Number.isFinite(amount)) return '—'
  const sym = symbolFor(code)
  // KRW has no decimals
  if (code === 'KRW') {
    return `${sym}${Math.round(amount).toLocaleString('en-US')}`
  }
  // Whole numbers stay whole
  if (Math.abs(amount - Math.round(amount)) < 0.005) {
    return `${sym}${Math.round(amount).toLocaleString('en-US')}`
  }
  return `${sym}${amount.toFixed(2)}`
}

function formatPrice(price: number): string {
  if (Math.abs(price - Math.round(price)) < 0.005) return String(Math.round(price))
  return price.toFixed(2)
}

function computeDaysLeft(iso?: string): number | undefined {
  if (!iso) return undefined
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return undefined
  return Math.ceil((t - Date.now()) / 86400000)
}

/** Format an ISO/string expiry date as "MM-DD" or "YYYY-MM-DD" depending on year. */
export function fmtExpiry(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '—'
  const now = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  if (d.getFullYear() !== now.getFullYear()) {
    return `${d.getFullYear()}-${mm}-${dd}`
  }
  return `${mm}-${dd}`
}

/**
 * Reconstruct the past 12 months of committed monthly cost.
 *
 * We don't have a real billing ledger. But each node carries
 * { price, billing_cycle, expired_at } — this lets us compute, for any past
 * month M: "was this node still inside its subscription window in month M?"
 * If yes, that month included its monthly cost.
 *
 * Honest framing: this is **committed cost per month**, derived from current
 * subscription state, not a real ledger. Stable fleets look flat; nodes added
 * or expired mid-year produce visible steps.
 *
 * Returns 12 points; index 0 = 11 months ago, index 11 = current month.
 */
export interface MonthlyCostPoint {
  month: number
  year: number
  total: number
  label: string
}

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

export function reconstructMonthlyCosts<T>(
  rows: T[],
  getExpiredAt: (row: T) => string | undefined,
  getCycleDays: (row: T) => number,
  getMonthlyCost: (row: T) => number,
): MonthlyCostPoint[] {
  const now = new Date()
  const points: MonthlyCostPoint[] = []

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 15)
    const t = d.getTime()
    let total = 0
    for (const row of rows) {
      const expIso = getExpiredAt(row)
      const monthly = getMonthlyCost(row)
      if (!expIso) {
        total += monthly
        continue
      }
      const expT = new Date(expIso).getTime()
      if (!Number.isFinite(expT)) {
        total += monthly
        continue
      }
      // A node at month M is counted if it was still active that month.
      // We approximate "active" as: M is at or before expired_at.
      // (We don't try to model when the subscription started — most users
      // have been running these nodes for longer than 12 months anyway.)
      if (t <= expT) {
        total += monthly
      }
    }
    points.push({
      month: d.getMonth(),
      year: d.getFullYear(),
      total,
      label: MONTH_LETTERS[d.getMonth()],
    })
  }
  return points
}
