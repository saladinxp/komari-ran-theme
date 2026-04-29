/**
 * Font-scale 工具 — 配合 Komari `theme_settings.font_scale` (standard / large / xlarge)。
 *
 * 设计思路:C 路线("内容字号"缩放,不动布局)
 * - CSS 变量 `--font-scale-content` 在 `<html>` 上设置,默认 1
 * - "内容字"(数字、表格文字、节点名)用 contentFs() 包裹,跟着缩放
 * - 装饰字(Etch 角标、Footer 版本号、loading dot 等)保持原值,保护视觉层级
 *
 * 这样字号开关只影响"实际要看清的字",卡片高度/padding/边框等布局尺寸
 * 不变,避免"字大了挤爆布局"的回归。
 */

export type FontScale = 'standard' | 'large' | 'xlarge'

export const FONT_SCALE_VALUES: Record<FontScale, number> = {
  standard: 1,
  large: 1.18,
  xlarge: 1.36,
}

/**
 * 把目标像素值包成 CSS calc() 字符串,运行时按当前
 * `--font-scale-content` 缩放。在 inline style.fontSize 上使用。
 *
 * 例:`<span style={{ fontSize: contentFs(13) }}>` →
 * 标准档 13px,大档 ~15.34px,超大档 ~17.68px。
 */
export function contentFs(px: number): string {
  return `calc(${px}px * var(--font-scale-content, 1))`
}

/**
 * 解析 theme_settings.font_scale,容错未知值。
 */
export function parseFontScale(v: unknown): FontScale {
  if (v === 'large' || v === 'xlarge') return v
  return 'standard'
}

/**
 * 把字号档位写入 documentElement 的 CSS 变量。
 * 在 App / MapApp 顶层 useEffect 调用。
 */
export function applyFontScale(scale: FontScale): void {
  if (typeof document === 'undefined') return
  const value = FONT_SCALE_VALUES[scale] ?? 1
  document.documentElement.style.setProperty('--font-scale-content', String(value))
}
