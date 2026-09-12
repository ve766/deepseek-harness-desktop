// KnowledgeApplier — the GOVERNANCE half of the write-governance chain
// (P2-4.4.3 Step 2).
//
// Layer position (frozen):
//
//   Agent / Ingestion / User  --proposal-->  validateProposal (structure)
//                                                 |
//                                                 v
//                          KnowledgeApplier  (THIS FILE: policy + accounting)
//                                                 |
//                                                 v
//                          KnowledgeMutationAdapter (mechanical, one op)
//                                                 |
//                                                 v
//                          Store (future: Zustand / SQLite / vector / plugin)
//
// ---------------------------------------------------------------------------
// What the Applier IS
// ---------------------------------------------------------------------------
// - The only place that may turn a proposal into knowledge mutation.
// - The owner of POLICY: kill-switch admission (review re-check), Import Rule
//   (F1), batch dependency handling, fact -> verdict mapping, and the
//   `applied + failed === ops.length` accounting invariant.
// - The owner of SNAPSHOT BOOKKEEPING (D2): `before` states returned by the
//   adapter are recorded in memory under a per-proposal undoToken. It does NOT
//   implement restore.
//
// ---------------------------------------------------------------------------
// What the Applier is NOT (frozen: do not grow sideways)
// ---------------------------------------------------------------------------
// - NOT an Agent Orchestrator: it never references AgentRun, tool calls, LLM,
//   Router or provider routing. It is told what to write, not why.
// - NOT an Approval System / UI Reviewer: it consumes a ReviewResult; it never
//   produces one, never asks a human, and has no UI surface.
// - NOT a Knowledge Planner: it never invents ops, never rewrites a proposal,
//   and never queries the store to decide what SHOULD exist.
// - NOT a network component: local-only holds structurally (no llm import, no
//   fetch). There is nothing to route, so routing is not re-checked here (D5).
//
// ---------------------------------------------------------------------------
// Two hard invariants
// ---------------------------------------------------------------------------
// 1. NEVER `auto_apply`. Structure-valid review is only ever `needs_approval`;
//    `auto_apply` supplied by a caller is treated as an ILLEGAL input.
// 2. NEVER partial accounting drift: every op gets exactly one verdict, and
//    `applied + failed === ops.length` holds on every return path.
//
// Note on `ApplyStatus.skipped`: it is deliberately UNUSED. Dependency-failed
// ops are reported as `rejected` so the contract arithmetic keeps holding; the
// vocabulary stays available for a future ruling.
//
// Dependency direction: knowledge/write -> contracts (type only) + siblings
// (./validate, ./mutationAdapter). Forbidden: store, llm, agent, activity,
// mock, demo, components, react.

import type {
  ApplyCode,
  ApplyRequest,
  ApplyResult,
  ApplyStatus,
  ApplyVerdict,
  KnowledgeApplier,
  KnowledgeWriteProposal,
  ProposalOp,
  UndoResult,
  ReviewResult,
} from '../../contracts/knowledgeWrite'
import type { KnowledgeMutationAdapter, MutationFailureCode, MutationResult } from './mutationAdapter'
import { validateProposal } from './validate'

/** Proposal-level verdicts use the same pseudo-index as the validator. */
const PROPOSAL_INDEX = -1

// ---------------------------------------------------------------------------
// Import Rule (F1) — the concrete instantiation
// ---------------------------------------------------------------------------
// AI-produced knowledge must be MARKED as AI-produced, otherwise it cannot be
// distinguished from user-owned content and the audit trail is worthless (the
// product invariant behind the sequencer's clearAiGenerated). Field names are
// taken from the data layer as it exists, not invented:
//   node   -> KnowledgeNode.aiStatus ('draft' | 'auto' = AI markers,
//             'confirmed' = user-owned) + ownerAgent (which employee)
//   edge   -> KnowledgeEdge.kind ('ai-auto' = AI-created, 'manual' = user-made)
//
// Scope: CREATE ops only. update/delete do not introduce new AI knowledge, and
// this stage does NOT rewrite the provenance of existing entities.

