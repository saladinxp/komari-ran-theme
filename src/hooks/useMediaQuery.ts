import { useCallback, useEffect, useState } from 'react'

/**
 * useMediaQuery — subscribe to a CSS media query, returns its current match state.
 *
 * Used everywhere we need to branch React layout on viewport size (mobile drawer
 * sidebar, HeroStats column count, Hub column count, etc.). Single source of
 * truth: the breakpoint CSS variables in `tokens.css` are the design contract;
 * this hook is just the runtime probe.
 *
 * Returns `false` on the server / pre-mount so SSR-style code can default to
 * desktop layout, then upgrades on first effect tick.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    setMatches(mql.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    // Modern browsers (and our targets) all support addEventListener on MQL.
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

/**
 * Project-wide breakpoint helpers. Keep these aligned with the `--bp-*`
 * variables in `tokens.css` — designers should be able to read either source
 * and get the same numbers.
 */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)')
export const useIsNarrow = () => useMediaQuery('(max-width: 479px)')
export const useIsTablet = () => useMediaQuery('(max-width: 1023px)')

/**
 * useMobileDrawer — minimal state + handlers for the sidebar mobile drawer.
 * Pages call this and spread the result onto Sidebar/Topbar to get the
 * hamburger ↔ drawer wiring with two extra lines.
 */
export function useMobileDrawer() {
  const [open, setOpen] = useState(false)
  const onOpen = useCallback(() => setOpen(true), [])
  const onClose = useCallback(() => setOpen(false), [])
  return { open, onOpen, onClose }
}
