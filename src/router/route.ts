import { useEffect, useState } from 'react'

export type Route =
  | { name: 'overview' }
  | { name: 'nodes'; uuid?: string }
  | { name: 'ping' }
  | { name: 'traffic' }
  | { name: 'map' }
  | { name: 'alerts' }
  | { name: 'billing' }
  | { name: 'settings' }
  | { name: '404'; raw: string }

/** Parse the hash portion of the URL into a Route. Defaults to overview. */
export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '').trim()
  if (!clean) return { name: 'overview' }

  const parts = clean.split('/').filter(Boolean)
  const head = parts[0]

  switch (head) {
    case 'overview':
      return { name: 'overview' }
    case 'nodes':
      return { name: 'nodes', uuid: parts[1] }
    case 'ping':
      return { name: 'ping' }
    case 'traffic':
      return { name: 'traffic' }
    case 'map':
    case 'geo':
      return { name: 'map' }
    case 'alerts':
      return { name: 'alerts' }
    case 'billing':
      return { name: 'billing' }
    case 'settings':
      return { name: 'settings' }
    default:
      return { name: '404', raw: clean }
  }
}

/** Build a hash URL string for a route. */
export function hashFor(route: Route): string {
  switch (route.name) {
    case 'nodes':
      return route.uuid ? `#/nodes/${route.uuid}` : '#/nodes'
    case '404':
      return `#/${route.raw}`
    default:
      return `#/${route.name}`
  }
}

/** Hook returning the current route. Updates on hashchange. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? { name: 'overview' } : parseHash(window.location.hash),
  )

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}

/** Programmatic navigation. */
export function navigate(route: Route): void {
  if (typeof window === 'undefined') return
  const next = hashFor(route)
  if (window.location.hash !== next) {
    window.location.hash = next
  }
}
