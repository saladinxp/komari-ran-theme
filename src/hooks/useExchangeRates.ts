/**
 * useExchangeRates — fetch live USD-base rates from open.er-api.com on mount.
 *
 * Strategy mirrors NanoMuse: 5s AbortController timeout, hardcoded fallback
 * if the request fails. Rates are { CODE: rate-per-1-USD } so convert()
 * helpers can do straightforward division/multiplication.
 *
 * One fetch per page-mount; not refetched on theme/route change.
 */
import { useEffect, useState } from 'react'

/** Reasonable fallback rates (rough, for offline / failed-fetch cases). */
export const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  CNY: 7.25,
  EUR: 0.92,
  GBP: 0.79,
  AUD: 1.55,
  CAD: 1.36,
  HKD: 7.82,
  TWD: 32.5,
  SGD: 1.34,
  KRW: 1380,
  INR: 83.4,
  BRL: 5.05,
}

export interface ExchangeRatesState {
  rates: Record<string, number>
  loaded: boolean
  /** Error from the network attempt; null on success or no attempt yet */
  error: string | null
  /** True if the rates are the hardcoded fallback (live fetch failed/timed out) */
  fallback: boolean
}

export function useExchangeRates(): ExchangeRatesState {
  const [state, setState] = useState<ExchangeRatesState>({
    rates: FALLBACK_RATES,
    loaded: false,
    error: null,
    fallback: true,
  })

  useEffect(() => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)

    fetch('https://open.er-api.com/v6/latest/USD', { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data: { result?: string; rates?: Record<string, number> }) => {
        clearTimeout(timer)
        if (data.result === 'success' && data.rates && data.rates.USD) {
          setState({ rates: data.rates, loaded: true, error: null, fallback: false })
        } else {
          setState({
            rates: FALLBACK_RATES,
            loaded: true,
            error: 'malformed',
            fallback: true,
          })
        }
      })
      .catch((e) => {
        clearTimeout(timer)
        setState({
          rates: FALLBACK_RATES,
          loaded: true,
          error: e?.name === 'AbortError' ? 'timeout' : 'network',
          fallback: true,
        })
      })

    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [])

  return state
}
