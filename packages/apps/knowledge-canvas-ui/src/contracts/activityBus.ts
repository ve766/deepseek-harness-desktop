// P2-2.1 contract — ActivityBus
//
// Part of the system ABI layer: type-level declarations only. No runtime imports,
// no values, no side effects, no implementation.
//
// The bus is DECLARED here, not implemented. `replay` is the load-bearing member:
// an append-only log plus a cursor is what lets a recorded event stream replace the
// scripted demo sequencer, and it is also what makes audit and visual replay possible.

import type { ActivityEvent, ActivityFilter, ActivitySourceId } from './activityEvent'

export type Unsubscribe = () => void

export interface ActivitySource {
  readonly id: ActivitySourceId
  subscribe(next: (event: ActivityEvent) => void): Unsubscribe
}

export interface ActivityReplayOptions {
  readonly fromSeq?: number
  readonly filter?: ActivityFilter
}

export interface ActivityBus {
  register(source: ActivitySource): Unsubscribe
  subscribe(filter: ActivityFilter, next: (event: ActivityEvent) => void): Unsubscribe
  /** Append-only replay — demo, audit and visual replay all ride on this. */
  replay(options?: ActivityReplayOptions): AsyncIterable<ActivityEvent>
  readonly latestSeq: number
}
