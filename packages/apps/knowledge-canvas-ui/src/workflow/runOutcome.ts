// RunOutcome — the COMPOSITION ROOT of the agent-to-knowledge chain
// (P2-4.5 Step 2).
//
//   Run -> Turn -> ToolCall -> Proposal -> Review -> Apply -> Receipt
//
// WHY THIS LAYER EXISTS
// Every segment of the chain already existed and was probe-verified, but nothing
// connected them: the executor planned tool calls and stopped, the builder had no
// caller, and `AgentRun.proposals` was permanently empty. The ONE place allowed
// to know both sides is this composition root -- that is what keeps the two sides
// independent:
//
//     workflow      -> agent (contracts) + knowledge/write (runtime)   [allowed]
//     executor      -> knowledge/write                                  [FORBIDDEN]
//     executor      -> workflow                                         [FORBIDDEN]
//     knowledge/write -> agent                                          [FORBIDDEN]
//
// The executor stays a lifecycle driver; the Applier stays ignorant of agents;
// this file is the only thing that knows a run may produce a proposal and that a
// proposal may produce a receipt.
//
// TWO SEPARATED STEPS (ruling D6)
//   finalizeRun(run)                 pure: build proposal + validate. NO mutation,
//                                    no adapter, no store -- structurally: the
//                                    function is not given anything it could
//                                    mutate with.
//   applyOutcome(run, review, adapter) explicitly invoked, and the ONLY path that
//                                    can reach the store. Never called by
//                                    `finalizeRun`, never auto-triggered, never
//                                    driven by a decision the chain invented
//                                    itself.
//
// NO PERMISSION MODEL HERE (ruling D7): `awaiting_approval` is a LIFECYCLE
// projection, not an approval system. The seam reports it and stops; who may
// approve is out of scope for P2-4.5.
//
// CONTRACTS UNTOUCHED: proposal ids are backfilled into the existing
// `AgentRun.proposals` field, and receipts live in a process-local ledger. No
// contract type is added or changed.

import type { AgentRun, ToolCall } from '../contracts/agentRun'
import type {
  ApplyRequest,
  ApplyResult,
  ApplyVerdict,
  KnowledgeWriteProposal,
  ReviewResult,
} from '../contracts/knowledgeWrite'
import {
  buildKnowledgeWriteProposal,
  type SkippedToolCall,
} from '../knowledge/write/proposalBuilder'
import { validateProposal } from '../knowledge/write/validate'
import { createKnowledgeApplier } from '../knowledge/write/applier'
import type { KnowledgeMutationAdapter } from '../knowledge/write/mutationAdapter'
import type { RelationPlan } from './planRelations'

// ---------------------------------------------------------------------------
// finalizeRun — pure projection of a finished run
// ---------------------------------------------------------------------------

/**
 * Lifecycle projection of an outcome. `awaiting_approval` deliberately mirrors
 * `RunStatus.awaiting_approval` from the agent contract: the run produced
 * knowledge that needs a decision. It is a STATUS, not a workflow — nothing here
 * asks anyone for anything.
 */
export type OutcomeLifecycle =
  /** A structurally valid proposal exists and awaits an explicit decision. */
  | 'awaiting_approval'
  /** Nothing mappable was planned (or everything was skipped) -- nothing to decide. */
  | 'nothing_to_apply'
  /** The proposal exists but failed structural validation. */
  | 'rejected'
  /** The run never completed (failed/cancelled): it planned no writes to judge. */
  | 'not_applicable'

export interface FinalizedRun {
  readonly run: AgentRun
  /** Deterministic: the id derives from the runId, the ops from the tool-call ids. */
  readonly proposal: KnowledgeWriteProposal
  readonly review: ReviewResult
  readonly lifecycle: OutcomeLifecycle
  /** Tool calls that produced no op — auditable, never silent. */
  readonly skipped: readonly SkippedToolCall[]
  /**
   * Present only when a relation plan was supplied (P2-5 route B): the caller
   * computed it OUTSIDE this function, so finalizeRun stays pure.
   */
  readonly relationPlan?: RelationPlan
}

/** Options for finalizeRun. Everything here is pre-computed, never I/O. */
export interface FinalizeOptions {
  /**
   * Relation planning output (see `./planRelations`). When supplied, it SUPERSEDES
   * the run's unresolved `knowledge.createEdge` intents: those plans carry no
   * endpoints and would be rejected by the Import Rule, so keeping both would
   * duplicate the edge. Runs without unresolved intents are unaffected.
   */
  readonly relationPlan?: RelationPlan
}

/**
 * Turn a finished run into (proposal, review). PURE: no adapter, no store, no
 * clock beyond the run's own tool-call timestamps, no events.
 *
 * Re-running it on the same run yields the same proposal id and the same op
 * target ids (identity rule, P2-4.5 Step 1), which is what makes the whole chain
 * replayable.
 */
export function finalizeRun(run: AgentRun, options?: FinalizeOptions): FinalizedRun {
  const plan = options?.relationPlan
  const toolCalls = plan === undefined ? run.toolCalls : mergeRelationPlan(run, plan)

  const built = buildKnowledgeWriteProposal({
    toolCalls,
    source: { kind: 'agent', agentId: run.agentId, runId: run.runId },
    agentId: run.agentId,
    // timestamp intentionally omitted: the builder derives it from the tool-call
    // timestamps, so the result stays a pure function of the run.
  })

  const review = validateProposal(built.proposal)

  return {
    run,
    proposal: built.proposal,
    review,
    lifecycle: lifecycleOf(run, built.proposal, review),
    skipped: built.skipped,
    ...(plan !== undefined ? { relationPlan: plan } : {}),
  }
}

/**
 * Replace unresolved edge intents with the planned, endpoint-carrying records.
 * Pure: returns a new array, never touches the run.
 */
