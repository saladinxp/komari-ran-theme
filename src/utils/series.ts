/**
 * Deterministic seeded series generator — for mock charts during development.
 * Replace consumers with real WS/REST data when wiring Komari API.
 */

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function genSeries(n: number, seed: number, base = 50, range = 30, dropChance = 0): number[] {
  const rng = mulberry32(seed * 9999)
  return Array.from({ length: n }, () => {
    if (dropChance > 0 && rng() < dropChance) return 0
    return Math.max(0, base + (rng() - 0.5) * range)
  })
}
