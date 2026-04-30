/**
 * Metrics display 工具 — 配合 Komari `theme_settings.metrics_display`。
 *
 * 取值:
 * - `auto`(默认)— 桌面 RadialGauge,移动端数字卡(v1.0.2 起的行为)
 * - `gauge`     — 任何屏幕都用 RadialGauge(桌面端默认形态)
 * - `numeric`   — 任何屏幕都用大数字卡(对偏好极简数字、不喜欢圆环装饰的用户)
 *
 * 影响位置:NodeDetail 顶部 Live metrics 区(CPU / MEMORY / DISK / NETWORK / LOAD AVG)
 */

export type MetricsDisplay = 'auto' | 'gauge' | 'numeric'

/**
 * 解析 theme_settings.metrics_display,容错未知值默认 'auto'。
 */
export function parseMetricsDisplay(v: unknown): MetricsDisplay {
  if (v === 'gauge' || v === 'numeric') return v
  return 'auto'
}

/**
 * 给定模式 + 是否移动端,决定实际渲染哪种形态。
 */
export function resolveMetricsForm(
  mode: MetricsDisplay,
  isMobile: boolean,
): 'gauge' | 'numeric' {
  if (mode === 'gauge') return 'gauge'
  if (mode === 'numeric') return 'numeric'
  // auto: 桌面 gauge / 移动 numeric
  return isMobile ? 'numeric' : 'gauge'
}
