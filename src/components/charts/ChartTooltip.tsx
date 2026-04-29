import { useRef, useState, useCallback, useEffect } from 'react'
import { contentFs } from '@/utils/fontScale'

export interface TooltipPoint {
  /** SVG-coordinate x of the closest point */
  cx: number
  /** SVG-coordinate y of the closest point */
  cy: number
  /** Text content rendered as the value line(s). Pass HTML-safe text. */
  valueText: string
  /** Optional secondary line — typically the time. */
  subText?: string
  /** Color for the value line and the dot. */
  color: string
}

interface UseChartTooltipOpts {
  /** SVG width in CSS pixels — must match the rendered <svg> width. */
  width: number
  height: number
  /** Inner-chart left edge (= pad.left). */
  innerLeft: number
  /** Inner-chart right edge (= pad.left + innerW). */
  innerRight: number
  /** Inner-chart top edge (= pad.top). */
  innerTop: number
  /** Inner-chart bottom edge (= pad.top + innerH). */
  innerBottom: number
  /**
   * Resolve the closest point given the mouse position in SVG coordinates.
   * Return null to hide the tooltip (e.g. no data).
   */
  resolve: (svgX: number, svgY: number) => TooltipPoint | null
}

interface UseChartTooltipReturn {
  hover: TooltipPoint | null
  /** Spread on the wrapper <div> to receive mouse events. */
  bind: {
    onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void
    onMouseLeave: () => void
  }
  wrapRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Shared chart-hover hook — picks the closest data point given a mouse
 * position, returns the tooltip state.
 *
 * Wrapper element MUST have position: relative and contain the SVG at the
 * top-left so SVG/CSS coordinates align (which is how all our charts already
 * render). Tooltip overlay is rendered by <ChartTooltip /> below.
 */
export function useChartTooltip({
  width,
  height,
  innerLeft,
  innerRight,
  innerTop,
  innerBottom,
  resolve,
}: UseChartTooltipOpts): UseChartTooltipReturn {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [hover, setHover] = useState<TooltipPoint | null>(null)

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const wrap = wrapRef.current
      if (!wrap) return
      const r = wrap.getBoundingClientRect()
      // CSS pixels relative to wrapper.
      const cssX = e.clientX - r.left
      const cssY = e.clientY - r.top
      // Map to SVG coords (svg width may differ from CSS width when wrapper
      // grows; our charts set svg width == measured width so ratio is ~1, but
      // we still divide to be safe).
      const svgX = (cssX / r.width) * width
      const svgY = (cssY / r.height) * height
      // Bail if outside chart inner area
      if (svgX < innerLeft - 4 || svgX > innerRight + 4) {
        if (hover) setHover(null)
        return
      }
      if (svgY < innerTop - 8 || svgY > innerBottom + 8) {
        if (hover) setHover(null)
        return
      }
      const next = resolve(svgX, svgY)
      setHover(next)
    },
    [width, height, innerLeft, innerRight, innerTop, innerBottom, resolve, hover],
  )

  const onMouseLeave = useCallback(() => setHover(null), [])

  // Defensive: clear hover if dimensions change drastically
  useEffect(() => {
    setHover(null)
  }, [width, height])

  return { hover, bind: { onMouseMove, onMouseLeave }, wrapRef }
}

interface ChartTooltipOverlayProps {
  hover: TooltipPoint | null
  /** SVG width in CSS pixels (same as <svg width=...>) */
  width: number
  height: number
}

/**
 * Visual overlay — renders the dashed crosshair line, hover dot, and
 * value/time chip. Must be a sibling of the <svg> inside a position:relative
 * wrapper. The hook gives you the wrapRef to use; this component reads
 * the resolved hover state and renders absolute-positioned divs.
 *
 * SVG coords are assumed to map 1:1 to wrapper CSS pixels because all our
 * charts size the svg to match the measured wrap width via ResizeObserver.
 */
export function ChartTooltipOverlay({ hover, width, height }: ChartTooltipOverlayProps) {
  if (!hover) return null
  // Tooltip chip placement: prefer right-of-dot, flip if it would clip.
  const chipApproxW = Math.max(80, Math.min(180, hover.valueText.length * 8 + 24))
  const tipRight = hover.cx + 12 + chipApproxW > width
  const tipX = tipRight ? hover.cx - 12 - chipApproxW : hover.cx + 12
  const tipY = Math.max(6, Math.min(height - 50, hover.cy - 24))
  return (
    <>
      {/* dashed vertical crosshair */}
      <div
        style={{
          position: 'absolute',
          left: hover.cx,
          top: 0,
          width: 1,
          height: '100%',
          borderLeft: '1px dashed var(--edge-engrave)',
          opacity: 0.7,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
      {/* hover dot */}
      <div
        style={{
          position: 'absolute',
          left: hover.cx,
          top: hover.cy,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: hover.color,
          boxShadow: `0 0 6px ${hover.color}`,
          transform: 'translate(-50%,-50%)',
          pointerEvents: 'none',
          zIndex: 6,
        }}
      />
      {/* tip chip */}
      <div
        style={{
          position: 'absolute',
          left: tipX,
          top: tipY,
          padding: '5px 9px',
          background: 'var(--bg-1)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 3,
          fontSize: contentFs(11),
          lineHeight: 1.4,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 7,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ color: hover.color, fontWeight: 600 }}>{hover.valueText}</div>
        {hover.subText && (
          <div style={{ color: 'var(--fg-3)', fontSize: contentFs(9), letterSpacing: '0.08em' }}>
            {hover.subText}
          </div>
        )}
      </div>
    </>
  )
}

/** Format a unix-ms timestamp to "MM/DD HH:MM" — matches NanoMuse style. */
export function formatTipTime(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
