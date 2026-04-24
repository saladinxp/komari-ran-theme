import { useMemo, useState } from 'react'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { regionToLonLat } from '@/utils/region'

/**
 * WorldMap — equirectangular world map (viewBox 1000×500) with one dot per
 * node. Projection: x = (lon + 180) / 360 * 1000, y = (90 - lat) / 180 * 500.
 *
 * Designed as a "preview" pass: real coastlines (hand-simplified from
 * natural-earth low-res, ported from the ref design canvas), nodes plotted
 * by emoji-flag → ISO-2 → country-centroid lookup. Nodes whose region
 * doesn't resolve are silently dropped from the map (they still appear in
 * lists). Multiple nodes in the same country pile up at the same point;
 * a slight horizontal jitter makes 2-3 colocated probes legible.
 *
 * Highlights:
 *   - active node (the one whose hub we're viewing) gets the cyan accent
 *     pulse and a larger ring
 *   - online nodes draw with the good-signal color, offline with the bad
 *   - hover/focus shows a small tooltip with name + region + status
 */

const WORLD_PATHS: string[] = [
  // Alaska
  "M58 88 L72 82 L92 78 L115 80 L132 86 L138 96 L128 102 L108 102 L92 105 L82 113 L75 110 L65 102 L60 95 Z",
  // Canada / mainland US (one big landmass with Hudson Bay notch)
  "M138 96 L155 88 L178 82 L205 78 L235 76 L265 78 L292 82 L315 88 L338 96 L348 110 L342 122 L322 124 L305 120 L295 130 L302 140 L298 152 L292 158 L285 152 L278 158 L285 168 L290 180 L295 192 L302 200 L308 192 L312 180 L320 175 L325 188 L322 198 L312 208 L298 218 L285 230 L268 240 L250 248 L228 248 L208 245 L188 240 L172 230 L160 220 L152 208 L148 195 L150 180 L155 165 L158 148 L155 132 L150 118 L145 108 Z",
  // Mexico
  "M205 232 L222 230 L235 240 L242 252 L250 268 L260 282 L255 290 L242 285 L230 275 L218 260 L208 248 Z",
  // Central America strip
  "M250 268 L268 278 L278 290 L285 300 L278 308 L268 302 L258 290 Z",
  // Cuba/Caribbean
  "M268 252 L285 250 L295 256 L290 262 L275 260 Z",
  // Greenland
  "M348 65 L375 60 L398 65 L412 78 L415 95 L408 112 L390 122 L370 122 L355 112 L348 95 L345 80 Z",
  // South America (much more detail)
  "M275 285 L292 280 L308 280 L322 285 L335 295 L345 308 L355 322 L362 338 L368 355 L370 372 L368 388 L362 402 L352 415 L340 425 L325 432 L310 435 L295 432 L282 425 L272 415 L265 402 L260 388 L258 372 L260 355 L262 338 L265 322 L268 308 Z",
  // Iceland
  "M455 92 L470 88 L478 95 L475 102 L462 102 L452 98 Z",
  // Scandinavia (Norway/Sweden/Finland)
  "M520 70 L535 62 L548 60 L562 68 L572 80 L580 95 L578 110 L568 120 L555 122 L542 118 L532 108 L525 95 L520 82 Z",
  // British Isles
  "M468 110 L478 105 L485 112 L482 122 L478 130 L470 132 L463 125 L460 115 Z",
  // Ireland
  "M455 118 L463 115 L465 125 L460 130 L452 128 Z",
  // Continental Europe (mainland)
  "M488 115 L508 110 L528 110 L548 115 L565 122 L580 130 L588 142 L582 152 L568 158 L552 162 L535 165 L518 168 L500 168 L488 162 L478 152 L475 140 L478 128 Z",
  // Iberia
  "M460 152 L478 152 L488 158 L488 172 L482 182 L470 188 L458 188 L450 180 L448 168 L452 158 Z",
  // Italy boot
  "M518 148 L525 145 L530 158 L535 175 L538 188 L532 192 L525 188 L520 175 L518 162 Z",
  // Sardinia/Sicily small
  "M518 175 L525 178 L525 188 L518 188 Z",
  // Balkans
  "M540 145 L555 145 L562 155 L558 168 L548 172 L538 165 Z",
  // Russia / Northern Asia (huge landmass)
  "M580 75 L620 65 L665 60 L715 58 L765 60 L815 65 L860 72 L885 82 L895 95 L890 108 L878 118 L860 124 L838 128 L815 130 L785 130 L755 132 L725 132 L695 132 L665 132 L635 130 L605 128 L585 120 L578 110 L575 95 L578 82 Z",
  // Kamchatka / Russian far east
  "M885 80 L902 76 L910 88 L908 102 L898 108 L890 100 Z",
  // North Africa / Mediterranean coast
  "M462 192 L495 188 L530 188 L562 192 L590 198 L612 208 L620 222 L618 235 L605 245 L585 250 L562 252 L538 250 L515 248 L492 245 L472 238 L458 225 L455 212 L458 200 Z",
  // Sub-Saharan / Central / East Africa
  "M495 250 L518 248 L540 252 L562 258 L582 268 L598 282 L608 300 L612 320 L612 340 L605 358 L595 372 L580 382 L565 388 L548 388 L532 382 L520 370 L512 355 L508 338 L510 320 L508 302 L502 285 L498 268 Z",
  // South Africa / horn
  "M548 388 L568 388 L580 395 L585 408 L580 418 L562 422 L548 418 L538 408 Z",
  // Madagascar
  "M615 348 L625 350 L630 368 L628 385 L620 392 L613 380 L612 362 Z",
  // Arabian Peninsula
  "M598 195 L625 192 L645 200 L655 215 L655 232 L645 248 L628 255 L612 252 L600 240 L595 225 L595 210 Z",
  // Caspian/Iran
  "M620 165 L648 160 L668 168 L672 182 L662 192 L640 192 L622 185 Z",
  // Indian subcontinent (Pakistan/India/Bangladesh)
  "M675 168 L692 165 L708 172 L718 185 L725 200 L725 218 L720 235 L712 252 L700 268 L688 275 L678 270 L670 255 L663 238 L660 222 L660 205 L662 188 L668 175 Z",
  // Sri Lanka
  "M712 255 L720 258 L722 270 L715 275 L710 268 Z",
  // Indochina (Myanmar/Thailand/Vietnam)
  "M725 200 L745 198 L758 208 L765 222 L770 238 L772 255 L765 268 L758 262 L752 248 L742 232 L732 218 L725 208 Z",
  // Malay Peninsula
  "M758 262 L770 265 L778 280 L780 295 L772 302 L765 295 L760 282 L758 270 Z",
  // China / East Asia
  "M725 130 L760 128 L795 130 L825 138 L850 150 L865 168 L862 188 L850 202 L830 210 L805 212 L780 210 L758 200 L740 188 L728 172 L720 155 L720 142 Z",
  // Korean peninsula
  "M858 152 L868 152 L872 168 L868 182 L862 188 L858 178 Z",
  // Japan (Honshu)
  "M880 142 L895 138 L902 150 L900 165 L890 175 L880 168 L878 155 Z",
  // Hokkaido
  "M895 122 L908 122 L912 135 L905 142 L895 138 Z",
  // Kyushu/Shikoku
  "M870 175 L880 175 L882 185 L875 188 L870 182 Z",
  // Taiwan
  "M858 195 L865 195 L867 208 L860 212 L855 205 Z",
  // Philippines
  "M825 215 L838 218 L842 232 L848 248 L842 262 L832 258 L825 245 L820 232 Z",
  // Indonesia (Sumatra)
  "M770 270 L795 268 L815 278 L818 290 L805 295 L788 292 L772 282 Z",
  // Indonesia (Java)
  "M790 298 L815 298 L825 305 L815 312 L795 310 L785 305 Z",
  // Borneo
  "M810 270 L832 268 L842 282 L840 298 L825 302 L812 295 L805 282 Z",
  // Sulawesi
  "M838 282 L848 280 L850 295 L855 308 L848 312 L840 305 L838 292 Z",
  // New Guinea
  "M860 295 L885 295 L905 302 L912 312 L902 318 L880 315 L862 308 Z",
  // Australia (mainland — pentagonal coastline)
  "M810 332 L835 328 L862 328 L888 330 L908 338 L920 352 L922 370 L915 385 L898 395 L878 400 L855 402 L832 400 L815 392 L805 378 L803 362 L805 345 Z",
  // Tasmania
  "M870 408 L880 408 L885 420 L878 425 L870 420 Z",
  // New Zealand North
  "M935 388 L948 386 L952 398 L948 408 L938 410 L932 402 Z",
  // New Zealand South
  "M945 412 L955 412 L962 422 L958 432 L948 432 L942 422 Z",
  // Antarctica strip (more detail)
  "M40 458 L100 455 L160 458 L220 458 L280 460 L340 458 L400 458 L460 460 L520 458 L580 460 L640 458 L700 460 L760 458 L820 460 L880 458 L940 460 L962 466 L962 478 L40 478 Z",
];

