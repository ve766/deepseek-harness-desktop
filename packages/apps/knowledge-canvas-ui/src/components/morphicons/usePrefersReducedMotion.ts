import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function query(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(QUERY)
}

/**
 * Tracks the OS-level "reduce motion" setting.
 *
 * When true, morphicons skip path interpolation and CSS kills every looping
 * animation — state is still expressed by shape + colour, never by motion.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => query()?.matches ?? false)

  useEffect(() => {
    const mq = query()
    if (!mq) return
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    // Safari < 14 only has the deprecated listener API.
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    return
  }, [])

  return reduced
}