const AI_NODE_STATUS_MARKERS = new Set(['draft', 'auto'])
const AI_EDGE_KIND = 'ai-auto'

function isAiSource(proposal: KnowledgeWriteProposal): boolean {
  return proposal.source.kind === 'agent' || proposal.source.kind === 'ingestion'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type RuleCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string }

const RULE_OK: RuleCheck = { ok: true }
function ruleFail(reason: string): RuleCheck {
  return { ok: false, reason }
}

function checkImportRule(proposal: KnowledgeWriteProposal, op: ProposalOp): RuleCheck {
  // Manual UI edits travel the same channel so that every change shares one
  // audit trail -- but they are not AI-produced, so there is nothing to declare.
  if (!isAiSource(proposal)) return RULE_OK
  if (!isRecord(op.payload)) {
    return ruleFail('F1 Import Rule: AI op payload is not a record, so provenance cannot be declared')
  }

  if (op.type === 'node.create') {
    const status = op.payload.aiStatus
    if (typeof status !== 'string' || status === '') {
      return ruleFail('F1 Import Rule: AI-created node must declare aiStatus (draft | auto)')
    }
    if (status === 'confirmed') {
      return ruleFail("F1 Import Rule: an AI proposal cannot claim user ownership (aiStatus 'confirmed')")
    }
    if (!AI_NODE_STATUS_MARKERS.has(status)) {
      return ruleFail(`F1 Import Rule: unknown aiStatus '${status}'`)
    }
    const owner = op.payload.ownerAgent
    if (typeof owner !== 'string' || owner === '') {
      return ruleFail('F1 Import Rule: AI-created node must declare ownerAgent')
    }
    if (owner !== proposal.agentId) {
      return ruleFail(`F1 Import Rule: ownerAgent '${owner}' does not match proposal.agentId '${proposal.agentId}'`)
    }
    return RULE_OK
  }

  if (op.type === 'relation.create') {
    const kind = op.payload.kind
    if (kind !== AI_EDGE_KIND) {
      return ruleFail(`F1 Import Rule: AI-created relation must declare kind '${AI_EDGE_KIND}' (got ${describe(kind)})`)
    }
    return RULE_OK
  }

  // node.update / node.delete / relation.update / relation.delete: no new AI
  // knowledge is introduced, and provenance is not rewritten in this stage.
  return RULE_OK
}

function describe(value: unknown): string {
  return typeof value === 'string' ? `'${value}'` : String(value)
}

// ---------------------------------------------------------------------------
// Adapter fact -> governance verdict (D2: mapping lives HERE, never in adapter)
// ---------------------------------------------------------------------------

const FACT_TO_CODE: Record<MutationFailureCode, ApplyCode> = {
  // the id is already occupied: two writers claim the same entity
  'duplicate-target': 'conflict',
  // an EXISTING target vanished between validation and apply
  'missing-target': 'stale',
  // unreachable through validate; a hand-built op is a schema-level problem
  'unsupported-op': 'schema',
  // payload shape the adapter cannot store
  'invalid-payload': 'schema',
  // the underlying store threw: no verdict about the op itself is possible
  'engine-error': 'rejected',
}

// ---------------------------------------------------------------------------
// Verdict helpers
// ---------------------------------------------------------------------------

function verdict(index: number, status: ApplyStatus, code?: ApplyCode, reason?: string): ApplyVerdict {
  return {
    index,
    status,
    ...(code !== undefined ? { code } : {}),
    ...(reason !== undefined ? { reason } : {}),
  }
}

/** Codes the Applier may report before any op is attempted. */
function rejectionCode(review: ReviewResult, revalidated: ReviewResult): ApplyCode {
  if (review.decision === 'auto_apply') return 'rejected'
  for (const v of revalidated.verdicts) {
    if (v.ok) continue
    if (v.code === 'schema' || v.code === 'import_rule' || v.code === 'privacy') return v.code
  }
  return 'schema'
}

