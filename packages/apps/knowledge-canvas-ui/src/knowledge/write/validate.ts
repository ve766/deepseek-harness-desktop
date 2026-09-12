// Proposal validation — the static half of the Reviewer (P2-4.4.2).
//
// Pure structural governance: a malformed or inconsistent proposal is rejected
// BEFORE any question of applying it can arise. Structure-valid is NOT
// permission-to-write: this layer NEVER produces 'auto_apply' (ruling) -- the
// best it can say is 'needs_approval', because semantic legitimacy (Import
// Rule, privacy, before-state snapshot) lives in the Applier layer (P2-4.4.3),
// which is the side with store access.
//
// Pure function: same proposal in, same ReviewResult out. No I/O, no store, no
// LLM, no events, no Date.now.
//
// Dependency direction: knowledge/write -> contracts (type only) + sibling
// constants from ./proposalBuilder (re-exported prefixes -- copied literals
// would drift from the builder and silently break the convention).
// Forbidden: store, llm, agent, activity, mock, demo, components, react.

import type {
  KnowledgeWriteProposal,
  ReviewResult,
  ReviewVerdict,
} from '../../contracts/knowledgeWrite'
import {
  PROPOSED_NODE_PREFIX,
  PROPOSED_RELATION_PREFIX,
} from './proposalBuilder'

/** Proposal-level checks use this pseudo-index (op checks use the op index). */
const PROPOSAL_INDEX = -1

const PROPOSAL_ID_PREFIX = 'propose-'
const EVIDENCE_KINDS = new Set(['node', 'doc', 'chunk', 'event', 'text'])

function verdict(
  index: number,
  ok: boolean,
  code?: ReviewVerdict['code'],
  reason?: string,
): ReviewVerdict {
  return {
    index,
    ok,
    ...(code !== undefined ? { code } : {}),
    ...(reason !== undefined ? { reason } : {}),
  }
}

/** Non-empty string helper. */
function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function isPreAllocated(id: string): boolean {
  return id.startsWith(PROPOSED_NODE_PREFIX) || id.startsWith(PROPOSED_RELATION_PREFIX)
}

// ---------------------------------------------------------------------------
// 1. id 校验
// ---------------------------------------------------------------------------

function checkId(p: KnowledgeWriteProposal): ReviewVerdict {
  if (!nonEmpty(p.id)) {
    return verdict(PROPOSAL_INDEX, false, 'schema', 'proposal.id is empty')
  }
  if (!p.id.startsWith(PROPOSAL_ID_PREFIX)) {
    return verdict(PROPOSAL_INDEX, false, 'schema', `proposal.id must start with '${PROPOSAL_ID_PREFIX}' (builder convention)`)
  }
  return verdict(PROPOSAL_INDEX, true)
}

// ---------------------------------------------------------------------------
// 2. source 校验
// ---------------------------------------------------------------------------

function checkSource(p: KnowledgeWriteProposal): ReviewVerdict {
  const s = p.source
  if (s.kind === 'agent') {
    if (!nonEmpty(s.runId)) {
      return verdict(PROPOSAL_INDEX, false, 'schema', 'agent source requires a non-empty runId')
    }
    if (s.agentId !== p.agentId) {
      return verdict(PROPOSAL_INDEX, false, 'schema', `source.agentId '${s.agentId}' does not match proposal.agentId '${p.agentId}'`)
    }
    return verdict(PROPOSAL_INDEX, true)
  }
  if (s.kind === 'ingestion') {
    if (!nonEmpty(s.docId)) {
      return verdict(PROPOSAL_INDEX, false, 'schema', 'ingestion source requires a non-empty docId')
    }
    return verdict(PROPOSAL_INDEX, true)
  }
  if (s.kind === 'user') {
    return verdict(PROPOSAL_INDEX, true)
  }
  return verdict(PROPOSAL_INDEX, false, 'schema', 'unknown source kind')
}

// ---------------------------------------------------------------------------
// 3. target 校验（逐 op）+ 4. evidence 校验（逐 op）
// ---------------------------------------------------------------------------

