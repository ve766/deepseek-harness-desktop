// ProposalBuilder — planned ToolCalls -> auditable KnowledgeWriteProposal
// (P2-4.4.1, first stage of the write-governance chain).
//
// PURE FUNCTION by ruling: ToolCall[] + ProposalSource in, proposal out.
// Forbidden here: store query/write, undo generation (the before-state snapshot
// is collected by the Applier in P2-4.4.3 -- the side that actually HAS store
// access), apply, validation, reviewer simulation, LLM calls, network, filesystem.
//
// Op mapping is FROZEN (ruling Q1/Q2):
//   knowledge.createNode        -> node.create
//   knowledge.createEdge        -> relation.create
//   knowledge.updateAttribute   -> node.update
//   knowledge.createCluster     -> SKIPPED, reason
//                                 'unsupported-operation: cluster.create'
//     (the frozen ProposalOpType has no cluster kind; per the evolution
//      discipline the mapping is NOT faked through relation.create -- the need
//      goes to a separate contract evolution)
//   knowledge.deriveClusters    -> SKIPPED, reason 'derived-operation' (Q-G4)
//   llm.complete (ok)           -> NOT an op; consumed as EVIDENCE
//                                 ({ kind: 'text', excerpt } -- reference only)
//
// Idempotency: proposal id derives from the source (runId for agent runs), and
// op target ids derive from the source tool-call ids -- same input, same output.
//
// Dependency direction: knowledge/write -> contracts (type only) + ../types.
// Forbidden: store, llm, agent, activity, mock, demo, components, react.

import type { ToolCall } from '../../contracts/agentRun'
import type {
  EvidenceRef,
  KnowledgeWriteProposal,
  ProposalOp,
  ProposalOpType,
  ProposalSource,
} from '../../contracts/knowledgeWrite'
import type { AgentId } from '../../types'

/**
 * Pre-allocated target id prefixes (P2-4.4.2 ruling Q3: exported so the
 * validator reuses the SAME constants instead of copying strings -- a copied
 * literal would drift from the builder and silently break the convention).
 */
export const PROPOSED_NODE_PREFIX = 'proposed-node-'
export const PROPOSED_RELATION_PREFIX = 'proposed-rel-'

export interface BuildProposalInput {
  /** Planned tool calls (typically from an AgentRun). */
  readonly toolCalls: readonly ToolCall[]
  /** Who is proposing. Agent sources carry the runId used for idempotency. */
  readonly source: ProposalSource
  /** Proposal-level agent attribution (contract field, mirrored beside source). */
  readonly agentId: AgentId
  /**
   * Per-op confidence. DESCRIPTION ONLY (contract Q4): never a decision input;
   * thresholds live in a future Reviewer, never here. Default 0.5.
   */
  readonly confidence?: number
  /** Proposal timestamp; defaults to the newest tool-call ts (keeps purity). */
  readonly timestamp?: number
}

/** One tool call that could not become an op -- always auditable, never silent. */
export interface SkippedToolCall {
  readonly toolCallId: string
  readonly name: string
  readonly code:
    | 'unsupported-operation' // no contract op type exists (e.g. cluster.create)
    | 'derived-operation' // Q-G4: derived ops are never proposals themselves
    | 'failed-call' // errored tool calls carry no proposal-worthy intent
    | 'missing-target' // e.g. node.update without a resolvable node id
  readonly reason: string
}

