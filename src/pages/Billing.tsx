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
import { Icon } from '@/components/atoms/icons'
import { BarChart } from '@/components/charts/BarChart'
import { hashFor } from '@/router/route'
import type { KomariNode, KomariPublicConfig, KomariRecord } from '@/types/komari'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { useMobileDrawer } from '@/hooks/useMediaQuery'
import {
  parseBilling,
  symbolToCode,
  convert,
  fmtMoney,
  fmtExpiry,
  reconstructMonthlyCosts,
  type ParsedBilling,
} from '@/utils/billing'
import { contentFs } from '@/utils/fontScale'

type Theme = 'ran-night' | 'ran-mist'
type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'
type DisplayCode = 'USD' | 'CNY' | 'EUR' | 'GBP' | 'NATIVE'

interface Props {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  theme: Theme
  onTheme: (t: Theme) => void
  siteName?: string
  conn?: Conn
  lastUpdate?: number | null
  config?: KomariPublicConfig
  hubTargetUuid?: string
}

interface BillingRow {
  node: KomariNode
  record?: KomariRecord
  parsed: ParsedBilling
  /** Original currency code resolved from the node's symbol */
  fromCode: string
  online: boolean
}

const CURRENCY_OPTIONS: { value: DisplayCode; label: string }[] = [
  { value: 'USD', label: 'USD' },
  { value: 'CNY', label: 'CNY' },
  { value: 'EUR', label: 'EUR' },
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
  config,
  hubTargetUuid,
}: Props) {
  const drawer = useMobileDrawer()
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
  // Critical = subscriptions expiring within 7 days (true emergencies).
  // The general "≤30 days" set is still surfaced separately as the
  // EXPIRING · 30D HeroStat and as the warn-tier in Renewal Timeline.
  const critical = useMemo(
    () => rows.filter((r) => r.parsed.daysLeft != null && r.parsed.daysLeft >= 0 && r.parsed.daysLeft <= 7),
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

  // 12-month committed-cost trend, reconstructed from current subscriptions.
  // This is honest about what it is — see the caption on the card.
  const costTrend = useMemo(
    () =>
      reconstructMonthlyCosts(
        rows,
        (r) => r.node.expired_at,
        (r) => Number(r.node.billing_cycle) || 30,
        (r) => monthlyOf(r),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, displayCode, rates],
  )
  const trendAvg = costTrend.length > 0
    ? costTrend.reduce((s, p) => s + p.total, 0) / costTrend.length
    : 0
  const trendPeak = costTrend.length > 0
    ? Math.max(...costTrend.map((p) => p.total))
    : 0

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
        <Sidebar active="billing" mobileOpen={drawer.open} onMobileClose={drawer.onClose} hubTargetUuid={hubTargetUuid} />
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
                      onMobileMenu={drawer.onOpen}
          />
          <main className="app-main" style={{ padding: 20, flex: 1 }}>
            <CardFrame title="Billing & Renewal" code="B · 00">
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <Etch size={11}>NO BILLING DATA</Etch>
                <div style={{ marginTop: 12, color: 'var(--fg-2)', fontSize: contentFs(12), lineHeight: 1.7 }}>
                  在 Komari 节点设置里填入 <span style={{ color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)' }}>price</span>
                  {' / '}
                  <span style={{ color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)' }}>billing_cycle</span>
                  {' / '}
                  <span style={{ color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)' }}>currency</span>
                  {' / '}
                  <span style={{ color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)' }}>expired_at</span>
                  ,本页将自动汇总成本与续期。
                </div>
                <div style={{ marginTop: 8, color: 'var(--fg-3)', fontSize: contentFs(11) }}>
                  共扫描 {nodes.length} 个探针 · 0 个含订阅信息
                </div>
              </div>
            </CardFrame>
          </main>
          <Footer version="v1.0.5" config={config} />
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
      <Sidebar active="billing" mobileOpen={drawer.open} onMobileClose={drawer.onClose} hubTargetUuid={hubTargetUuid} />

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
                  onMobileMenu={drawer.onOpen}
        />

        <main className="app-main" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              <span style={{ fontSize: contentFs(10), color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
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
          <div className="billing-2col-renewal" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
            <CardFrame title="Renewal Timeline" code="R · 01" action={<Etch>BY DAYS LEFT</Etch>}>
              <RenewalTimelineBody byExpiry={byExpiry} monthlyOf={monthlyOf} fmtRow={fmtRow} />
            </CardFrame>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CardFrame title="Critical · ≤7 days" code="R · 02">
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
                        gridTemplateColumns: '20px 1fr 60px',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        background: 'var(--bg-1)',
                        border: '1px solid color-mix(in oklab, var(--signal-bad) 25%, var(--edge-engrave))',
                        borderRadius: 4,
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--signal-bad)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {Icon.alert}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: contentFs(12),
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
                            fontSize: contentFs(9),
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
                            fontSize: contentFs(11),
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
                              fontSize: contentFs(10),
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
                  gridTemplateColumns: '20px 1.5fr 90px 110px 110px 110px 100px 90px',
                  padding: '10px 16px',
                  background: 'var(--bg-1)',
                  borderBottom: '1px solid var(--edge-mid)',
                  gap: 12,
                  alignItems: 'center',
                  minWidth: 870,
                }}
              >
                <span></span>
                <Etch>HOST</Etch>
                <Etch>REGION</Etch>
                <Etch>PROVIDER</Etch>
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
                      gridTemplateColumns: '20px 1.5fr 90px 110px 110px 110px 100px 90px',
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--edge-engrave)',
                      gap: 12,
                      alignItems: 'center',
                      fontSize: contentFs(11),
                      background: urgent || past
                        ? 'color-mix(in oklab, var(--signal-bad) 4%, transparent)'
                        : 'transparent',
                      textDecoration: 'none',
                      color: 'inherit',
                      minWidth: 870,
                    }}
                  >
                    <StatusDot status={r.online ? 'good' : 'bad'} size={6} />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: contentFs(12),
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
                          fontSize: contentFs(9),
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
                        fontSize: contentFs(11),
                        color: r.node.provider ? 'var(--fg-1)' : 'var(--fg-3)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {r.node.provider || '—'}
                    </span>
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
                  gridTemplateColumns: '20px 1.5fr 90px 110px 110px 110px 100px 90px',
                  padding: '14px 16px',
                  background: 'var(--bg-1)',
                  borderTop: '1px solid var(--edge-mid)',
                  gap: 12,
                  alignItems: 'baseline',
                  minWidth: 870,
                }}
              >
                <span></span>
                <span
                  style={{ fontSize: contentFs(13), fontWeight: 600, gridColumn: 'span 3' }}
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

          {/* Bottom row: 12-month committed-cost trend + continent spend */}
          <div className="billing-2col-trend" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <CardFrame title="Cost Trend · 12M" code="T · 04" action={<Etch>COMMITTED</Etch>}>
              <BarChart
                data={costTrend.map((p) => p.total)}
                labels={costTrend.map((p) => p.label)}
                height={120}
                color="var(--accent)"
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: '1px solid var(--edge-engrave)',
                }}
              >
                <div>
                  <Etch>12M AVG</Etch>
                  <div>
                    <Numeric
                      value={displayCode === 'NATIVE' ? '混合' : fmtMoney(trendAvg, statCode)}
                      unit="/mo"
                      size={13}
                    />
                  </div>
                </div>
                <div>
                  <Etch>PEAK</Etch>
                  <div>
                    <Numeric
                      value={displayCode === 'NATIVE' ? '混合' : fmtMoney(trendPeak, statCode)}
                      unit="/mo"
                      size={13}
                    />
                  </div>
                </div>
                <div>
                  <Etch>CURRENT</Etch>
                  <div>
                    <Numeric
                      value={displayCode === 'NATIVE' ? '混合' : fmtMoney(totalMonthly, statCode)}
                      unit="/mo"
                      size={13}
                      color="var(--accent-bright)"
                    />
                  </div>
                </div>
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: contentFs(9),
                  color: 'var(--fg-3)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.06em',
                }}
              >
                ※ 由当前订阅状态倒推,反映承诺成本 · 非真实账单
              </div>
            </CardFrame>

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
                        <span style={{ fontSize: contentFs(12), color: 'var(--fg-1)' }}>
                          {cr.zh} · {cr.en}{' '}
                          <span
                            style={{
                              color: 'var(--fg-3)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: contentFs(10),
                            }}
                          >
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
          </div>
        </main>

        <Footer version="v1.0.5" config={config} />
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

