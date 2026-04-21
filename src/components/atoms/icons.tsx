/**
 * Inline SVG icons. Stroke uses `currentColor` so they inherit text color.
 */

import type { ReactNode } from 'react'

export const Icon: Record<string, ReactNode> = {
  cpu: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="3" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1" />
      <rect x="5" y="5" width="4" height="4" fill="currentColor" opacity="0.4" />
      <path d="M5 1V3 M9 1V3 M5 11V13 M9 11V13 M1 5H3 M1 9H3 M11 5H13 M11 9H13" stroke="currentColor" strokeWidth="1" />
    </svg>
  ),
  mem: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="4" width="10" height="6" stroke="currentColor" strokeWidth="1" />
      <path d="M4 4V10 M6 4V10 M8 4V10 M10 4V10" stroke="currentColor" strokeWidth="0.7" opacity="0.6" />
      <path d="M3 11V13 M11 11V13" stroke="currentColor" strokeWidth="1" />
    </svg>
  ),
  disk: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <ellipse cx="7" cy="4" rx="5" ry="2" stroke="currentColor" strokeWidth="1" />
      <path d="M2 4V10 C2 11.1 4.24 12 7 12 C9.76 12 12 11.1 12 10V4" stroke="currentColor" strokeWidth="1" />
      <ellipse cx="7" cy="7" rx="5" ry="2" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  ),
  net: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 7 L4 5 L7 8 L10 4 L13 7" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <circle cx="4" cy="5" r="1" fill="currentColor" />
      <circle cx="7" cy="8" r="1" fill="currentColor" />
      <circle cx="10" cy="4" r="1" fill="currentColor" />
    </svg>
  ),
  ping: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="1.5" fill="currentColor" />
      <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
    </svg>
  ),
  server: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="2" width="10" height="4" stroke="currentColor" strokeWidth="1" />
      <rect x="2" y="8" width="10" height="4" stroke="currentColor" strokeWidth="1" />
      <circle cx="4" cy="4" r="0.5" fill="currentColor" />
      <circle cx="4" cy="10" r="0.5" fill="currentColor" />
      <path d="M6 4H10 M6 10H10" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
    </svg>
  ),
  globe: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1" />
      <ellipse cx="7" cy="7" rx="2.5" ry="5.5" stroke="currentColor" strokeWidth="0.8" />
      <path d="M1.5 7H12.5" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  ),
  alert: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2 L13 12 L1 12 Z" stroke="currentColor" strokeWidth="1" />
      <path d="M7 6V8.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7" cy="10.5" r="0.5" fill="currentColor" />
    </svg>
  ),
  search: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 9L12.5 12.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  settings: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1" />
      <path d="M7 1V3 M7 11V13 M1 7H3 M11 7H13 M2.8 2.8L4.2 4.2 M9.8 9.8L11.2 11.2 M2.8 11.2L4.2 9.8 M9.8 4.2L11.2 2.8" stroke="currentColor" strokeWidth="1" />
    </svg>
  ),
  refresh: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 7 A5 5 0 0 1 11 4 M12 7 A5 5 0 0 1 3 10" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M9 1V4H12 M5 13V10H2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  billing: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1" />
      <path d="M9 5C8.5 4.2 7.8 3.8 7 3.8C5.9 3.8 5 4.4 5 5.3C5 6.2 5.9 6.6 7 6.8C8.1 7 9 7.4 9 8.3C9 9.2 8.1 9.8 7 9.8C6.2 9.8 5.5 9.4 5 8.6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M7 2.8V3.8 M7 9.8V10.8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  ),
}
