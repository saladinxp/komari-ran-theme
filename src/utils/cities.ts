/**
 * City-level coordinate refinement for map plotting.
 *
 * Komari's `region` field is country-level (an emoji flag), so without further
 * help all CN nodes pile on top of each other near Beijing. Many user node
 * names contain a city name in Chinese ("深圳无忧佛山", "香港HKT KAZE"), so
 * we scan for those and snap the marker to the city if found, falling back
 * to the country centroid otherwise.
 *
 * The table is biased toward common probe-host locations — adding more is
 * cheap and harmless. We match by substring against `node.name`, so a name
 * like "深港V5 IX" matches "深港" before "深圳" because of insertion order;
 * keep the more specific entries higher up.
 */

import type { KomariNode } from '@/types/komari'
import { regionToLonLat } from './region'

/**
 * City name (zh / en) → [longitude, latitude].
 * Order matters: more-specific (or more-common-as-substring) entries first.
 */
const CITIES: Array<[string, [number, number]]> = [
  // 中国大陆 — 一线 + 常见 IDC 城市
  ['深港', [114.1, 22.6]], // 深圳/香港组合(部分服务商把跨境节点叫深港)
  ['深圳', [114.06, 22.55]],
  ['广州', [113.26, 23.13]],
  ['上海', [121.47, 31.23]],
  ['北京', [116.4, 39.9]],
  ['杭州', [120.16, 30.27]],
  ['南京', [118.78, 32.04]],
  ['成都', [104.07, 30.67]],
  ['重庆', [106.55, 29.56]],
  ['武汉', [114.31, 30.6]],
  ['西安', [108.94, 34.34]],
  ['天津', [117.2, 39.13]],
  ['苏州', [120.62, 31.32]],
  ['无忧', [113.1, 23.13]], // "无忧佛山" → 佛山
  ['佛山', [113.1, 23.02]],
  ['东莞', [113.75, 23.04]],
  ['青岛', [120.38, 36.07]],
  ['厦门', [118.08, 24.48]],
  ['昆明', [102.83, 24.88]],
  ['沈阳', [123.43, 41.81]],
  ['哈尔滨', [126.64, 45.75]],
  ['长沙', [112.94, 28.23]],
  ['郑州', [113.62, 34.75]],

  // 港澳台
  ['香港', [114.17, 22.32]],
  ['澳门', [113.55, 22.2]],
  ['台北', [121.5, 25.05]],
  ['高雄', [120.31, 22.62]],
  ['新竹', [120.97, 24.81]],

  // 日本
  ['东京', [139.69, 35.69]],
  ['大阪', [135.5, 34.69]],
  ['京都', [135.77, 35.01]],
  ['名古屋', [136.91, 35.18]],
  ['福冈', [130.4, 33.59]],
  ['札幌', [141.35, 43.07]],
  ['横滨', [139.64, 35.44]],

  // 韩国
  ['首尔', [126.98, 37.57]],
  ['釜山', [129.08, 35.18]],

  // 东南亚
  ['新加坡', [103.85, 1.35]],
  ['吉隆坡', [101.69, 3.14]],
  ['曼谷', [100.5, 13.75]],
  ['雅加达', [106.85, -6.2]],
  ['马尼拉', [120.98, 14.6]],
  ['河内', [105.85, 21.03]],
  ['胡志明', [106.66, 10.76]],

  // 北美
  ['洛杉矶', [-118.24, 34.05]],
  ['旧金山', [-122.42, 37.77]],
  ['硅谷', [-122.04, 37.37]],
  ['圣何塞', [-121.89, 37.34]],
  ['西雅图', [-122.33, 47.6]],
  ['纽约', [-74.0, 40.71]],
  ['芝加哥', [-87.63, 41.88]],
  ['达拉斯', [-96.8, 32.78]],
  ['迈阿密', [-80.19, 25.76]],
  ['亚特兰大', [-84.39, 33.75]],
  ['多伦多', [-79.38, 43.65]],
  ['温哥华', [-123.12, 49.28]],
  ['蒙特利尔', [-73.57, 45.5]],

  // 欧洲
  ['伦敦', [-0.13, 51.51]],
  ['法兰克福', [8.68, 50.11]],
  ['柏林', [13.4, 52.52]],
  ['慕尼黑', [11.58, 48.14]],
  ['阿姆斯特丹', [4.9, 52.37]],
  ['巴黎', [2.35, 48.86]],
  ['马德里', [-3.7, 40.42]],
  ['罗马', [12.49, 41.9]],
  ['米兰', [9.19, 45.46]],
  ['苏黎世', [8.55, 47.38]],
  ['维也纳', [16.37, 48.21]],
  ['莫斯科', [37.62, 55.75]],
  ['圣彼得堡', [30.31, 59.94]],
  ['赫尔辛基', [24.94, 60.17]],
  ['斯德哥尔摩', [18.07, 59.33]],
  ['华沙', [21.01, 52.23]],

  // 大洋洲
  ['悉尼', [151.21, -33.87]],
  ['墨尔本', [144.96, -37.81]],
  ['奥克兰', [174.76, -36.85]],

  // 中东
  ['迪拜', [55.27, 25.2]],
  ['阿布扎比', [54.37, 24.45]],
  ['特拉维夫', [34.78, 32.07]],

  // 印度
  ['孟买', [72.83, 19.08]],
  ['班加罗尔', [77.59, 12.97]],
  ['德里', [77.21, 28.61]],

  // 非洲
  ['约翰内斯堡', [28.05, -26.2]],
  ['开罗', [31.24, 30.04]],

  // 南美
  ['圣保罗', [-46.63, -23.55]],
  ['布宜诺斯艾利斯', [-58.38, -34.6]],
  ['圣地亚哥', [-70.65, -33.45]],
]

/**
 * Resolve a node to a [lon, lat] coordinate.
 *
 *   1. If the name contains a known city substring, snap to that city.
 *   2. Otherwise fall back to the country centroid via `regionToLonLat`.
 *   3. If both fail, return undefined (caller should drop from map).
 */
export function nodeToLonLat(node: KomariNode): [number, number] | undefined {
  const name = node.name ?? ''
  if (name) {
    for (const [city, lonLat] of CITIES) {
      if (name.includes(city)) return lonLat
    }
  }
  return regionToLonLat(node.region)
}

/** Same as nodeToLonLat but tells you which city/country was matched. */
export function nodeToCityLabel(node: KomariNode): string | undefined {
  const name = node.name ?? ''
  if (name) {
    for (const [city] of CITIES) {
      if (name.includes(city)) return city
    }
  }
  return undefined
}
