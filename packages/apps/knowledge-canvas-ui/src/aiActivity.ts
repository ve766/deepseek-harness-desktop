/**
 * P1 · AI Activity Timeline — event contract only.
 *
 * This module is the *data hook* for a future AI Activity Timeline. It does NOT
 * render any UI, does NOT talk to a backend, and does NOT touch agent-loop /
 * llm-router. It is a tiny in-memory pub/sub so that future surfaces (Timeline,
 * employee cards, provider logs) can subscribe to state changes emitted by the
 * morphicon state layer.
 *
 * Wire-up (later phases): call `emitAIEvent(...)` whenever a semantic status
 * changes; the Timeline consumes `subscribeAIEvents(...)`.
 */

import type { AgentId } from './types'

/** Lifecycle status mirrored from `AIStatus` — what the timeline cares about. */
export type AIEventStatus =
  | 'idle'
  | 'thinking'
  | 'discovering'
  | 'building'
  | 'completed'
  | 'failed'

export interface AIEvent {
  id: string
  agent: AgentId
  action: string
  status: AIEventStatus
  timestamp: number
  /** Why this event happened — feeds the "AI explains the world" layer. */
  reason?: string
}

type AIEventListener = (event: AIEvent) => void

const listeners = new Set<AIEventListener>()
let seq = 0

/**
 * Emit an AI activity event. `id` and `timestamp` are filled in when omitted.
 * Returns the fully-formed event (handy for tests / logging).
 */
export function emitAIEvent(
  partial: Omit<AIEvent, 'id' | 'timestamp'> & Partial<Pick<AIEvent, 'id' | 'timestamp'>>,
): AIEvent {
  const event: AIEvent = {
    id: partial.id ?? `ae_${Date.now().toString(36)}_${(seq++).toString(36)}`,
    timestamp: partial.timestamp ?? Date.now(),
    agent: partial.agent,
    action: partial.action,
    status: partial.status,
    reason: partial.reason,
  }
  for (const cb of listeners) cb(event)
  return event
}

/** Subscribe to AI activity events. Returns an unsubscribe function. */
export function subscribeAIEvents(cb: AIEventListener): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Snapshot helper for demos / tests. */
export function activeListenerCount(): number {
  return listeners.size
}
