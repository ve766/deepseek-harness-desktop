import { useCallback, useEffect, useRef, useState } from 'react'
import { isTerminal, type MorphState } from './geometry'

/** Minimum time a state stays visible — stops AI flicker from strobing the icon. */
export const MIN_DWELL_MS = 400

/** How long a terminal state holds before falling back to idle. */
export const TERMINAL_DWELL_MS = 1600

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export interface UseMorphStateOptions {
  /** Terminal states auto-return to `idle`. Turn off if the consumer acknowledges them. */
  autoResetTerminal?: boolean
}

export interface UseMorphStateResult {
  /** The committed, currently-rendered state. */
  state: MorphState
  /** Request a transition. Queued if the current state has not met its dwell time. */
  set: (next: MorphState) => void
  reset: () => void
}

/**
 * Morphicon state machine.
 *
 * AI backends change status faster than the eye can follow, so transitions are
 * queued and rate-limited:
 *
 *   - no state renders for less than MIN_DWELL_MS
 *   - rapid requests collapse to the newest one (no backlog stuttering)
 *   - completed / warning / error settle back to idle on their own
 */
export function useMorphState(
  initial: MorphState = 'idle',
  opts?: UseMorphStateOptions,
): UseMorphStateResult {
  const autoReset = opts?.autoResetTerminal !== false
  const [state, setState] = useState<MorphState>(initial)
  const [desired, setDesired] = useState<MorphState>(initial)
  const committedAt = useRef<number>(now())

  // Terminal states settle back to idle unless the consumer opts out.
  useEffect(() => {
    if (!autoReset || !isTerminal(desired)) return
    const id = window.setTimeout(() => setDesired('idle'), TERMINAL_DWELL_MS)
    return () => window.clearTimeout(id)
  }, [desired, autoReset])

  // Commit the desired state once the minimum dwell time has elapsed.
  useEffect(() => {
    if (desired === state) return
    const elapsed = now() - committedAt.current
    const wait = Math.max(0, MIN_DWELL_MS - elapsed)
    const id = window.setTimeout(() => {
      setState(desired)
      committedAt.current = now()
    }, wait)
    return () => window.clearTimeout(id)
  }, [desired, state])

  const set = useCallback((next: MorphState) => setDesired(next), [])
  const reset = useCallback(() => setDesired('idle'), [])

  return { state, set, reset }
}