function mergeRelationPlan(run: AgentRun, plan: RelationPlan): readonly ToolCall[] {
  const kept = run.toolCalls.filter(call => call.name !== 'knowledge.createEdge')
  return [...kept, ...plan.calls]
}

function lifecycleOf(
  run: AgentRun,
  proposal: KnowledgeWriteProposal,
  review: ReviewResult,
): OutcomeLifecycle {
  if (run.status !== 'completed') return 'not_applicable'
  if (proposal.ops.length === 0) return 'nothing_to_apply'
  // validateProposal only ever says 'needs_approval' or 'reject'; 'auto_apply'
  // is not producible by the validator, and if it somehow appeared here it would
  // NOT map to an auto-apply path.
  return review.decision === 'needs_approval' ? 'awaiting_approval' : 'rejected'
}

// ---------------------------------------------------------------------------
// Receipt ledger — process-local, runtime only
// ---------------------------------------------------------------------------

export type ReceiptStatus =
  | 'applied'
  /** Some ops landed, some did not: the partial-apply shape is expected. */
  | 'partially_applied'
  /** Nothing landed (rejected request, or every op failed). */
  | 'rejected'
  /** The run never completed, so the Applier was never consulted. */
  | 'not_applicable'

export interface ApplyReceipt {
  /** Monotonic ledger position (process-local). */
  readonly seq: number
  readonly runId: string
  readonly proposalId: string
  readonly status: ReceiptStatus
  readonly applied: number
  readonly failed: number
  readonly verdicts: readonly ApplyVerdict[]
  readonly undoToken?: string
  readonly ts: number
}

export interface OutcomeApplication {
  /**
   * A NEW run record with `proposals` backfilled. The input run is immutable and
   * is never mutated (contract fields are readonly); the ledger keeps the link.
   */
  readonly run: AgentRun
  readonly receipt: ApplyReceipt
  readonly finalized: FinalizedRun
}

const ledger: ApplyReceipt[] = []
let ledgerSeq = 0

/** Receipts produced in this process, oldest first. */
export function listReceipts(): readonly ApplyReceipt[] {
  return [...ledger]
}

export function findReceipt(proposalId: string): ApplyReceipt | undefined {
  return ledger.find(receipt => receipt.proposalId === proposalId)
}

/** Tests / host teardown only: the ledger is not persisted. */
export function clearReceipts(): void {
  ledger.length = 0
}

// ---------------------------------------------------------------------------
// applyOutcome — the ONLY path that can reach the store
// ---------------------------------------------------------------------------

/**
 * One applier per adapter instance: the Applier keeps its snapshot map in memory
 * (P2-4.4.3 D2), so re-creating it per call would silently drop snapshots.
 */
const appliers = new WeakMap<KnowledgeMutationAdapter, ReturnType<typeof createKnowledgeApplier>>()

function applierFor(adapter: KnowledgeMutationAdapter): ReturnType<typeof createKnowledgeApplier> {
  const existing = appliers.get(adapter)
  if (existing !== undefined) return existing
  const created = createKnowledgeApplier(adapter)
  appliers.set(adapter, created)
  return created
}

/**
 * Apply an outcome. MUST be called explicitly (ruling D6): nothing in this module
 * calls it, and neither does the executor.
 *
 * The review is passed through UNCHANGED — the Applier owns admission control
 * (proposalId match, `needs_approval`, re-validation), so a forged or
 * `auto_apply` review is rejected there rather than silently repaired here.
 * `auto_apply` is never produced by this chain on any path.
 */
export async function applyOutcome(
  run: AgentRun,
  review: ReviewResult,
  adapter: KnowledgeMutationAdapter,
  options?: FinalizeOptions,
): Promise<OutcomeApplication> {
  const finalized = finalizeRun(run, options)

  // A run that never completed planned nothing worth writing: do not consult the
  // Applier at all (and therefore never touch the adapter).
  if (finalized.lifecycle === 'not_applicable') {
    return {
      run,
      finalized,
      receipt: record(run.runId, finalized.proposal.id, {
        status: 'not_applicable',
        applied: 0,
        failed: 0,
        verdicts: [],
      }),
    }
  }

  const request: ApplyRequest = { proposal: finalized.proposal, review }
  const result: ApplyResult = await applierFor(adapter).apply(request)

  const receipt = record(run.runId, result.proposalId, {
    ...receiptShape(result),
  })

  return { run: withProposalId(run, result.proposalId), finalized, receipt }
}

/** Immutable backfill of the existing contract field (no contract change). */
function withProposalId(run: AgentRun, proposalId: string): AgentRun {
  if (run.proposals.includes(proposalId)) return run
  return { ...run, proposals: [...run.proposals, proposalId] }
}

function receiptShape(result: ApplyResult): Omit<ApplyReceipt, 'seq' | 'runId' | 'proposalId' | 'ts'> {
  const status: ReceiptStatus =
    result.applied === 0 && result.failed === 0
      ? 'rejected'
      : result.failed === 0
        ? 'applied'
        : result.applied === 0
          ? 'rejected'
          : 'partially_applied'

  return {
    status,
    applied: result.applied,
    failed: result.failed,
    verdicts: result.verdicts,
    ...(result.undoToken !== undefined ? { undoToken: result.undoToken } : {}),
  }
}

function record(
  runId: string,
  proposalId: string,
  shape: Omit<ApplyReceipt, 'seq' | 'runId' | 'proposalId' | 'ts'>,
): ApplyReceipt {
  const receipt: ApplyReceipt = {
    seq: ++ledgerSeq,
    runId,
    proposalId,
    ts: Date.now(),
    ...shape,
  }
  ledger.push(receipt)
  return receipt
}