interface NodeMarker {
  uuid: string
  name: string
  region: string
  online: boolean
  /** Pixel-space x,y in the 1000×500 viewBox. */
  x: number
  y: number
}

function project(lon: number, lat: number): [number, number] {
  const x = ((lon + 180) / 360) * 1000
  const y = ((90 - lat) / 180) * 500
  return [x, y]
}

interface Props {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  /** UUID of the node we're currently viewing — gets pulse + bigger ring. */
  activeUuid?: string
  /** Render height in CSS pixels. Width adapts to container. */
  height?: number
}

export function WorldMap({ nodes, records, activeUuid, height = 220 }: Props) {
  const [hover, setHover] = useState<NodeMarker | null>(null)

  const markers = useMemo<NodeMarker[]>(() => {
    // Group raw points by (rounded) coordinate so we can spread duplicates
    // horizontally instead of overlapping them invisibly.
    const groups = new Map<string, NodeMarker[]>()
    for (const node of nodes) {
      const lonlat = regionToLonLat(node.region)
      if (!lonlat) continue
      const [lon, lat] = lonlat
      const [x, y] = project(lon, lat)
      const r = records[node.uuid]
      const m: NodeMarker = {
        uuid: node.uuid,
        name: node.name ?? node.uuid.slice(0, 8),
        region: node.region ?? '—',
        online: r?.online === true,
        x,
        y,
      }
      const key = `${Math.round(x)},${Math.round(y)}`
      const arr = groups.get(key) ?? []
      arr.push(m)
      groups.set(key, arr)
    }
    // Spread same-coord nodes along x by ±6 px per extra node.
    const out: NodeMarker[] = []
    for (const arr of groups.values()) {
      const n = arr.length
      arr.forEach((m, i) => {
        const offset = n === 1 ? 0 : (i - (n - 1) / 2) * 6
        out.push({ ...m, x: m.x + offset })
      })
    }
    return out
  }, [nodes, records])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox="0 0 1000 500"
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        <defs>
          <radialGradient id="rm-active-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--accent-bright)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Equator + meridian guides — barely visible, just to give the
            empty oceans some structure. */}
        <line
          x1="0"
          x2="1000"
          y1="250"
          y2="250"
          stroke="color-mix(in oklab, var(--fg-3) 25%, transparent)"
          strokeWidth="0.5"
          strokeDasharray="4 6"
        />
        <line
          x1="500"
          x2="500"
          y1="0"
          y2="500"
          stroke="color-mix(in oklab, var(--fg-3) 25%, transparent)"
          strokeWidth="0.5"
          strokeDasharray="4 6"
        />

        {/* Land masses — fill is a deliberate mix of fg-3 over the card
            background so it stays visibly distinct in both light and
            dark themes. The earlier var(--bg-2) made the map invisible
            in mist (light) mode because bg-1 and bg-2 are nearly the
            same warm cream. */}
        <g
          fill="color-mix(in oklab, var(--fg-3) 18%, transparent)"
          stroke="color-mix(in oklab, var(--fg-3) 45%, transparent)"
          strokeWidth="0.8"
          strokeLinejoin="round"
        >
          {WORLD_PATHS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>

        {/* Markers */}
        <g>
          {markers.map((m) => {
            const isActive = m.uuid === activeUuid
            const fill = !m.online
              ? 'var(--signal-bad)'
              : isActive
                ? 'var(--accent-bright)'
                : 'var(--signal-good)'
            return (
              <g
                key={m.uuid}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover(m)}
                onMouseLeave={() => setHover((cur) => (cur?.uuid === m.uuid ? null : cur))}
              >
                {/* Active glow halo */}
                {isActive && (
                  <circle cx={m.x} cy={m.y} r={18} fill="url(#rm-active-glow)" />
                )}
                {/* Pulse ring (active only) */}
                {isActive && m.online && (
                  <circle
                    cx={m.x}
                    cy={m.y}
                    r={6}
                    fill="none"
                    stroke="var(--accent-bright)"
                    strokeWidth="1"
                    opacity="0.8"
                  >
                    <animate
                      attributeName="r"
                      values="6;14;6"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.8;0;0.8"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                {/* Outer halo for online */}
                {m.online && (
                  <circle
                    cx={m.x}
                    cy={m.y}
                    r={isActive ? 5.5 : 4}
                    fill={fill}
                    opacity="0.25"
                  />
                )}
                {/* Solid dot */}
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={isActive ? 3 : 2.2}
                  fill={fill}
                  stroke="var(--bg-0)"
                  strokeWidth="0.6"
                />
              </g>
            )
          })}
        </g>
      </svg>

      {/* Tooltip — overlay on hover. We use HTML rather than SVG <text>
          so the type rendering matches the rest of the theme. */}
      {hover && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            // Position relative to viewBox-projected coords. The svg is
            // 100% width; convert via percentage.
            left: `${(hover.x / 1000) * 100}%`,
            top: `${(hover.y / 500) * 100}%`,
            transform: 'translate(8px, -50%)',
            background: 'var(--bg-1)',
            border: '1px solid var(--edge-mid)',
            padding: '5px 8px',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--fg-0)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: 'inset 0 1px 0 var(--edge-bright)',
            zIndex: 5,
          }}
        >
          <div style={{ color: 'var(--fg-0)', fontWeight: 600, fontSize: 11 }}>
            {hover.name}
          </div>
          <div style={{ color: 'var(--fg-3)', letterSpacing: '0.06em' }}>
            {hover.region} ·{' '}
            <span style={{ color: hover.online ? 'var(--signal-good)' : 'var(--signal-bad)' }}>
              {hover.online ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      )}

      {/* Bottom strip — quick stats */}
      <div
        style={{
          position: 'absolute',
          left: 6,
          bottom: 4,
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--fg-3)',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          pointerEvents: 'none',
        }}
      >
        {markers.length} / {nodes.length} mapped
      </div>
    </div>
  )
}
