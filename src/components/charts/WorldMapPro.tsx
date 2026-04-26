/**
 * WorldMapPro — 独立 map.html 页面专属的"华丽版"世界地图。
 *
 * 设计原则:
 *   - 数据驱动而非装饰驱动 — 节点位置是主角,装饰服务于数据
 *   - 双主题(ran-night / ran-mist)下都得能看清,所有颜色走 CSS 变量
 *     或 color-mix 派生
 *   - 控制克制 — 装饰元素叠加不超过节点点位的视觉权重
 *
 * 渲染栈:
 *   - geoNaturalEarth1 投影(平衡,极地不夸张变形)
 *   - SVG 单文件:海洋背景 + 经纬网格 + 国家路径 + 节点点位 + 当前节点
 *     脉冲(SMIL animate)+ HUD 装饰
 *   - 平移/缩放:鼠标拖拽 + 滚轮 + 角落 +/- 按钮,纯 SVG transform 实现
 *     (不引入 d3-zoom,体积更可控)
 *
 * 节点坐标:
 *   - 优先 nodeToLonLat 抽 node.name 里的中文城市
 *   - fallback 到 region 国家中心
 *   - 同坐标重叠时按列表 index 做小幅 jitter,避免完全堆叠
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties } from 'geojson'
import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo'
import topo from 'world-atlas/countries-110m.json'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { nodeToLonLat, nodeToCityLabel } from '@/utils/cities'
import { regionToISO } from '@/utils/region'
import { Etch } from '@/components/atoms/Etch'

interface Props {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  /** Optional: highlight one node as ACTIVE PROBE (cyan + sustained pulse). */
  activeUuid?: string
  /** SVG drawing surface size — typical: 1000x500 for natural-earth aspect. */
  width?: number
  height?: number
}

// 解析 topojson 一次,模块作用域缓存(MapApp 重渲染时不重算)
const COUNTRIES = feature(
  topo as unknown as Topology,
  (topo as unknown as Topology).objects.countries,
) as FeatureCollection<Geometry, GeoJsonProperties>

// 经纬网格 — 每 30°
const GRATICULE = geoGraticule10()

interface PlottedNode {
  uuid: string
  name: string
  region?: string
  online: boolean
  city?: string
  lon: number
  lat: number
  /** 投影后的 SVG 坐标 */
  x: number
  y: number
}

