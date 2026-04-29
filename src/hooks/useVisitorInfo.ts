import { useEffect, useRef, useState } from 'react'

/**
 * VisitorInfo — 通过公共 IP 服务获取访客地理 + 风险信息。
 *
 * 数据链(对应 PRTS 同款,改成 React hook):
 *   ipapi.co  → 主源(IP/城市/国家/坐标/ISP)
 *   ipwho.is  → fallback,主源失败时
 *   proxycheck.io → 风险评分 + VPN/proxy 检测(可选,失败不阻塞)
 *
 * 所有请求带 5s AbortController 超时;proxycheck 4s。
 * 加载失败返回最小可用对象 {ip:'UNKNOWN', risk:0, proxy:'no'}。
 */

export interface VisitorInfo {
  ip: string
  city?: string
  region?: string
  country?: string
  isp?: string
  lat?: number
  lon?: number
  /** proxycheck 返回的 risk 评分 0-100,未获取时 0 */
  risk: number
  /** proxycheck 判定 VPN/proxy: 'yes' | 'no' */
  proxy: 'yes' | 'no'
  /** 链路类型(VPN/Tor/Hosting...);无信息时空串 */
  type?: string
}

interface State {
  data: VisitorInfo | null
  loading: boolean
  error: boolean
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(tid)
  }
}

async function fetchIpInfo(): Promise<Partial<VisitorInfo>> {
  // 主源 ipapi.co
  try {
    const r = await fetchWithTimeout('https://ipapi.co/json/', 5000)
    const j = await r.json()
    if (j && j.ip) {
      return {
        ip: j.ip,
        city: j.city || '',
        region: j.region || '',
        country: j.country_name || '',
        isp: j.org || '',
        lat: typeof j.latitude === 'number' ? j.latitude : undefined,
        lon: typeof j.longitude === 'number' ? j.longitude : undefined,
      }
    }
  } catch {
    /* fall through */
  }

  // Fallback ipwho.is
  try {
    const r = await fetchWithTimeout('https://ipwho.is/', 5000)
    const j = await r.json()
    if (j && j.ip) {
      return {
        ip: j.ip,
        city: j.city || '',
        region: j.region || '',
        country: j.country || '',
        isp: j.connection?.org || j.connection?.isp || '',
        lat: typeof j.latitude === 'number' ? j.latitude : undefined,
        lon: typeof j.longitude === 'number' ? j.longitude : undefined,
      }
    }
  } catch {
    /* give up */
  }

  return { ip: 'UNKNOWN' }
}

async function fetchRisk(ip: string): Promise<{ risk: number; proxy: 'yes' | 'no'; type: string }> {
  try {
    const r = await fetchWithTimeout(`https://proxycheck.io/v2/${ip}?risk=1&vpn=1`, 4000)
    const j = await r.json()
    const info = (j && j[ip]) || {}
    return {
      risk: parseInt(info.risk, 10) || 0,
      proxy: info.proxy === 'yes' ? 'yes' : 'no',
      type: info.type || '',
    }
  } catch {
    return { risk: 0, proxy: 'no', type: '' }
  }
}

/**
 * useVisitorInfo — 执行一次访客信息查询。
 * `enabled=false` 时完全不发请求(用于"会话内已弹过 → 不再获取"的场景)。
 */
export function useVisitorInfo(enabled: boolean): State {
  const [state, setState] = useState<State>({ data: null, loading: enabled, error: false })
  const cancelled = useRef(false)

  useEffect(() => {
    if (!enabled) return
    cancelled.current = false

    ;(async () => {
      const base = await fetchIpInfo()
      if (cancelled.current) return
      const ip = base.ip || 'UNKNOWN'
      const risk =
        ip !== 'UNKNOWN'
          ? await fetchRisk(ip)
          : { risk: 0, proxy: 'no' as const, type: '' }
      if (cancelled.current) return
      setState({
        data: { ...base, ip, ...risk } as VisitorInfo,
        loading: false,
        error: ip === 'UNKNOWN',
      })
    })()

    return () => {
      cancelled.current = true
    }
  }, [enabled])

  return state
}