function checkTarget(op: ProposalOpLike, index: number): ReviewVerdict | null {
  const nodeId = op.target.nodeId
  const relationId = op.target.relationId

  switch (op.type) {
    case 'node.create': {
      if (!nonEmpty(nodeId) || !nodeId.startsWith(PROPOSED_NODE_PREFIX)) {
        return verdict(index, false, 'schema', `node.create requires a pre-allocated target nodeId ('${PROPOSED_NODE_PREFIX}*' convention)`)
      }
      return null
    }
    case 'relation.create': {
      if (!nonEmpty(relationId) || !relationId.startsWith(PROPOSED_RELATION_PREFIX)) {
        return verdict(index, false, 'schema', `relation.create requires a pre-allocated target relationId ('${PROPOSED_RELATION_PREFIX}*' convention)`)
      }
      return null
    }
    case 'node.update':
    case 'node.delete': {
      // update/delete can only target an EXISTING entity -- never a
      // pre-allocated id from this batch (create-then-update must be merged
      // into one create by the builder/agent).
      if (!nonEmpty(nodeId)) {
        return verdict(index, false, 'schema', `${op.type} requires a target nodeId`)
      }
      if (isPreAllocated(nodeId)) {
        return verdict(index, false, 'schema', `${op.type} must target an existing node, not a pre-allocated id '${nodeId}'`)
      }
      return null
    }
    case 'relation.update':
    case 'relation.delete': {
      if (!nonEmpty(relationId)) {
        return verdict(index, false, 'schema', `${op.type} requires a target relationId`)
      }
      if (isPreAllocated(relationId)) {
        return verdict(index, false, 'schema', `${op.type} must target an existing relation, not a pre-allocated id '${relationId}'`)
      }
      return null
    }
    default:
      return verdict(index, false, 'schema', `unknown op type '${String((op as { type?: unknown }).type)}'`)
  }
}

function checkEvidence(op: ProposalOpLike, index: number): ReviewVerdict | null {
  if (op.evidence === undefined) return null
  for (const ref of op.evidence) {
    if (!EVIDENCE_KINDS.has(ref.kind)) {
      return verdict(index, false, 'schema', `evidence kind '${String(ref.kind)}' is not in the contract vocabulary`)
    }
    if (ref.kind === 'text') {
      if (!nonEmpty(ref.excerpt)) {
        return verdict(index, false, 'schema', 'text evidence excerpt is empty')
      }
      continue
    }
    if (ref.kind === 'event') {
      if (typeof ref.seq !== 'number' || !Number.isInteger(ref.seq) || ref.seq < 0) {
        return verdict(index, false, 'schema', 'event evidence seq must be a non-negative integer')
      }
      continue
    }
    if (!nonEmpty(ref.id)) {
      return verdict(index, false, 'schema', `${ref.kind} evidence id is empty`)
    }
  }
  return null
}

/** Structural shape the validator reads -- mirrors the contract (read-only). */
interface ProposalOpLike {
  readonly type: string
  readonly target: { readonly nodeId?: string; readonly relationId?: string }
  readonly confidence: unknown
  readonly evidence?: readonly {
    readonly kind: string
    readonly id?: string
    readonly seq?: number
    readonly excerpt?: string
  }[]
}

// ---------------------------------------------------------------------------
// 5. ops 完整性校验（批级）
// ---------------------------------------------------------------------------

function checkBatchIntegrity(p: KnowledgeWriteProposal, verdicts: ReviewVerdict[]): void {
  if (p.ops.length === 0) {
    verdicts.push(verdict(PROPOSAL_INDEX, false, 'schema', 'proposal has no ops'))
    return
  }
  // Pre-allocated ids must be unique across the batch: a duplicate would make
  // two ops mutate the same not-yet-existing entity.
  const seen = new Set<string>()
  for (let i = 0; i < p.ops.length; i++) {
    const op = p.ops[i]
    const id = op.target.nodeId ?? op.target.relationId
    if (id === undefined) continue
    if (seen.has(id)) {
      // NOTE: 'conflict' is an APPLY-time code (ApplyCode). At review time the
      // duplicate is a batch-schema violation, so the code is 'schema' -- the
      // same problem would surface as 'conflict' if it somehow reached apply.
      verdicts.push(verdict(i, false, 'schema', `duplicate pre-allocated id '${id}' within the batch`))
    } else {
      seen.add(id)
    }
  }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/**
 * Validate the structural integrity of a proposal. NEVER produces 'auto_apply':
 * structure-valid only justifies 'needs_approval' -- the knowledge space is
 * modified by the Applier alone, after semantic checks that require store access.
 */
export function validateProposal(p: KnowledgeWriteProposal): ReviewResult {
  const verdicts: ReviewVerdict[] = []

  verdicts.push(checkId(p))
  verdicts.push(checkSource(p))

  // Batch-level completeness first (empty ops / duplicates), then per-op.
  checkBatchIntegrity(p, verdicts)

  for (let i = 0; i < p.ops.length; i++) {
    const op = p.ops[i]
    const targetVerdict = checkTarget(op, i)
    if (targetVerdict !== null) {
      verdicts.push(targetVerdict)
      continue // a broken target invalidates further op-level checks
    }
    const evidenceVerdict = checkEvidence(op, i)
    if (evidenceVerdict !== null) {
      verdicts.push(evidenceVerdict)
    }
  }

  // Ruling: structure-valid != permission-to-write. auto_apply is never
  // produced by this layer.
  const decision = verdicts.every(v => v.ok) ? 'needs_approval' : 'reject'
  return { proposalId: p.id, decision, verdicts }
}