export function WorldMapPro({
  nodes,
  records,
  activeUuid,
  width = 1000,
  height = 500,
}: Props) {
  // === 平移 / 缩放状态 ===
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hoverUuid, setHoverUuid] = useState<string | null>(null)
  const [pointerLonLat, setPointerLonLat] = useState<[number, number] | null>(null)
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // === 投影 — 适配 SVG 尺寸 ===
  // 旋转 -150° 让 150°E 经线落在地图中央 → 中国/东亚位于中央,
  // 太平洋两岸(亚洲东部 + 美洲西部)同屏可见。注意 rotate 用负值
  // 是因为 d3-geo 里 rotate 是"把世界往哪个方向反向转"。
  // 副作用:跨 ±180° 经线的国家(俄罗斯远东、美国阿拉斯加、斐济、
  // 新西兰)多边形可能被切割成横穿地图的窄条,但 110m 数据集里
  // 这种情况影响很小,视觉上可接受。
  const projection = useMemo(
    () =>
      geoNaturalEarth1()
        .rotate([-150, 0])
        .fitSize([width, height], COUNTRIES),
    [width, height],
  )
  const pathFn = useMemo(() => geoPath(projection), [projection])

  // === 国家路径 — 一次计算 ===
  const countryPaths = useMemo(() => {
    return COUNTRIES.features
      .map((f, i) => {
        const d = pathFn(f as Feature<Geometry>)
        if (!d) return null
        return { id: f.id ?? i, name: (f.properties?.name as string) ?? '', d }
      })
      .filter((x): x is { id: string | number; name: string; d: string } => x !== null)
  }, [pathFn])

  const graticulePath = useMemo(() => pathFn(GRATICULE) ?? '', [pathFn])

  // === 节点投影 + jitter 避免重叠 ===
  const plotted: PlottedNode[] = useMemo(() => {
    const result: PlottedNode[] = []
    const seen = new Map<string, number>() // 同坐标计数
    for (const n of nodes) {
      const lonLat = nodeToLonLat(n)
      if (!lonLat) continue
      const key = `${lonLat[0].toFixed(2)},${lonLat[1].toFixed(2)}`
      const idx = seen.get(key) ?? 0
      seen.set(key, idx + 1)

      // 同坐标节点做小幅 jitter — 螺旋分布
      const jitterRadius = idx === 0 ? 0 : Math.min(idx * 0.6, 3.0)
      const jitterAngle = idx * 2.4
      const lon = lonLat[0] + Math.cos(jitterAngle) * jitterRadius
      const lat = lonLat[1] + Math.sin(jitterAngle) * jitterRadius

      const xy = projection([lon, lat])
      if (!xy) continue
      const rec = records[n.uuid]
      result.push({
        uuid: n.uuid,
        name: n.name ?? '—',
        region: n.region,
        online: !!rec?.online,
        city: nodeToCityLabel(n),
        lon,
        lat,
        x: xy[0],
        y: xy[1],
      })
    }
    return result
  }, [nodes, records, projection])

  // 当前节点高亮(在线 fallback)
  const active = plotted.find((p) => p.uuid === activeUuid)
  const hovered = plotted.find((p) => p.uuid === hoverUuid)

  // === 缩放限位 ===
  const setZoomClamped = (z: number) => setZoom(Math.max(1, Math.min(8, z)))

  // === 拖拽事件 ===
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = { x: pan.x, y: pan.y, px: e.clientX, py: e.clientY }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    // 始终更新坐标 readout
    if (svgRef.current) {
      const r = svgRef.current.getBoundingClientRect()
      const sx = ((e.clientX - r.left) / r.width) * width
      const sy = ((e.clientY - r.top) / r.height) * height
      // 反推屏幕坐标→世界坐标(考虑当前 transform)
      const wx = (sx - pan.x) / zoom
      const wy = (sy - pan.y) / zoom
      const lonLat = projection.invert?.([wx, wy]) ?? null
      setPointerLonLat(lonLat as [number, number] | null)
    }

    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.px
    const dy = e.clientY - dragRef.current.py
    setPan({ x: dragRef.current.x + dx, y: dragRef.current.y + dy })
  }
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = null
    try {
      ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const next = zoom * delta
    setZoomClamped(next)
  }

  const reset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // === Boot scan-line sweep — 启动时一次性扫描动画 ===
  const [bootDone, setBootDone] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setBootDone(true), 1400)
    return () => clearTimeout(t)
  }, [])

  // === 国家 hover 高亮 ===
  const [hoverCountry, setHoverCountry] = useState<string | null>(null)
  const nodesByCountry = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of nodes) {
      const iso = regionToISO(n.region)
      if (!iso) continue
      m.set(iso, (m.get(iso) ?? 0) + 1)
    }
    return m
  }, [nodes])

  // ISO-2 ↔ topojson numeric id 映射
  // topojson 用 ISO-3166-1 数字编码(M49),需要个映射表
  // 但简化:我们直接用 country properties.name 匹配(英文国名),
  // 跟 nodes 数无直接关系 — hover 时只显示该国 name 即可,具体节点
  // 数走 region(emoji flag)不变。
  void nodesByCountry

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        background: 'var(--bg-1)',
        border: '1px solid var(--edge-mid)',
        boxShadow: 'inset 0 1px 0 var(--edge-bright), inset 0 -1px 0 var(--edge-deep)',
        overflow: 'hidden',
      }}
    >
      {/* 顶部 HUD bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 28,
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to bottom, var(--bg-2), transparent)',
          borderBottom: '1px solid var(--edge-engrave)',
          pointerEvents: 'none',
          zIndex: 2,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--fg-2)',
        }}
      >
        <span>
          <span style={{ color: 'var(--accent-bright)' }}>● </span>
          GEO TRACKING · GLOBAL FLEET
        </span>
        <span style={{ display: 'flex', gap: 16 }}>
          <span>ZOOM · {zoom.toFixed(2)}×</span>
          <span>PROJECTION · NATURAL EARTH</span>
          <span style={{ color: 'var(--accent-bright)' }}>
            NODES · {plotted.length}/{nodes.length}
          </span>
        </span>
      </div>

      {/* 角落 crosshair */}
      <CornerMark pos="tl" />
      <CornerMark pos="tr" />
      <CornerMark pos="bl" />
      <CornerMark pos="br" />

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          setPointerLonLat(null)
          setHoverUuid(null)
          setHoverCountry(null)
        }}
        onWheel={onWheel}
        onDoubleClick={reset}
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          cursor: dragRef.current ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        {/* 渐变定义 */}
        <defs>
          <radialGradient id="oceanBg" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="var(--bg-2)" />
            <stop offset="100%" stopColor="var(--bg-0)" />
          </radialGradient>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--accent-bright)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="onlineGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--signal-good)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--signal-good)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="offlineGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--signal-bad)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--signal-bad)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="scanLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--accent-bright)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--accent-bright)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 海洋底 */}
        <rect width={width} height={height} fill="url(#oceanBg)" />

        {/* 内部缩放 / 平移分组 */}
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* 经纬网格 */}
          <path
            d={graticulePath}
            fill="none"
            stroke="var(--map-graticule)"
            strokeWidth={0.5 / zoom}
            strokeDasharray={`${1 / zoom} ${2 / zoom}`}
          />

          {/* 国家 */}
          <g>
            {countryPaths.map((c) => (
              <path
                key={String(c.id)}
                d={c.d}
                fill={hoverCountry === c.name ? 'var(--map-land-hover)' : 'var(--map-land)'}
                stroke="var(--map-border)"
                strokeWidth={0.7 / zoom}
                onMouseEnter={() => setHoverCountry(c.name)}
                onMouseLeave={() => setHoverCountry(null)}
                style={{ transition: 'fill 0.12s ease' }}
              />
            ))}
          </g>

          {/* 节点离线点位 — 先画(在线在上层) */}
          {plotted
            .filter((p) => !p.online)
            .map((p) => (
              <g key={`off-${p.uuid}`} transform={`translate(${p.x},${p.y})`}>
                <circle r={6 / zoom} fill="url(#offlineGlow)" />
                <circle
                  r={2 / zoom}
                  fill="var(--signal-bad)"
                  stroke="var(--bg-0)"
                  strokeWidth={0.5 / zoom}
                  onMouseEnter={() => setHoverUuid(p.uuid)}
                  onMouseLeave={() => setHoverUuid(null)}
                  style={{ cursor: 'pointer' }}
                />
              </g>
            ))}

          {/* 节点在线点位 */}
          {plotted
            .filter((p) => p.online && p.uuid !== activeUuid)
            .map((p) => (
              <g key={`on-${p.uuid}`} transform={`translate(${p.x},${p.y})`}>
                <circle r={7 / zoom} fill="url(#onlineGlow)" />
                <circle
                  r={2.4 / zoom}
                  fill="var(--signal-good)"
                  stroke="var(--bg-0)"
                  strokeWidth={0.5 / zoom}
                  onMouseEnter={() => setHoverUuid(p.uuid)}
                  onMouseLeave={() => setHoverUuid(null)}
                  style={{ cursor: 'pointer' }}
                />
              </g>
            ))}

          {/* ACTIVE PROBE 当前节点 — 大尺寸 cyan + 持续脉冲 */}
          {active && (
            <g transform={`translate(${active.x},${active.y})`}>
              <circle r={12 / zoom} fill="url(#nodeGlow)" />
              <circle
                r={4 / zoom}
                fill="none"
                stroke="var(--accent-bright)"
                strokeWidth={1 / zoom}
                opacity={0.9}
              >
                <animate
                  attributeName="r"
                  values={`${4 / zoom};${14 / zoom};${4 / zoom}`}
                  dur="2.4s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.9;0;0.9"
                  dur="2.4s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle
                r={3 / zoom}
                fill="var(--accent-bright)"
                stroke="var(--bg-0)"
                strokeWidth={0.6 / zoom}
                onMouseEnter={() => setHoverUuid(active.uuid)}
                onMouseLeave={() => setHoverUuid(null)}
                style={{ cursor: 'pointer' }}
              />
            </g>
          )}
        </g>

        {/* Boot 扫描线 — 一次性 */}
        {!bootDone && (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={0} y={0} width={4} height={height} fill="url(#scanLine)" opacity={0.85}>
              <animate
                attributeName="x"
                from={0}
                to={width - 4}
                dur="1.2s"
                fill="freeze"
              />
            </rect>
          </g>
        )}
      </svg>

      {/* 节点 hover tooltip */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            // 注意:tooltip 用百分比定位,跟 svg viewBox 里的坐标对齐
            left: `${((hovered.x * zoom + pan.x) / width) * 100}%`,
            top: `${((hovered.y * zoom + pan.y) / height) * 100}%`,
            transform: 'translate(12px, -50%)',
            background: 'var(--bg-1)',
            border: '1px solid var(--edge-mid)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 var(--edge-bright)',
            padding: '8px 10px',
            minWidth: 180,
            pointerEvents: 'none',
            zIndex: 3,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 4,
              color: hovered.uuid === activeUuid ? 'var(--accent-bright)' : 'var(--fg-0)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: hovered.online
                  ? 'var(--signal-good)'
                  : 'var(--signal-bad)',
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 600 }}>{hovered.name}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, color: 'var(--fg-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--fg-3)' }}>REGION</span>
              <span>
                {hovered.region ?? '—'} · {regionToISO(hovered.region) ?? '—'}
              </span>
            </div>
            {hovered.city && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: 'var(--fg-3)' }}>CITY</span>
                <span>{hovered.city}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--fg-3)' }}>LAT/LON</span>
              <span>
                {hovered.lat.toFixed(2)}, {hovered.lon.toFixed(2)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--fg-3)' }}>STATUS</span>
              <span
                style={{
                  color: hovered.online ? 'var(--signal-good)' : 'var(--signal-bad)',
                }}
              >
                {hovered.online ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>
          {hovered.uuid === activeUuid && (
            <div
              style={{
                marginTop: 6,
                paddingTop: 6,
                borderTop: '1px solid var(--edge-engrave)',
                fontSize: 9,
                color: 'var(--accent-bright)',
                letterSpacing: '0.18em',
              }}
            >
              ACTIVE PROBE
            </div>
          )}
        </div>
      )}

      {/* 国家 hover 上方提示 */}
      {hoverCountry && !hovered && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            bottom: 36,
            background: 'var(--bg-1)',
            border: '1px solid var(--edge-mid)',
            padding: '4px 10px',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            color: 'var(--fg-1)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          {hoverCountry.toUpperCase()}
        </div>
      )}

      {/* 左下角:鼠标坐标 readout */}
      {pointerLonLat && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            bottom: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            color: 'var(--fg-3)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <Etch>POINTER · LON {pointerLonLat[0].toFixed(2)} · LAT {pointerLonLat[1].toFixed(2)}</Etch>
        </div>
      )}

      {/* 右下角:缩放控件 */}
      <div
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          zIndex: 2,
        }}
      >
        <ZoomBtn label="+" onClick={() => setZoomClamped(zoom * 1.4)} />
        <ZoomBtn label="−" onClick={() => setZoomClamped(zoom / 1.4)} />
        <ZoomBtn label="↺" onClick={reset} title="reset (or double-click map)" />
      </div>
    </div>
  )
}