interface RenewalRowProps {
  row: BillingRow
  monthly: number
  fmtRow: (amount: number, row: BillingRow) => string
}

/** One row inside Renewal Timeline. Color reflects urgency tier. */
function RenewalRow({ row, monthly, fmtRow }: RenewalRowProps) {
  const dl = row.parsed.daysLeft
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

  return (
    <a
      href={hashFor({ name: 'nodes', uuid: row.node.uuid })}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 70px 1fr 56px 90px',
        alignItems: 'center',
        gap: 10,
        fontSize: contentFs(11),
        color: 'inherit',
        textDecoration: 'none',
        padding: '2px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <StatusDot status={row.online ? 'good' : 'bad'} size={5} />
        <span
          style={{
            color: 'var(--fg-0)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {row.node.name || row.node.uuid.slice(0, 8)}
        </span>
      </div>
      <SerialPlate>{row.node.region || '—'}</SerialPlate>
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
          fontSize: contentFs(11),
        }}
      >
        {fmtRow(monthly, row)}/mo
      </span>
    </a>
  )
}

interface SectionHeaderProps {
  label: string
  count: number
  tone: 'bad' | 'warn' | 'good'
  open: boolean
  onToggle: () => void
}

/** Collapsible section header for the Renewal Timeline urgency groups. */
function SectionHeader({ label, count, tone, open, onToggle }: SectionHeaderProps) {
  const color =
    tone === 'bad'
      ? 'var(--signal-bad)'
      : tone === 'warn'
        ? 'var(--signal-warn)'
        : 'var(--signal-good)'
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 0 6px 0',
        background: 'transparent',
        border: 'none',
        borderTop: '1px solid var(--edge-engrave)',
        cursor: 'pointer',
        color: 'var(--fg-2)',
        fontFamily: 'var(--font-mono)',
        fontSize: contentFs(9),
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 0,
          height: 0,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: `4px solid ${color}`,
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 120ms',
        }}
      />
      <span style={{ color }}>{label}</span>
      <span style={{ color: 'var(--fg-3)' }}>· {count}</span>
    </button>
  )
}