/**
 * Admission control. Returns null when the request may proceed, otherwise a
 * proposal-level rejection verdict. Three gates, in order (D1):
 *   1. the review must be ABOUT this proposal
 *   2. the decision must be exactly 'needs_approval' ('auto_apply' is illegal)
 *   3. the proposal must re-validate -- a ReviewResult is external input, never
 *      a trusted fact, so the structural check is re-run (pure, zero cost)
 */
function admit(request: ApplyRequest): ApplyVerdict | null {
  const { proposal, review } = request

  if (review.proposalId !== proposal.id) {
    return verdict(
      PROPOSAL_INDEX,
      'rejected',
      'schema',
      `review.proposalId '${review.proposalId}' does not match proposal.id '${proposal.id}'`,
    )
  }

  if (review.decision === 'auto_apply') {
    return verdict(
      PROPOSAL_INDEX,
      'rejected',
      'rejected',
      "review decision 'auto_apply' is never a valid Applier input (the knowledge space is modified only after an explicit decision)",
    )
  }
  if (review.decision !== 'needs_approval') {
    return verdict(
      PROPOSAL_INDEX,
      'rejected',
      'rejected',
      `review decision '${String(review.decision)}' is not 'needs_approval'`,
    )
  }

  const revalidated = validateProposal(proposal)
  if (revalidated.decision !== 'needs_approval') {
    const first = revalidated.verdicts.find(v => !v.ok)
    return verdict(
      PROPOSAL_INDEX,
      'rejected',
      rejectionCode(review, revalidated),
      `re-validation failed: ${first?.reason ?? 'proposal is not structurally valid'}`,
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Snapshot bookkeeping (D2) — memory only, no restore
// ---------------------------------------------------------------------------

interface CapturedSnapshot {
  readonly index: number
  /**
   * Whether the target existed before the op. `false` (a create) is a MEANINGFUL
   * pre-state, not a missing value: a future restore needs it to know that the
   * created entity must go away. The fact comes from the adapter
   * (`MutationResult.existed`), never from an inverse operation.
   */
  readonly existed: boolean
  /**
   * Pre-mutation state (undefined for a create). Shallow, per D3.
   */
  readonly before: unknown
}

interface SnapshotRecord {
  readonly proposalId: string
  readonly captured: readonly CapturedSnapshot[]
}

// ---------------------------------------------------------------------------
// Applier
// ---------------------------------------------------------------------------

/**
 * Create the Applier over a mutation adapter.
 *
 * The adapter is injected (never imported), which is what keeps this file free
 * of store knowledge and lets a store-backed adapter arrive later without
 * touching governance code.
 */
export function createKnowledgeApplier(adapter: KnowledgeMutationAdapter): KnowledgeApplier {
  // Process-lifetime only (D2). Nothing here survives a restart, and nothing
  // here is visible to the KnowledgeBackend or to any other subsystem.
  const snapshots = new Map<string, SnapshotRecord>()

  return {
    async apply(request: ApplyRequest): Promise<ApplyResult> {
      const { proposal } = request
      const ops = proposal.ops

      const blocked = admit(request)
      if (blocked !== null) {
        // Nothing is attempted, but the accounting invariant must still hold:
        // 0 applied + ops.length failed === ops.length.
        const verdicts: ApplyVerdict[] = [
          blocked,
          ...ops.map((_, i) =>
            verdict(i, 'rejected', blocked.code, 'not attempted: request rejected before apply'),
          ),
        ]
        return { proposalId: proposal.id, applied: 0, failed: ops.length, verdicts }
      }

      const verdicts: ApplyVerdict[] = []
      const captured: CapturedSnapshot[] = []
      /** Ids whose op failed in THIS batch: later ops depending on them must not fire. */
      const failedIds = new Set<string>()
      let applied = 0
      let failed = 0

      for (let i = 0; i < ops.length; i++) {
        const op = ops[i]
        const opId = op.target.nodeId ?? op.target.relationId

        // --- policy gate 1: Import Rule (F1) -------------------------------
        const rule = checkImportRule(proposal, op)
        if (!rule.ok) {
          verdicts.push(verdict(i, 'rejected', 'import_rule', rule.reason))
          failed++
          if (opId !== undefined) failedIds.add(opId)
          continue
        }

        // --- policy gate 2: batch dependency (D1(a), no store read) --------
        // The Applier never queries the store, so the only endpoint knowledge it
        // has is what happened EARLIER IN THIS BATCH. A target, or a relation
        // endpoint, whose create failed here cannot be repaired by trying again.
        const brokenDependency = batchBrokenDependency(op, opId, failedIds)
        if (brokenDependency !== null) {
          verdicts.push(verdict(i, 'rejected', 'conflict', brokenDependency))
          failed++
          if (opId !== undefined) failedIds.add(opId)
          continue
        }

        // --- mechanics: delegate, translate, account -----------------------
        let result: MutationResult
        try {
          result = adapter.applyOp(op)
        } catch (error: unknown) {
          result = {
            ok: false,
            code: 'engine-error',
            reason: error instanceof Error ? error.message : String(error),
          }
        }

        if (result.ok) {
          applied++
          verdicts.push(verdict(i, 'applied', 'ok'))
          // EVERY applied op contributes a capture slot, including creates
          // (existed:false, no `before`). Recording only ops that happened to
          // return a `before` payload would make a pure-create batch look
          // non-reversible, which is wrong: creating is the most common AI action.
          captured.push({ index: i, existed: result.existed === true, before: result.before })
        } else {
          failed++
          if (opId !== undefined) failedIds.add(opId)
          const code = result.code !== undefined ? FACT_TO_CODE[result.code] : 'rejected'
          verdicts.push(verdict(i, 'rejected', code, result.reason ?? 'mutation adapter reported a failure'))
        }
      }

      const undoToken = `undo-${proposal.id}`
      // Any applied op yields a snapshot set (creates => existed:false).
      // Recording it does NOT imply a working restore: replay is deferred (D2).
      if (captured.length > 0) {
        snapshots.set(undoToken, { proposalId: proposal.id, captured })
      }

      return {
        proposalId: proposal.id,
        applied,
        failed,
        verdicts,
        ...(captured.length > 0 ? { undoToken } : {}),
      }
    },

    async undo(undoToken: string): Promise<UndoResult> {
      // The snapshot carrier exists (D2); replaying it does not. Reporting an
      // honest failure is the point -- a stub that silently "succeeds" would be
      // indistinguishable from a working restore.
      const known = snapshots.has(undoToken) ? 'snapshot present' : 'unknown token'
      return {
        ok: false,
        restored: 0,
        reason: `undo restore is not implemented in P2-4.4.3 (${known}); capture only`,
      }
    },
  }
}

/**
 * Batch-context dependency check (D1(a)): a later op must not fire against an id
 * this batch already failed to create.
 *
 * REACHABILITY NOTE (honest): the target-id branch is defence in depth --
 * `validateProposal` already rejects a batch that names the same id twice, and
 * forbids `update`/`delete` from targeting a pre-allocated id, so a dependent
 * target rarely survives to apply time. The ENDPOINT branch is the live one: a
 * relation payload's `from` / `to` are not op targets, so the validator never
 * sees them, and a relation pointing at a node whose create just failed is a
 * real, reachable case.
 */
function batchBrokenDependency(op: ProposalOp, opId: string | undefined, failedIds: Set<string>): string | null {
  if (opId !== undefined && failedIds.has(opId)) {
    return `target '${opId}' was not created earlier in this batch`
  }
  if (op.type === 'relation.create' && isRecord(op.payload)) {
    for (const endpoint of ['from', 'to'] as const) {
      const id = op.payload[endpoint]
      if (typeof id === 'string' && id !== '' && failedIds.has(id)) {
        return `relation endpoint '${endpoint}' -> '${id}' was not created earlier in this batch`
      }
    }
  }
  return null
}
