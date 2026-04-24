/**
 * Region helpers — Komari stores `region` as an emoji flag (e.g. 🇯🇵). The
 * world map needs lat/lon for plotting and ISO-2 codes for labels. This
 * module provides the conversion + a coordinate table for common countries
 * and a few well-known cities.
 *
 * Coordinates are intentionally country-centric (or major-city for
 * city-states / very small territories). The map is small; sub-degree
 * precision wouldn't be visible anyway.
 */

/**
 * Convert an emoji flag (🇯🇵, 🇨🇳, 🇺🇸 …) into an ISO-3166-1 alpha-2 code.
 *
 * Emoji flags are two regional-indicator codepoints. Each is U+1F1E6..U+1F1FF
 * mapping to A..Z. So 🇯🇵 = U+1F1EF + U+1F1F5 → 'J' + 'P' → 'JP'.
 *
 * Returns undefined for anything that isn't a two-codepoint regional-indicator
 * sequence — including plain ASCII codes (which we then return as-is via the
 * caller's fallback path).
 */
export function flagToISO(flag: string | undefined): string | undefined {
  if (!flag) return undefined
  // The string can include text + flag; pull out a regional-indicator pair if present.
  const codepoints: number[] = []
  for (const ch of flag) {
    const cp = ch.codePointAt(0)
    if (cp == null) continue
    if (cp >= 0x1f1e6 && cp <= 0x1f1ff) codepoints.push(cp)
    if (codepoints.length === 2) break
  }
  if (codepoints.length !== 2) return undefined
  const letter = (cp: number) => String.fromCharCode(cp - 0x1f1e6 + 0x41)
  return letter(codepoints[0]) + letter(codepoints[1])
}

/**
 * Coerce a region value (emoji flag or plain code) to ISO-2.
 *
 * Komari mostly uses flags, but some installs may emit plain codes ('JP'),
 * so we accept both. Also tolerates lowercase.
 */
export function regionToISO(region: string | undefined): string | undefined {
  if (!region) return undefined
  const fromFlag = flagToISO(region)
  if (fromFlag) return fromFlag
  // Strip whitespace/punctuation and look for a 2-letter alpha pair.
  const m = region.trim().match(/^([A-Za-z]{2})/)
  if (m) return m[1].toUpperCase()
  return undefined
}

/**
 * ISO-2 → [longitude, latitude]. Country-centric for most; cities for a few
 * small territories. Equirectangular projection elsewhere in the codebase
 * uses this directly.
 *
 * Curated list — biased toward regions where probes typically run. Missing
 * codes return undefined; the map drops those nodes (they still appear in
 * lists, just not on the map).
 */
const COORDS: Record<string, [number, number]> = {
  // East / Southeast Asia
  CN: [104.0, 35.0],
  HK: [114.17, 22.32],
  TW: [121.0, 23.7],
  JP: [138.0, 36.0],
  KR: [127.5, 37.0],
  KP: [127.5, 40.0],
  MN: [104.0, 46.5],
  SG: [103.85, 1.35],
  MY: [101.9, 4.2],
  ID: [113.9, -0.8],
  TH: [101.0, 15.0],
  VN: [108.0, 16.0],
  PH: [122.0, 13.0],
  KH: [104.9, 12.5],
  LA: [102.5, 19.85],
  MM: [95.95, 21.0],
  IN: [78.0, 22.0],
  PK: [69.0, 30.0],
  BD: [90.0, 23.7],
  LK: [80.7, 7.9],
  NP: [84.0, 28.4],
  // Middle East / Caucasus
  AE: [54.0, 24.0],
  SA: [45.0, 24.0],
  IR: [53.7, 32.4],
  IQ: [44.0, 33.2],
  TR: [35.0, 39.0],
  IL: [34.85, 31.5],
  QA: [51.2, 25.3],
  KW: [47.5, 29.3],
  AM: [44.5, 40.1],
  AZ: [47.6, 40.4],
  GE: [43.4, 42.3],
  // Russia / CIS
  RU: [105.0, 61.5],
  UA: [32.0, 49.0],
  BY: [27.95, 53.7],
  KZ: [66.9, 48.0],
  UZ: [64.6, 41.4],
  // Europe — west
  GB: [-1.5, 53.0],
  IE: [-8.0, 53.4],
  FR: [2.5, 46.5],
  DE: [10.5, 51.0],
  NL: [5.3, 52.1],
  BE: [4.5, 50.5],
  LU: [6.1, 49.6],
  CH: [8.2, 46.8],
  AT: [14.5, 47.5],
  IT: [12.6, 42.8],
  ES: [-3.7, 40.4],
  PT: [-8.0, 39.5],
  // Europe — north / east
  IS: [-19.0, 64.9],
  NO: [10.0, 62.0],
  SE: [16.0, 62.0],
  FI: [26.0, 64.0],
  DK: [10.0, 56.0],
  EE: [25.5, 58.6],
  LV: [25.0, 56.9],
  LT: [23.9, 55.2],
  PL: [19.4, 52.0],
  CZ: [15.5, 49.8],
  SK: [19.7, 48.7],
  HU: [19.5, 47.2],
  RO: [25.0, 45.9],
  BG: [25.5, 42.7],
  GR: [22.0, 39.0],
  RS: [21.0, 44.0],
  HR: [15.4, 45.1],
  SI: [14.5, 46.1],
  BA: [17.7, 43.9],
  MK: [21.7, 41.6],
  AL: [20.1, 41.0],
  ME: [19.4, 42.7],
  XK: [21.0, 42.6],
  // Africa
  EG: [30.0, 27.0],
  MA: [-6.0, 32.0],
  DZ: [3.0, 28.0],
  TN: [9.0, 34.0],
  LY: [17.2, 27.0],
  NG: [8.7, 9.1],
  KE: [37.9, -0.0],
  ZA: [25.0, -29.0],
  ET: [40.5, 9.1],
  GH: [-1.0, 7.9],
  SN: [-14.5, 14.5],
  // Oceania
  AU: [134.0, -25.5],
  NZ: [172.0, -41.0],
  // North America
  US: [-98.5, 39.8],
  CA: [-106.0, 56.0],
  MX: [-102.5, 23.6],
  // Central America / Caribbean
  GT: [-90.2, 15.8],
  CR: [-84.0, 9.9],
  PA: [-80.0, 8.5],
  CU: [-77.8, 21.5],
  DO: [-70.7, 19.0],
  PR: [-66.4, 18.2],
  // South America
  BR: [-51.9, -10.0],
  AR: [-63.6, -38.4],
  CL: [-71.5, -35.7],
  CO: [-74.3, 4.6],
  PE: [-75.0, -9.2],
  VE: [-66.6, 6.4],
  EC: [-78.5, -1.8],
  BO: [-65.0, -16.5],
  UY: [-55.8, -32.5],
  PY: [-58.4, -23.4],
}

/**
 * ISO-2 → [longitude, latitude]. Returns undefined when not in the table —
 * callers can decide whether to drop the node from the map or place it
 * somewhere generic.
 */
export function isoToLonLat(iso: string | undefined): [number, number] | undefined {
  if (!iso) return undefined
  return COORDS[iso.toUpperCase()]
}

/** Convenience: region (emoji flag or plain code) → [lon, lat]. */
export function regionToLonLat(region: string | undefined): [number, number] | undefined {
  return isoToLonLat(regionToISO(region))
}
