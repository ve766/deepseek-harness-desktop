// P2-2.3 contract — Knowledge Write Governance
//
// Part of the system ABI layer: type-level declarations only. No runtime imports,
// no values, no side effects, no implementation.
//
// Allowed dependency direction (P2-2.1 ruling):
//   UI / Agent Core / Renderer / Plugin  ->  contracts  ->  domain/types (type only)
// Forbidden: contracts -> store | knowledge | llm | mock | demo
// Also forbidden here: any reference to activityBus / sceneGraph / renderer. The
// visualisation chain and the write-governance chain evolve independently and are
// NOT merged (an op may carry an EvidenceRef pointing at an event seq, but that is
// a reference, never a type dependency).
//
// Two hard constraints carried by this file:
//
//   1. PROPOSALS ARE IMMUTABLE. A Reviewer must NEVER mutate a proposal
//      (e.g. `proposal.ops[0].confidence = 0.9` is forbidden). Reviewing produces a
//      NEW ReviewResult; a "changed" proposal is a NEW proposal. This is what makes
//      the audit chain trustworthy.
//
//   2. THE APPLIER KNOWS NOTHING ABOUT AGENTS. It must not reference Agent, LLM,
//      Router or any orchestration type. Its only job is:
//          validated proposal -> knowledge mutation
//      Otherwise swapping the agent framework would contaminate the storage layer.

import type { AgentId } from '../types'

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

/**
 * Undo v1.
 *
 * SEMANTICS ARE FIXED (P2-2.3 ruling Q1): undo is a **minimal before-state
 * snapshot per op**, NOT an inverse operation. Inverse operations are rejected
 * because many operations are not strictly reversible — create/delete entity,
 * merge/split relation, update attribute — and once manual edits, multi-source
 * ingestion and agent proposals coexist, an inverse op can easily be applied when
 * `current state != pre-op state`, which would corrupt the knowledge space.
 *
 * TYPE IS DELIBERATELY `unknown` IN V1 (ruling Q5): undo is a governance
 * capability, and freezing its shape in the first contract version would lock in
 * decisions we do not have evidence for yet. The contract therefore only fixes
 * the semantic and leaves the shape open.
 */
export type ProposalUndo = unknown

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export type ProposalOpType =
  | 'node.create'
  | 'node.update'
  | 'node.delete'
  | 'relation.create'
  | 'relation.update'
  | 'relation.delete'

/**
 * A stable reference to the source that justifies an op. Evidence stores
 * REFERENCES only — never embedded blobs — so a reviewer can re-check later.
 *
 * `event` points at an ActivityBus append-only cursor. That is a reference by
 * number, not a type dependency: this module does not import activityBus.
 */
export type EvidenceRef =
  | { readonly kind: 'node'; readonly id: string }
  | { readonly kind: 'doc'; readonly id: string }
  | { readonly kind: 'chunk'; readonly id: string }
  | { readonly kind: 'event'; readonly seq: number }
  | { readonly kind: 'text'; readonly excerpt: string }

export interface ProposalOpTarget {
  readonly nodeId?: string
  readonly relationId?: string
}

export interface ProposalOp {
  readonly type: ProposalOpType
  /**
   * Pre-allocated by the proposal side (not by the applier) so ops within one
   * batch can reference each other and the whole batch stays idempotent.
   */
  readonly target: ProposalOpTarget
  readonly payload: unknown
  /**
   * Evidence metadata, NOT a decision input.
   *
   * Ruling Q4: the contract must not encode `confidence > 0.8 => auto apply`.
   * Thresholds are product policy and differ per scenario (enterprise knowledge
   * base, private space, auto-tidy, high-risk delete), so they belong to the
   * Reviewer implementation, not to the data protocol.
   */
  readonly confidence: number
  /** Human-readable explanation for this single operation. */
  readonly reason: string
  readonly evidence?: readonly EvidenceRef[]
  /** Minimal before-state snapshot (see ProposalUndo). Absent => not undoable. */
  readonly undo?: ProposalUndo
}

// ---------------------------------------------------------------------------
// Proposal
// ---------------------------------------------------------------------------

export type ProposalSource =
  | {
    readonly kind: 'agent'
    readonly agentId: AgentId
    readonly runId: string
    readonly turnIndex?: number
  }
  | { readonly kind: 'ingestion'; readonly docId: string }
  /** Manual UI edits travel the same channel so every change shares one audit trail. */
  | { readonly kind: 'user' }

export interface KnowledgeWriteProposal {
  /** Idempotency key: re-applying the same proposal must not produce a second change. */
  readonly id: string
  readonly source: ProposalSource
  readonly agentId: AgentId
  readonly timestamp: number
  /** Proposal-level confidence. Also metadata only — see ProposalOp.confidence. */
  readonly confidence: number
  /** Why this batch of changes is being proposed. */
  readonly explanation: string
  /** IMMUTABLE. Every field is readonly; a new decision means a new object. */
  readonly ops: readonly ProposalOp[]
}

// ---------------------------------------------------------------------------
// Reviewer output
// ---------------------------------------------------------------------------

export type ReviewDecision = 'auto_apply' | 'needs_approval' | 'reject'

/**
 * Result-code vocabulary. `low_confidence` exists as a *result code* so the
 * Reviewer can report it — it is not a threshold encoded in the protocol.
 */
export type ReviewCode =
  | 'ok'
  | 'schema'
  | 'import_rule'
  | 'privacy'
  | 'low_confidence'
  | 'destructive'
  | 'stale'

export interface ReviewVerdict {
  readonly index: number
  readonly ok: boolean
  readonly code?: ReviewCode
  readonly reason?: string
}

/**
 * The Reviewer's output. Note what it does NOT contain: no mutated ops. Rewriting
 * a proposal during review would destroy the audit chain, so a Reviewer reports
 * verdicts and lets the caller decide whether to emit a new proposal.
 */
export interface ReviewResult {
  readonly proposalId: string
  readonly decision: ReviewDecision
  readonly verdicts: readonly ReviewVerdict[]
}

// ---------------------------------------------------------------------------
// Applier I/O
// ---------------------------------------------------------------------------

/**
 * No optimistic locking in this version (ruling Q3): there is no real concurrent
 * write model yet, so adding version / revision / transaction fields would invent
 * complexity. Staleness and conflicts are surfaced as RESULT CODES instead.
 */
export type ApplyStatus = 'applied' | 'skipped' | 'rejected'

export type ApplyCode =
  | 'ok'
  | 'schema'
  | 'import_rule'
  | 'privacy'
  | 'stale'
  | 'conflict'
  | 'rejected'

export interface ApplyVerdict {
  readonly index: number
  readonly status: ApplyStatus
  readonly code?: ApplyCode
  readonly reason?: string
}

export interface ApplyRequest {
  readonly proposal: KnowledgeWriteProposal
  readonly review: ReviewResult
}

/**
 * Partial success is expected: one rejected op must not fail the whole batch,
 * so callers must handle `applied + failed == ops.length`.
 */
export interface ApplyResult {
  readonly proposalId: string
  readonly applied: number
  readonly failed: number
  /** Apply-time verdicts — they may differ from review-time verdicts. */
  readonly verdicts: readonly ApplyVerdict[]
  readonly undoToken?: string
}

export interface UndoResult {
  readonly ok: boolean
  readonly restored: number
  readonly reason?: string
}

/**
 * The Applier boundary. It receives validated data only and performs knowledge
 * mutation. It has no notion of agents, models, routers or orchestration.
 */
export interface KnowledgeApplier {
  apply(request: ApplyRequest): Promise<ApplyResult>
  undo(undoToken: string): Promise<UndoResult>
}
