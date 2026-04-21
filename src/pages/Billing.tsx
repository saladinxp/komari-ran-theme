import { useMemo, useState } from 'react'
import { Sidebar } from '@/components/panels/Sidebar'
import { Topbar } from '@/components/panels/Topbar'
import { CardFrame } from '@/components/panels/CardFrame'
import { HeroStats } from '@/components/panels/HeroStats'
import { Footer } from '@/components/panels/Footer'
import { Etch } from '@/components/atoms/Etch'
import { Numeric } from '@/components/atoms/Numeric'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { Segmented } from '@/components/atoms/Segmented'
import { StatusDot } from '@/components/atoms/StatusDot'
import { hashFor } from '@/router/route'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import {
  parseBilling,
  symbolToCode,
  convert,
  fmtMoney,
  fmtExpiry,
  type ParsedBilling,
} from '@/utils/billing'

type Theme = 'ran-night' | 'ran-mist'
type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'
type DisplayCode = 'USD' | 'CNY' | 'EUR' | 'JPY' | 'GBP' | 'NATIVE'

interface Props {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  theme: Theme
  onTheme: (t: Theme) => void
  siteName?: string
  conn?: Conn
  lastUpdate?: number | null
}

interface BillingRow {
  node: KomariNode
  record?: KomariRecord
  parsed: ParsedBilling
  /** Original currency code resolved from the node's symbol (¥ heuristic applied) */
  fromCode: string
  online: boolean
}

const CURRENCY_OPTIONS: { value: DisplayCode; label: string }[] = [
  { value: 'USD', label: 'USD' },
  { value: 'CNY', label: 'CNY' },
  { value: 'EUR', label: 'EUR' },
  { value: 'JPY', label: 'JPY' },
  { value: 'GBP', label: 'GBP' },
  { value: 'NATIVE', label: '原始' },
]

/** Two-letter region prefix → continent label (rough; falls through to OTHER). */
const CONTINENT_MAP: Record<string, { zh: string; en: string }> = {
  // Asia
  CN: { zh: '亚洲', en: 'ASIA' },
  HK: { zh: '亚洲', en: 'ASIA' },
  TW: { zh: '亚洲', en: 'ASIA' },
  JP: { zh: '亚洲', en: 'ASIA' },
  KR: { zh: '亚洲', en: 'ASIA' },
  SG: { zh: '亚洲', en: 'ASIA' },
  IN: { zh: '亚洲', en: 'ASIA' },
  MY: { zh: '亚洲', en: 'ASIA' },
  TH: { zh: '亚洲', en: 'ASIA' },
  VN: { zh: '亚洲', en: 'ASIA' },
  ID: { zh: '亚洲', en: 'ASIA' },
  PH: { zh: '亚洲', en: 'ASIA' },
  // Europe
  DE: { zh: '欧洲', en: 'EUROPE' },
  FR: { zh: '欧洲', en: 'EUROPE' },
  GB: { zh: '欧洲', en: 'EUROPE' },
  UK: { zh: '欧洲', en: 'EUROPE' },
  NL: { zh: '欧洲', en: 'EUROPE' },
  IT: { zh: '欧洲', en: 'EUROPE' },
  ES: { zh: '欧洲', en: 'EUROPE' },
  PL: { zh: '欧洲', en: 'EUROPE' },
  RU: { zh: '欧洲', en: 'EUROPE' },
  FI: { zh: '欧洲', en: 'EUROPE' },
  SE: { zh: '欧洲', en: 'EUROPE' },
  CH: { zh: '欧洲', en: 'EUROPE' },
  AT: { zh: '欧洲', en: 'EUROPE' },
  BE: { zh: '欧洲', en: 'EUROPE' },
  // Americas
  US: { zh: '北美', en: 'N.AMERICA' },
  CA: { zh: '北美', en: 'N.AMERICA' },
  MX: { zh: '北美', en: 'N.AMERICA' },
  BR: { zh: '南美', en: 'S.AMERICA' },
  AR: { zh: '南美', en: 'S.AMERICA' },
  CL: { zh: '南美', en: 'S.AMERICA' },
  // Oceania
  AU: { zh: '大洋洲', en: 'OCEANIA' },
  NZ: { zh: '大洋洲', en: 'OCEANIA' },
  // Africa
  ZA: { zh: '非洲', en: 'AFRICA' },
  EG: { zh: '非洲', en: 'AFRICA' },
}

