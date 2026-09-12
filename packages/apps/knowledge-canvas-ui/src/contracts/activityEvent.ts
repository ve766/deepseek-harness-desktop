// P2-2.1 contract — ActivityEvent
//
// This module is part of the system ABI layer. It MUST contain only type-level
// declarations: no runtime imports, no values, no side effects, no implementation.
//
// Allowed dependency direction (P2-2.1 ruling):
//   UI / Agent Core / Renderer / Plugin  ->  contracts  ->  domain/types (type only)
// Forbidden: contracts -> store | knowledge | llm | mock | demo
//
// ActivityKind is intentionally a pure union. There is NO const array: the bus is
// a contract here, not a runtime registry. A registry may be introduced later if
// P2-3 plugin sources require validation.

/** Frozen for P2-2.1: only user and ingestion sources are in scope. */
export type ActivitySourceId = 'user' | 'ingestion'

/** Frozen event catalogue (12 kinds). No plugin / external / social / automation kinds. */
export type ActivityKind =
  // A. UI Activity Source
  | 'galaxy.opened'
  | 'node.clicked'
  | 'node.selected'
  | 'node.dragEnd'
  | 'search.performed'
  | 'task.created'
  | 'knowledge.viewed'
  // B. ingestion Activity Source
  | 'document.imported'
  | 'extraction.completed'
  | 'extraction.failed'
  | 'entity.discovered'
  | 'relation.created'

export type ActivitySeverity = 'info' | 'success' | 'warning' | 'error'

export interface ActivityTarget {
  readonly nodeIds?: readonly string[]
  readonly edgeIds?: readonly string[]
  readonly docId?: string
  readonly query?: string
}

export interface ActivityEvent {
  readonly id: string
  /** Bus-assigned, dense, monotonically increasing — the replay cursor. */
  readonly seq: number
  readonly ts: number
  readonly source: ActivitySourceId
  readonly kind: ActivityKind
  readonly actor?: string
  readonly target?: ActivityTarget
  readonly payload?: unknown
  readonly severity?: ActivitySeverity
  /** Ties the event to an Agent Run (see agentRun.ts). */
  readonly runId?: string
}

export interface ActivityFilter {
  readonly sources?: readonly ActivitySourceId[]
  readonly kinds?: readonly ActivityKind[]
  readonly sinceSeq?: number
}
