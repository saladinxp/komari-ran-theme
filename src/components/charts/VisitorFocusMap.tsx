import { useMemo } from 'react'
import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import type { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson'
import topo from 'world-atlas/countries-110m.json'

const COUNTRIES = feature(
  topo as unknown as Topology,
  (topo as unknown as Topology).objects.countries,
) as FeatureCollection<Geometry, GeoJsonProperties>

const GRATICULE = geoGraticule10()

interface Props {
  /** 访客纬度 */
  lat: number
  /** 访客经度 */
  lon: number
  /** SVG 内部尺寸,默认 1000×500(natural-earth aspect) */
  width?: number
  height?: number
}

/**
 * VisitorFocusMap — 访客卡专用迷你地图。
 *
 * 跟 WorldMapPro 不同:不画节点、不交互、不缩放、不监听数据。
 * 只是一张静态世界图 + 一个超大发光焦点(visitor 位置)。
 *
 * 使用场景:被 VisitorAlert iframe 嵌入,通过 ./map.html?embed=visitor&lat=&lon=
 * 触发 MapApp 短路渲染到这个组件。
 */
export function VisitorFocusMap({ lat, lon, width = 1000, height = 500 }: Props) {
  const projection = useMemo(
    () => geoNaturalEarth1().fitSize([width, height], { type: 'Sphere' }),
    [width, height],
  )
  const path = useMemo(() => geoPath(projection), [projection])

  // 投影焦点坐标
  const focus = useMemo(() => {
    const p = projection([lon, lat])
    return p ? { x: p[0], y: p[1] } : null
  }, [projection, lat, lon])

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        display: 'block',
        width: '100%',
        height: 'auto',
        background: 'var(--bg-1)',
      }}
    >
      <defs>
        {/* 焦点 glow 渐变 — 中心强、外圈散 */}
        <radialGradient id="visitorGlow">
          <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity="0.55" />
          <stop offset="40%" stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 海洋底色 */}
      <rect width={width} height={height} fill="var(--bg-1)" />

      {/* 经纬网格 — 稀疏装饰 */}
      <path
        d={path(GRATICULE) ?? undefined}
        fill="none"
        stroke="var(--edge-engrave)"
        strokeWidth={0.6}
        opacity={0.5}
      />

      {/* 国家轮廓 */}
      {COUNTRIES.features.map((c, i) => (
        <path
          key={i}
          d={path(c) ?? undefined}
          fill="var(--bg-3)"
          stroke="var(--edge-mid)"
          strokeWidth={0.7}
        />
      ))}

      {/* === 访客焦点 === */}
      {focus && (
        <g>
          {/* 大范围 glow 光晕 — 320×123px 卡内尺寸下需要更宽的视觉权重 */}
          <circle
            cx={focus.x}
            cy={focus.y}
            r={90}
            fill="url(#visitorGlow)"
          />

          {/* 脉冲外环 — SMIL,持续呼吸 */}
          <circle
            cx={focus.x}
            cy={focus.y}
            r={20}
            fill="none"
            stroke="var(--accent-bright)"
            strokeWidth={2}
            opacity={0.7}
          >
            <animate
              attributeName="r"
              values="20;72"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.85;0"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>

          {/* 第二条脉冲(错相位 1s,形成连续感) */}
          <circle
            cx={focus.x}
            cy={focus.y}
            r={20}
            fill="none"
            stroke="var(--accent-bright)"
            strokeWidth={2}
            opacity={0.7}
          >
            <animate
              attributeName="r"
              values="20;72"
              dur="2s"
              begin="1s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.85;0"
              dur="2s"
              begin="1s"
              repeatCount="indefinite"
            />
          </circle>

          {/* 十字线辅助 — 全屏延伸,虚线低不透明度 */}
          <line
            x1={0}
            x2={width}
            y1={focus.y}
            y2={focus.y}
            stroke="var(--accent)"
            strokeWidth={1}
            strokeDasharray="3 5"
            opacity={0.45}
          />
          <line
            x1={focus.x}
            x2={focus.x}
            y1={0}
            y2={height}
            stroke="var(--accent)"
            strokeWidth={1}
            strokeDasharray="3 5"
            opacity={0.45}
          />

          {/* 中心实心圆 + 白点 */}
          <circle cx={focus.x} cy={focus.y} r={14} fill="var(--accent-bright)" />
          <circle cx={focus.x} cy={focus.y} r={4} fill="white" />
        </g>
      )}
    </svg>
  )
}
