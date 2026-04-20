import { useEffect, useRef, useState } from 'react'

/**
 * useElementWidth — observes the rendered width of a target element via
 * ResizeObserver, returns it in CSS pixels.
 *
 * Pass the returned ref to a wrapper element that occupies 100% of the
 * available width. Pre-mount, returns `initial` so the first render has
 * a sensible default for SVG viewBox calculations.
 */
export function useElementWidth<T extends HTMLElement = HTMLDivElement>(
  initial = 400,
): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(initial)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Set initial measurement immediately
    const cw = el.getBoundingClientRect().width
    if (cw > 0) setWidth(cw)

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return [ref, width]
}