// ---- 装饰元件 ----

function CornerMark({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const isTop = pos === 'tl' || pos === 'tr'
  const isLeft = pos === 'tl' || pos === 'bl'
  return (
    <div
      style={{
        position: 'absolute',
        [isTop ? 'top' : 'bottom']: 4,
        [isLeft ? 'left' : 'right']: 4,
        width: 14,
        height: 14,
        zIndex: 1,
        pointerEvents: 'none',
      }}
    >
      <svg viewBox="0 0 14 14" width="14" height="14">
        <path
          d={
            pos === 'tl'
              ? 'M 0 6 L 0 0 L 6 0'
              : pos === 'tr'
                ? 'M 8 0 L 14 0 L 14 6'
                : pos === 'bl'
                  ? 'M 0 8 L 0 14 L 6 14'
                  : 'M 8 14 L 14 14 L 14 8'
          }
          stroke="var(--accent-bright)"
          strokeWidth="1.2"
          fill="none"
          opacity="0.7"
        />
      </svg>
    </div>
  )
}

function ZoomBtn({
  label,
  onClick,
  title,
}: {
  label: string
  onClick: () => void
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 30,
        height: 30,
        background: 'var(--bg-2)',
        border: '1px solid var(--edge-mid)',
        boxShadow: 'inset 0 1px 0 var(--edge-bright), inset 0 -1px 0 var(--edge-deep)',
        color: 'var(--fg-1)',
        fontFamily: 'var(--font-mono)',
        fontSize: 14,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
      }}
    >
      {label}
    </button>
  )
}