function regionToContinent(region?: string): { zh: string; en: string } {
  if (!region) return { zh: '其他', en: 'OTHER' }
  const head = region.slice(0, 2).toUpperCase()
  return CONTINENT_MAP[head] || { zh: '其他', en: 'OTHER' }
}

function deriveStatus(online: boolean, daysLeft?: number): 'good' | 'warn' | 'bad' {
  if (!online) return 'bad'
  if (daysLeft != null && daysLeft <= 30 && daysLeft > 0) return 'warn'
  return 'good'
}

export function BillingPage({
  nodes,
  records,
  theme,
  onTheme,
  siteName = '岚 · Komari',
  conn = 'idle',
  lastUpdate,
}: Props) {
  const [displayCode, setDisplayCode] = useState<DisplayCode>('USD')
  const { rates, fallback } = useExchangeRates()

  // Build billing rows — only nodes with priced subscriptions (parseBilling != null)
  const rows = useMemo<BillingRow[]>(() => {
    const list: BillingRow[] = []
    for (const node of nodes) {
      const parsed = parseBilling(node)
      if (!parsed) continue
      const record = records[node.uuid]
      const fromCode = symbolToCode(parsed.currency, parsed.monthly)
      list.push({
        node,
        record,
        parsed,
        fromCode,
        online: record?.online === true,
      })
    }
    return list
  }, [nodes, records])

  // ALL aggregations happen AFTER currency conversion, per-row.
  // (Don't sum first then convert — would mix currencies.)
  const monthlyOf = (row: BillingRow): number => {
    if (row.parsed.free) return 0
    if (displayCode === 'NATIVE') return row.parsed.monthly
    return convert(row.parsed.monthly, row.fromCode, displayCode, rates)
  }

  // Stats
  const totalMonthly = useMemo(
    () => rows.reduce((s, r) => s + monthlyOf(r), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, displayCode, rates],
  )
  const totalAnnual = totalMonthly * 12
  const expiring30 = useMemo(
    () => rows.filter((r) => r.parsed.daysLeft != null && r.parsed.daysLeft >= 0 && r.parsed.daysLeft <= 30),
    [rows],
  )
  const avgPerNode = rows.length > 0 ? totalMonthly / rows.length : 0
  // Display code for stat cards: NATIVE = leave a generic placeholder
  const statCode = displayCode === 'NATIVE' ? 'USD' : displayCode

  // For NATIVE mode, formatter uses each row's own code; for converted, uses statCode
  const fmtRow = (amount: number, row: BillingRow): string => {
    if (displayCode === 'NATIVE') return fmtMoney(amount, row.fromCode)
    return fmtMoney(amount, statCode)
  }

  // Sorted by expiry
  const byExpiry = useMemo(() => {
    return [...rows].sort((a, b) => {
      const da = a.parsed.daysLeft ?? Number.POSITIVE_INFINITY
      const db = b.parsed.daysLeft ?? Number.POSITIVE_INFINITY
      return da - db
    })
  }, [rows])

  // Critical (≤30 days, still in future)
  const critical = useMemo(
    () => rows.filter((r) => r.parsed.daysLeft != null && r.parsed.daysLeft >= 0 && r.parsed.daysLeft <= 30),
    [rows],
  )

  // Top spenders for cost breakdown donut + Top-5 list
  const byCost = useMemo(() => [...rows].sort((a, b) => monthlyOf(b) - monthlyOf(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, displayCode, rates],
  )

  // Continent groupby
  const continentRows = useMemo(() => {
    const map = new Map<string, { zh: string; en: string; cost: number; count: number }>()
    for (const r of rows) {
      const cont = regionToContinent(r.node.region)
      const key = cont.en
      const existing = map.get(key)
      const m = monthlyOf(r)
      if (existing) {
        existing.cost += m
        existing.count += 1
      } else {
        map.set(key, { zh: cont.zh, en: cont.en, cost: m, count: 1 })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, displayCode, rates])

  const onlineCount = nodes.filter((n) => records[n.uuid]?.online === true).length

  // Topbar subtitle
  const subtitle =
    rows.length === 0
      ? `${nodes.length} PROBES · NO BILLING DATA`
      : `${rows.length} SUBSCRIPTIONS · ${fmtMoney(totalMonthly, statCode)}/MO · NEXT ${
          byExpiry[0]?.parsed.daysLeft != null ? byExpiry[0].parsed.daysLeft + 'D' : '—'
        }`

  // Empty state — no priced nodes at all
  if (rows.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          background: 'var(--bg-0)',
          color: 'var(--fg-0)',
          fontFamily: 'var(--font-sans)',
          minHeight: '100vh',
        }}
      >
        <Sidebar active="billing" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Topbar
            title={siteName}
            subtitle={subtitle}
            theme={theme}
            onTheme={onTheme}
            online={onlineCount}
            total={nodes.length}
            lastUpdate={lastUpdate}
            conn={conn}
          />
          <main style={{ padding: 20, flex: 1 }}>
            <CardFrame title="Billing & Renewal" code="B · 00">
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <Etch size={11}>NO BILLING DATA</Etch>
                <div style={{ marginTop: 12, color: 'var(--fg-2)', fontSize: 12, lineHeight: 1.7 }}>
                  在 Komari 节点设置里填入 <span style={{ color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)' }}>price</span>
                  {' / '}
                  <span style={{ color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)' }}>billing_cycle</span>
                  {' / '}
                  <span style={{ color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)' }}>currency</span>
                  {' / '}
                  <span style={{ color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)' }}>expired_at</span>
                  ,本页将自动汇总成本与续期。
                </div>
                <div style={{ marginTop: 8, color: 'var(--fg-3)', fontSize: 11 }}>
                  共扫描 {nodes.length} 个探针 · 0 个含订阅信息
                </div>
              </div>
            </CardFrame>
          </main>
          <Footer version="v0.9.0" />
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--bg-0)',
        color: 'var(--fg-0)',
        fontFamily: 'var(--font-sans)',
        minHeight: '100vh',
      }}
    >
      <Sidebar active="billing" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          title={siteName}
          subtitle={subtitle}
          theme={theme}
          onTheme={onTheme}
          online={onlineCount}
          total={nodes.length}
          lastUpdate={lastUpdate}
          conn={conn}
        />

        <main style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Currency switcher rail */}
          <div
            className="precision-card"
            style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <Etch>DISPLAY · CURRENCY</Etch>
              <SerialPlate>FX · 01</SerialPlate>
              <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                {fallback ? '使用离线汇率表' : '汇率 · open.er-api.com'}
              </span>
            </div>
            <Segmented
              options={CURRENCY_OPTIONS}
              value={displayCode}
              onChange={(v) => setDisplayCode(v as DisplayCode)}
            />
          </div>

          {/* HeroStats — 4 cells */}
          <HeroStats
            stats={[
              {
                label: 'MONTHLY COST',
                code: 'B01',
                value: displayCode === 'NATIVE' ? '混合' : fmtMoney(totalMonthly, statCode),
                unit: '/mo',
              },
              {
                label: 'ANNUAL ESTIMATE',
                code: 'B02',
                value: displayCode === 'NATIVE' ? '混合' : fmtMoney(totalAnnual, statCode),
                unit: '/yr',
              },
              {
                label: 'EXPIRING · 30D',
                code: 'B03',
                value: String(expiring30.length),
                unit: 'svr',
              },
              {
                label: 'AVG / NODE',
                code: 'B04',
                value: displayCode === 'NATIVE' ? '混合' : fmtMoney(avgPerNode, statCode),
                unit: '/mo',
              },
            ]}
          />

          {/* Renewal urgency rail */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
            <CardFrame title="Renewal Timeline" code="R · 01" action={<Etch>BY DAYS LEFT</Etch>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {byExpiry.map((r) => {
                  const dl = r.parsed.daysLeft
                  const urgent = dl != null && dl <= 30 && dl >= 0
                  const warn = dl != null && dl > 30 && dl <= 90
                  const past = dl != null && dl < 0
                  const c = past
                    ? 'var(--signal-bad)'
                    : urgent
                      ? 'var(--signal-bad)'
                      : warn
                        ? 'var(--signal-warn)'
                        : 'var(--signal-good)'
                  const pct = dl == null ? 100 : Math.max(0, Math.min(100, (dl / 365) * 100))
                  const m = monthlyOf(r)
                  return (
                    <a
                      key={r.node.uuid}
                      href={hashFor({ name: 'nodes', uuid: r.node.uuid })}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 70px 1fr 56px 90px',
                        alignItems: 'center',
                        gap: 10,
                        fontSize: 11,
                        color: 'inherit',
                        textDecoration: 'none',
                        padding: '2px 0',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <StatusDot status={r.online ? 'good' : 'bad'} size={5} />
                        <span
                          style={{
                            color: 'var(--fg-0)',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {r.node.name || r.node.uuid.slice(0, 8)}
                        </span>
                      </div>
                      <SerialPlate>{r.node.region || '—'}</SerialPlate>
                      <div
                        style={{
                          position: 'relative',
                          height: 6,
                          background: 'var(--bg-inset)',
                          border: '1px solid var(--edge-engrave)',
                          borderRadius: 2,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: `${pct}%`,
                            background: c,
                            boxShadow: `0 0 4px ${c}`,
                          }}
                        />
                        {[1, 3, 6, 9].map((mo) => (
                          <div
                            key={mo}
                            style={{
                              position: 'absolute',
                              left: `${((mo * 30) / 365) * 100}%`,
                              top: 0,
                              bottom: 0,
                              width: 1,
                              background: 'var(--edge-bright)',
                              opacity: 0.5,
                            }}
                          />
                        ))}
                      </div>
                      <span
                        className="mono"
                        style={{
                          color: c,
                          textAlign: 'right',
                          fontWeight: 600,
                          fontFamily: 'var(--font-mono)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {dl == null ? '—' : `${dl}d`}
                      </span>
                      <span
                        style={{
                          color: 'var(--fg-1)',
                          textAlign: 'right',
                          fontFamily: 'var(--font-mono)',
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: 11,
                        }}
                      >
                        {fmtRow(m, r)}/mo
                      </span>
                    </a>
                  )
                })}
                {/* Month ruler */}
                <div
                  style={{
                    marginTop: 4,
                    paddingTop: 8,
                    borderTop: '1px solid var(--edge-engrave)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(13, 1fr)',
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--fg-3)',
                    letterSpacing: '0.1em',
                  }}
                >
                  {['0', '1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '10m', '11m', '12m'].map(
                    (l, i) => (
                      <span
                        key={i}
                        style={{
                          textAlign: i === 0 ? 'left' : i === 12 ? 'right' : 'center',
                        }}
                      >
                        {l}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </CardFrame>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CardFrame title="Critical · ≤30 days" code="R · 02">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {critical.length === 0 && (
                    <div style={{ padding: '14px 4px' }}>
                      <Etch>NO IMMEDIATE RENEWALS</Etch>
                    </div>
                  )}
                  {critical.map((r) => (
                    <div
                      key={r.node.uuid}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 60px',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        background: 'var(--bg-1)',
                        border: '1px solid color-mix(in oklab, var(--signal-bad) 25%, var(--edge-engrave))',
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {r.node.name || r.node.uuid.slice(0, 8)}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 9,
                            color: 'var(--fg-3)',
                            letterSpacing: '0.06em',
                          }}
                        >
                          {r.node.region || '—'} · 到期 {fmtExpiry(r.node.expired_at)}
                        </span>
                      </div>
                      <span
                        className="mono"
                        style={{
                          color: 'var(--signal-bad)',
                          fontWeight: 600,
                          textAlign: 'right',
                          fontFamily: 'var(--font-mono)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {r.parsed.daysLeft}d
                      </span>
                    </div>
                  ))}
                </div>
              </CardFrame>

              <CardFrame title="Cost Breakdown" code="R · 03">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <CostDonut rows={byCost} monthlyOf={monthlyOf} totalMonthly={totalMonthly} statCode={statCode} displayCode={displayCode} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                    {byCost.slice(0, 5).map((r, i) => {
                      const m = monthlyOf(r)
                      const pct = totalMonthly > 0 ? (m / totalMonthly) * 100 : 0
                      const palette = [
                        'var(--accent)',
                        'var(--signal-info)',
                        'var(--signal-good)',
                        'var(--signal-warn)',
                        'var(--accent-dim)',
                      ]
                      return (
                        <div
                          key={r.node.uuid}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '8px 1fr 60px 36px',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 11,
                          }}
                        >
                          <span style={{ width: 8, height: 8, background: palette[i] }} />
                          <span
                            style={{
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: 'var(--fg-1)',
                            }}
                          >
                            {r.node.name || r.node.uuid.slice(0, 8)}
                          </span>
                          <span
                            style={{
                              color: 'var(--fg-0)',
                              textAlign: 'right',
                              fontFamily: 'var(--font-mono)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {fmtRow(m, r)}
                          </span>
                          <span
                            style={{
                              color: 'var(--fg-3)',
                              textAlign: 'right',
                              fontSize: 10,
                              fontFamily: 'var(--font-mono)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardFrame>
            </div>
          </div>

          {/* Detailed table */}
          <CardFrame title="Subscriptions · Detailed" code="B · 11" inset>
            <div style={{ overflow: 'auto' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 1.5fr 90px 110px 110px 100px 90px',
                  padding: '10px 16px',
                  background: 'var(--bg-1)',
                  borderBottom: '1px solid var(--edge-mid)',
                  gap: 12,
                  alignItems: 'center',
                  minWidth: 760,
                }}
              >
                <span></span>
                <Etch>HOST</Etch>
                <Etch>REGION</Etch>
                <Etch style={{ textAlign: 'right' }}>PRICE/MO</Etch>
                <Etch style={{ textAlign: 'right' }}>YEARLY</Etch>
                <Etch style={{ textAlign: 'center' }}>EXPIRES</Etch>
                <Etch style={{ textAlign: 'right' }}>DAYS LEFT</Etch>
              </div>
              {byExpiry.map((r) => {
                const dl = r.parsed.daysLeft
                const urgent = dl != null && dl <= 30 && dl >= 0
                const past = dl != null && dl < 0
                const m = monthlyOf(r)
                const cont = regionToContinent(r.node.region)
                return (
                  <a
                    key={r.node.uuid}
                    href={hashFor({ name: 'nodes', uuid: r.node.uuid })}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '20px 1.5fr 90px 110px 110px 100px 90px',
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--edge-engrave)',
                      gap: 12,
                      alignItems: 'center',
                      fontSize: 11,
                      background: urgent || past
                        ? 'color-mix(in oklab, var(--signal-bad) 4%, transparent)'
                        : 'transparent',
                      textDecoration: 'none',
                      color: 'inherit',
                      minWidth: 760,
                    }}
                  >
                    <StatusDot status={r.online ? 'good' : 'bad'} size={6} />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 12,
                          color: 'var(--fg-0)',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {r.node.name || r.node.uuid.slice(0, 8)}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          color: 'var(--fg-3)',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {cont.zh} · {cont.en}
                      </span>
                    </div>
                    <SerialPlate>{r.node.region || '—'}</SerialPlate>
                    <span
                      style={{
                        color: 'var(--fg-0)',
                        textAlign: 'right',
                        fontWeight: 500,
                        fontFamily: 'var(--font-mono)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {r.parsed.free ? '免费' : fmtRow(m, r)}
                    </span>
                    <span
                      style={{
                        color: 'var(--fg-2)',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {r.parsed.free ? '—' : fmtRow(m * 12, r)}
                    </span>
                    <span
                      style={{
                        color: 'var(--fg-1)',
                        textAlign: 'center',
                        letterSpacing: '0.04em',
                        fontFamily: 'var(--font-mono)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {fmtExpiry(r.node.expired_at)}
                    </span>
                    <span
                      style={{
                        color: past
                          ? 'var(--signal-bad)'
                          : urgent
                            ? 'var(--signal-bad)'
                            : dl != null && dl <= 90
                              ? 'var(--signal-warn)'
                              : 'var(--fg-1)',
                        textAlign: 'right',
                        fontWeight: urgent || past ? 600 : 400,
                        fontFamily: 'var(--font-mono)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {dl == null ? '—' : `${dl}d`}
                    </span>
                  </a>
                )
              })}
              {/* Total row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 1.5fr 90px 110px 110px 100px 90px',
                  padding: '14px 16px',
                  background: 'var(--bg-1)',
                  borderTop: '1px solid var(--edge-mid)',
                  gap: 12,
                  alignItems: 'baseline',
                  minWidth: 760,
                }}
              >
                <span></span>
                <span
                  style={{ fontSize: 13, fontWeight: 600, gridColumn: 'span 2' }}
                >
                  TOTAL · {rows.length} subscriptions
                </span>
                <span style={{ textAlign: 'right' }}>
                  <Numeric
                    value={displayCode === 'NATIVE' ? '混合' : fmtMoney(totalMonthly, statCode)}
                    unit="/mo"
                    size={15}
                  />
                </span>
                <span style={{ textAlign: 'right' }}>
                  <Numeric
                    value={displayCode === 'NATIVE' ? '混合' : fmtMoney(totalAnnual, statCode)}
                    unit="/yr"
                    size={15}
                    color="var(--accent-bright)"
                  />
                </span>
                <span></span>
                <span></span>
              </div>
            </div>
          </CardFrame>

          {/* Continent breakdown */}
          <CardFrame title="By Continent · Spend" code="T · 05">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {continentRows.map((cr, i) => {
                const pct = totalMonthly > 0 ? (cr.cost / totalMonthly) * 100 : 0
                const palette = [
                  'var(--accent)',
                  'var(--signal-info)',
                  'var(--signal-good)',
                  'var(--signal-warn)',
                  'var(--accent-dim)',
                  'var(--signal-bad)',
                ]
                const color = palette[i % palette.length]
                return (
                  <div key={cr.en} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>
                        {cr.zh} · {cr.en}{' '}
                        <span style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                          ×{cr.count}
                        </span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <Numeric
                          value={displayCode === 'NATIVE' ? '混合' : fmtMoney(cr.cost, statCode)}
                          size={13}
                        />
                        <Etch>{pct.toFixed(1)}%</Etch>
                      </span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        background: 'var(--bg-inset)',
                        border: '1px solid var(--edge-engrave)',
                        borderRadius: 1,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: color,
                          boxShadow: `0 0 4px ${color}`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardFrame>
        </main>

        <Footer version="v0.9.0" />
      </div>
    </div>
  )
}

interface DonutProps {
  rows: BillingRow[]
  monthlyOf: (r: BillingRow) => number
  totalMonthly: number
  statCode: string
  displayCode: DisplayCode
}

/** SVG segmented donut — slice per row, sized by share of monthlyTotal. */
function CostDonut({ rows, monthlyOf, totalMonthly, statCode, displayCode }: DonutProps) {
  const size = 120
  const r = (size - 14) / 2
  const c = 2 * Math.PI * r
  const palette = [
    'var(--accent)',
    'var(--signal-info)',
    'var(--signal-good)',
    'var(--signal-warn)',
    'var(--accent-dim)',
    'var(--signal-bad)',
    'var(--accent-bright)',
    'var(--fg-2)',
  ]
  let acc = 0
  const slices = rows
    .filter((row) => monthlyOf(row) > 0)
    .map((row, i) => {
      const len = totalMonthly > 0 ? (monthlyOf(row) / totalMonthly) * c : 0
      const offset = -acc
      acc += len
      return { len, offset, color: palette[i % palette.length], key: row.node.uuid }
    })
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--bg-inset)" strokeWidth="10" fill="none" />
        {slices.map((s) => (
          <circle
            key={s.key}
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={s.color}
            strokeWidth="10"
            fill="none"
            strokeDasharray={`${Math.max(0, s.len - 1.5)} ${c}`}
            strokeDashoffset={s.offset}
          />
        ))}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <Numeric
          value={displayCode === 'NATIVE' ? '混合' : fmtMoney(totalMonthly, statCode)}
          size={size * 0.16}
        />
        <Etch size={8}>MONTHLY</Etch>
      </div>
    </div>
  )
}
