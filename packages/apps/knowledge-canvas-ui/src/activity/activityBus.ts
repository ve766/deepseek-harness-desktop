// ActivityBus runtime — the first consumer of the frozen contracts (P2-4.1).
//
// Scope is exactly three things (P2-4.1 ruling): publish, subscribe, dispose.
// It is an in-process event channel, NOT a database: publish -> notify ->
// discard (ruling Q1 = Option A). No persistence, no cross-session state, no
// network. `replay()` below exists only to satisfy the frozen contract; it
// yields nothing until the Activity Timeline stage provides real storage.
//
// Dependency direction (one-way, enforced by review):
//   src/activity/* -> contracts/*   (type only)
//   src/activity/* -/-> store, knowledge, llm, mock, demo
//
// The host owns exactly one instance ("ActivityBus 创建位置唯一"). Components
// never hold the bus; they only call the emit helpers at the bottom.

import type {
  ActivityEvent,
  ActivityKind,
  ActivitySourceId,
  ActivityTarget,
} from '../contracts/activityEvent'
import type { ActivityBus, ActivityReplayOptions } from '../contracts/activityBus'

type Sink = (event: ActivityEvent) => void

export interface ActivityEmitter {
  readonly id: ActivitySourceId
  emit(kind: ActivityKind, target?: ActivityTarget, payload?: unknown): ActivityEvent
}

export interface ActivityRuntime {
  readonly bus: ActivityBus
  createEmitter(id: ActivitySourceId): ActivityEmitter
  dispose(): void
}

export function createActivityRuntime(): ActivityRuntime {
  let seq = 0
  let disposed = false
  const sinks = new Set<Sink>()

  const dispatch = (event: ActivityEvent): void => {
    if (disposed) return
    for (const sink of [...sinks]) {
      try {
        sink(event)
      } catch {
        // Subscriber isolation (P2-3 Q5): one failing observer must not break
        // the chain, and must never propagate into publishers.
      }
    }
  }

  const bus: ActivityBus = {
    register(source) {
      if (disposed) return () => {}
      const un = source.subscribe(dispatch)
      return () => un()
    },
    subscribe(filter, next) {
      if (disposed) return () => {}
      const sink: Sink = (event) => {
        if (filter.sources && !filter.sources.includes(event.source)) return
        if (filter.kinds && !filter.kinds.includes(event.kind)) return
        if (filter.sinceSeq !== undefined && event.seq <= filter.sinceSeq) return
        next(event)
      }
      sinks.add(sink)
      return () => {
        sinks.delete(sink)
      }
    },
    // P2-4.1 ruling: no replay implementation. Empty by design, documented so
    // the gap is visible instead of silent.
    async *replay(_options?: ActivityReplayOptions) {},
    get latestSeq() {
      return seq
    },
  }

  return {
    bus,
    createEmitter(id) {
      return {
        id,
        emit(kind, target, payload) {
          const event: ActivityEvent = {
            id: `act-${++seq}`,
            seq,
            ts: Date.now(),
            source: id,
            kind,
            ...(target ? { target } : {}),
            ...(payload !== undefined ? { payload } : {}),
          }
          dispatch(event)
          return event
        },
      }
    },
    dispose() {
      disposed = true
      sinks.clear()
    },
  }
}

// ---------------------------------------------------------------------------
// Host-owned single instance. Created lazily at the composition boundary;
// `disposeHostActivity()` is for host teardown and tests only.
// ---------------------------------------------------------------------------

let hostRuntime: ActivityRuntime | null = null
let userEmitter: ActivityEmitter | null = null
let ingestionEmitter: ActivityEmitter | null = null

function host(): ActivityRuntime {
  if (!hostRuntime) hostRuntime = createActivityRuntime()
  return hostRuntime
}

export function emitUserActivity(
  kind: ActivityKind,
  target?: ActivityTarget,
  payload?: unknown,
): ActivityEvent {
  userEmitter ??= host().createEmitter('user')
  return userEmitter.emit(kind, target, payload)
}

export function emitIngestionActivity(
  kind: ActivityKind,
  target?: ActivityTarget,
  payload?: unknown,
): ActivityEvent {
  ingestionEmitter ??= host().createEmitter('ingestion')
  return ingestionEmitter.emit(kind, target, payload)
}

export function disposeHostActivity(): void {
  hostRuntime?.dispose()
  hostRuntime = null
  userEmitter = null
  ingestionEmitter = null
}