interface TimelineBodyProps {
  byExpiry: BillingRow[]
  monthlyOf: (r: BillingRow) => number
  fmtRow: (amount: number, row: BillingRow) => string
}

/**
 * Renewal Timeline body — splits rows by urgency tier and lets the user
 * collapse the long-tail "safe" group. Past-due (negative days) folds
 * into the urgent tier so it gets visual weight.
 */
function RenewalTimelineBody({ byExpiry, monthlyOf, fmtRow }: TimelineBodyProps) {
  const urgent: BillingRow[] = []
  const warn: BillingRow[] = []
  const safe: BillingRow[] = []
  const noExpiry: BillingRow[] = []

  for (const r of byExpiry) {
    const dl = r.parsed.daysLeft
    if (dl == null) noExpiry.push(r)
    else if (dl <= 30) urgent.push(r) // includes past-due (dl < 0)
    else if (dl <= 90) warn.push(r)
    else safe.push(r)
  }

  // Default-collapse the safe group when it has more than 4 rows; otherwise expand.
  const [safeOpen, setSafeOpen] = useState(safe.length <= 4)
  const [noExpiryOpen, setNoExpiryOpen] = useState(noExpiry.length <= 4)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Urgent — always shown */}
      {urgent.length > 0 &&
        urgent.map((r) => (
          <RenewalRow
            key={r.node.uuid}
            row={r}
            monthly={monthlyOf(r)}
            fmtRow={fmtRow}
          />
        ))}

      {/* Warn group — header + always expanded (usually short) */}
      {warn.length > 0 && (
        <>
          <SectionHeader
            label="临近 · ≤90 days"
            count={warn.length}
            tone="warn"
            open
            onToggle={() => {}}
          />
          {warn.map((r) => (
            <RenewalRow
              key={r.node.uuid}
              row={r}
              monthly={monthlyOf(r)}
              fmtRow={fmtRow}
            />
          ))}
        </>
      )}

      {/* Safe group — collapsible */}
      {safe.length > 0 && (
        <>
          <SectionHeader
            label="安全 · >90 days"
            count={safe.length}
            tone="good"
            open={safeOpen}
            onToggle={() => setSafeOpen((v) => !v)}
          />
          {safeOpen &&
            safe.map((r) => (
              <RenewalRow
                key={r.node.uuid}
                row={r}
                monthly={monthlyOf(r)}
                fmtRow={fmtRow}
              />
            ))}
        </>
      )}

      {/* No-expiry group — collapsible */}
      {noExpiry.length > 0 && (
        <>
          <SectionHeader
            label="无到期信息"
            count={noExpiry.length}
            tone="good"
            open={noExpiryOpen}
            onToggle={() => setNoExpiryOpen((v) => !v)}
          />
          {noExpiryOpen &&
            noExpiry.map((r) => (
              <RenewalRow
                key={r.node.uuid}
                row={r}
                monthly={monthlyOf(r)}
                fmtRow={fmtRow}
              />
            ))}
        </>
      )}

      {/* Month ruler — always at the bottom */}
      <div
        style={{
          marginTop: 4,
          paddingTop: 8,
          borderTop: '1px solid var(--edge-engrave)',
          display: 'grid',
          gridTemplateColumns: 'repeat(13, 1fr)',
          fontSize: contentFs(9),
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
  )
}
