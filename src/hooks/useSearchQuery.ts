import { useCallback, useEffect, useState } from 'react'
import type { KomariNode } from '@/types/komari'

const STORAGE_KEY = 'ran:search'
const EVENT_NAME = 'ran:search-changed'

/**
 * useSearchQuery — global cross-page search term, persisted in sessionStorage.
 *
 * Why sessionStorage instead of URL hash:
 *   The hash route ('#/overview', '#/nodes/:uuid') is already taken by the
 *   router. Shoehorning '?search=' into the hash either breaks the parser or
 *   introduces a second source of truth. sessionStorage is a clean fit:
 *   the term survives tab navigation (Overview → NodeDetail → back) but
 *   resets when the user opens a fresh tab, which matches the way people
 *   actually use ad-hoc filters.
 *
 * All Topbar instances + Overview + Nodes consume this hook; a custom
 * `ran:search-changed` event fans out the change to every subscriber in the
 * same tab (sessionStorage's native 'storage' event only fires on *other*
 * tabs / iframes, not the writer itself, so we synthesise our own).
 */
export function useSearchQuery(): [string, (next: string) => void] {
  const [query, setQuery] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    try {
      return window.sessionStorage.getItem(STORAGE_KEY) ?? ''
    } catch {
      return ''
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<string>
      setQuery(ce.detail ?? '')
    }
    // Cross-frame fanout (e.g. parent ↔ iframe map embeds — currently unused
    // for search but cheap insurance if we ever embed a node picker).
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setQuery(e.newValue ?? '')
    }
    window.addEventListener(EVENT_NAME, onChange as EventListener)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(EVENT_NAME, onChange as EventListener)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const set = useCallback((next: string) => {
    if (typeof window === 'undefined') return
    try {
      if (next) window.sessionStorage.setItem(STORAGE_KEY, next)
      else window.sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* private mode or quota — fall through, in-memory state still updates */
    }
    setQuery(next)
    window.dispatchEvent(new CustomEvent<string>(EVENT_NAME, { detail: next }))
  }, [])

  return [query, set]
}

/**
 * Match a node against a search term. Case-insensitive substring match across
 * the user-meaningful identification fields. Empty / whitespace term → match
 * everything (caller should short-circuit before calling).
 *
 * Fields searched (in declared order, but all are checked — order is just for
 * documentation): name, region, ip, group, tags, os, provider, uuid prefix.
 * uuid is included only as a prefix match (first 8 chars) so paste-the-id
 * works but doesn't make every node match every other node via shared
 * substring noise.
 */
export function nodeMatchesQuery(node: KomariNode, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return true

  const haystacks = [
    node.name,
    node.region,
    node.ip,
    node.group,
    node.tags,
    node.os,
    node.provider,
  ]
  for (const h of haystacks) {
    if (h && h.toLowerCase().includes(q)) return true
  }
  // uuid prefix only — full uuid would always include the query as a substring
  // for very short queries and pollute results.
  if (node.uuid && node.uuid.slice(0, 8).toLowerCase().includes(q)) return true

  return false
}