export interface BuildProposalResult {
  readonly proposal: KnowledgeWriteProposal
  readonly skipped: readonly SkippedToolCall[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** String field out of an unknown args object ('' when absent). */
function argString(args: unknown, key: string): string {
  if (!isRecord(args)) return ''
  const v = args[key]
  return typeof v === 'string' ? v : ''
}

/**
 * Build an immutable KnowledgeWriteProposal from planned tool calls.
 *
 * Immutability is enforced by the contract types themselves: every field is
 * `readonly`, so `proposal.ops.push()`, `proposal.ops[0].type = ...` and
 * `proposal.source = ...` are all compile errors (ruling: TS-level ban).
 */
export function buildKnowledgeWriteProposal(input: BuildProposalInput): BuildProposalResult {
  const skipped: SkippedToolCall[] = []
  const ops: ProposalOp[] = []
  const evidence: EvidenceRef[] = []

  // Evidence first: successful model calls become text references. The excerpt
  // is a REFERENCE into the run record, never an embedded entity snapshot.
  for (const tc of input.toolCalls) {
    if (tc.name === 'llm.complete' && tc.status === 'ok' && isRecord(tc.result)) {
      const preview = tc.result.textPreview
      if (typeof preview === 'string' && preview.length > 0) {
        evidence.push({ kind: 'text', excerpt: preview })
      }
    }
  }

  const defaultConfidence = input.confidence ?? 0.5

  for (const tc of input.toolCalls) {
    // Errored calls carry no proposal-worthy intent -- audit and skip.
    if (tc.status === 'error') {
      skipped.push({
        toolCallId: tc.id,
        name: tc.name,
        code: 'failed-call',
        reason: 'tool call errored; no intent to propose',
      })
      continue
    }

    switch (tc.name) {
      case 'knowledge.createNode': {
        // Pre-allocated target id derives from the tool-call id: ops in one
        // batch can reference each other, and re-running the same input
        // produces the same ids (idempotency).
        const nodeId = `${PROPOSED_NODE_PREFIX}${tc.id}`
        ops.push({
          type: 'node.create',
          target: { nodeId },
          payload: isRecord(tc.args) ? tc.args : {},
          confidence: defaultConfidence,
          reason: argString(tc.args, 'title') !== ''
            ? `agent proposes creating node '${argString(tc.args, 'title')}'`
            : 'agent proposes creating a node',
          ...(evidence.length > 0 ? { evidence } : {}),
        })
        break
      }
      case 'knowledge.createEdge': {
        ops.push({
          type: 'relation.create',
          target: { relationId: `${PROPOSED_RELATION_PREFIX}${tc.id}` },
          payload: isRecord(tc.args) ? tc.args : {},
          confidence: defaultConfidence,
          reason: 'agent proposes creating a relation',
          ...(evidence.length > 0 ? { evidence } : {}),
        })
        break
      }
      case 'knowledge.updateAttribute': {
        const nodeId = argString(tc.args, 'nodeId')
        if (nodeId === '') {
          skipped.push({
            toolCallId: tc.id,
            name: tc.name,
            code: 'missing-target',
            reason: 'node.update without a resolvable nodeId in args',
          })
          break
        }
        ops.push({
          type: 'node.update',
          target: { nodeId },
          payload: isRecord(tc.args) ? tc.args : {},
          confidence: defaultConfidence,
          reason: 'agent proposes updating node attributes',
          ...(evidence.length > 0 ? { evidence } : {}),
        })
        break
      }
      case 'knowledge.createCluster': {
        // Ruling Q1: NO fake mapping through relation.create. The frozen
        // ProposalOpType has no cluster kind -- skip with an auditable reason
        // and let the need go through a separate contract evolution.
        skipped.push({
          toolCallId: tc.id,
          name: tc.name,
          code: 'unsupported-operation',
          reason: 'unsupported-operation: cluster.create (frozen ProposalOpType has no cluster kind; separate evolution required)',
        })
        break
      }
      case 'knowledge.deriveClusters': {
        // Ruling Q-G4: derived operation -- never a proposal itself; its
        // products would surface through cluster proposals (see above).
        skipped.push({
          toolCallId: tc.id,
          name: tc.name,
          code: 'derived-operation',
          reason: 'derived operation (Q-G4): products would go through cluster proposals; no cluster kind exists yet',
        })
        break
      }
      default: {
        if (tc.name === 'llm.complete') break // consumed as evidence above
        skipped.push({
          toolCallId: tc.id,
          name: tc.name,
          code: 'unsupported-operation',
          reason: `no mapping for tool call '${tc.name}'`,
        })
      }
    }
  }

  // Proposal id: derived from the source so the same run rebuilds the same
  // proposal (idempotency key per contract).
  const id = input.source.kind === 'agent'
    ? `propose-${input.source.runId}`
    : `propose-${input.timestamp ?? maxTs(input.toolCalls)}`
  const timestamp = input.timestamp ?? maxTs(input.toolCalls)
  const opTypes = ops.map(op => op.type) as readonly ProposalOpType[]

  const proposal: KnowledgeWriteProposal = {
    id,
    source: input.source,
    agentId: input.agentId,
    timestamp,
    confidence: defaultConfidence,
    explanation:
      ops.length > 0
        ? `agent proposes ${ops.length} knowledge mutation(s): ${[...new Set(opTypes)].join(', ')}`
        : 'agent run produced no mappable knowledge mutations',
    ops: [...ops],
  }

  return { proposal, skipped }
}

/** Newest tool-call ts, so the default timestamp stays a pure function of input. */
function maxTs(toolCalls: readonly ToolCall[]): number {
  let max = 0
  for (const tc of toolCalls) max = Math.max(max, tc.ts)
  return max
}
