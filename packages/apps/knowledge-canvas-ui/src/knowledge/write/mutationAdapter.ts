// KnowledgeMutationAdapter — the MECHANICAL half of the write-governance chain
// (P2-4.4.3 Step 1).
//
// Layer position (frozen):
//
//   Applier                  governance: review re-check, Import Rule, verdicts,
//     |                      receipt, snapshot bookkeeping
//     v
//   KnowledgeMutationAdapter  mechanical: one op in -> one result out
//     |
//     v
//   Store                    future: Zustand / SQLite / vector db / plugin runtime
//
// ---------------------------------------------------------------------------
// What this layer IS
// ---------------------------------------------------------------------------
// - A per-op mutation surface: `applyOp(op) -> MutationResult`. ONE op, no batch.
// - The minimal reader of PRE-mutation state (`MutationResult.before`), which is
//   the raw material the Applier's snapshot/undoToken bookkeeping consumes. The
//   adapter captures it because only the side holding the store can.
//
// ---------------------------------------------------------------------------
// What this layer is NOT (ruling D2/D3/D5, frozen: do not extend here)
// ---------------------------------------------------------------------------
// - NO transaction, NO batch apply, NO rollback, NO automatic compensation.
//   The chain is partial-apply by ruling: `applied + failed === ops.length` is
//   the Applier's invariant, and it can only hold if single ops are independent.
// - NO undo restore. `before` is returned data; replaying it is a separate
//   capability that does not exist in P2-4.4.3.
// - NO store wiring, NO DB/vector migration here. `InMemoryMutationAdapter` is
//   a TEST double; the store-backed implementation is a later step.
// - NO understanding of Agent / LLM / Router / Approval / Import Rule. The
//   adapter never reads `op.confidence`, `op.reason` or `op.evidence`, and it
//   never decides whether an op is ALLOWED. Policy lives in the Applier.
//
// ---------------------------------------------------------------------------
// Why the failure vocabulary is LOCAL, not the contract ApplyCode
// ---------------------------------------------------------------------------
// `ApplyCode` carries governance verdicts ('import_rule', 'privacy', 'stale',
// 'conflict') that only the Applier can derive. Reporting them from here would
// put policy inside the mechanical layer and make the adapter unusable by any
// caller that is not this Applier. The adapter therefore reports FACTS
// (`MutationFailureCode`) and the Applier maps fact -> verdict.
//
// Dependency direction: knowledge/write -> contracts (type only).
// Forbidden: store, llm, agent, activity, mock, demo, components, react.

import type { ProposalOp } from '../../contracts/knowledgeWrite'

// ---------------------------------------------------------------------------
// Result vocabulary (mechanical facts, NOT governance verdicts)
// ---------------------------------------------------------------------------

export type MutationFailureCode =
  /** update/delete: the target id is absent from the store. */
  | 'missing-target'
  /** create: the target id is already occupied. */
  | 'duplicate-target'
  /** op type outside the frozen ProposalOpType vocabulary (unreachable via validate). */
  | 'unsupported-op'
  /** payload is not a plain record, so nothing can be stored. */
  | 'invalid-payload'
  /** the underlying store implementation threw. */
  | 'engine-error'

export interface MutationResult {
  readonly ok: boolean
  readonly code?: MutationFailureCode
  readonly reason?: string
  /**
   * Did the target exist in its namespace BEFORE this op?
   *
   * This is a FACT the adapter observed, not a policy: it is what makes the
   * pre-state of a CREATE expressible at all. Without it, "no `before` payload"
   * would be ambiguous between "the target did not exist" and "we did not look",
   * and a create-only batch would look non-reversible.
   *
   * Omitted only when existence was never established (missing target id, an
   * unstorable payload, an unsupported op type, a store that threw).
   * Reporting it does NOT imply any restore capability: there is no inverse op,
   * no delete-on-undo, no reclaim and no rollback anywhere in this layer.
   */
  readonly existed?: boolean
  /**
   * Pre-mutation state of the target as seen AT APPLY TIME (absent => target did
   * not exist, e.g. a create). Returned, not stored: whether to keep it, and
   * under which undoToken, is the Applier's decision (D2).
   *
   * NOTE: this is a SHALLOW copy. Nested objects are shared with the store, so a
   * deep snapshot is explicitly NOT promised in P2-4.4.3.
   */
  readonly before?: unknown
}

/**
 * The mutation boundary. Deliberately a SINGLE method: batch semantics (order,
 * dependency, partial-apply accounting) are governance and live in the Applier.
 */
export interface KnowledgeMutationAdapter {
  applyOp(op: ProposalOp): MutationResult
}

// ---------------------------------------------------------------------------
// In-memory adapter — TEST DOUBLE ONLY
// ---------------------------------------------------------------------------

/** Seed entry for the test double: an id plus its opaque payload. */
export interface InMemorySeedEntry {
  readonly id: string
  readonly payload: unknown
}

export interface InMemoryMutationAdapterOptions {
  readonly nodes?: readonly InMemorySeedEntry[]
  readonly relations?: readonly InMemorySeedEntry[]
}

/**
 * Test double. Payloads are treated as OPAQUE records: the adapter never reads
 * domain fields out of them (no title/kind/endpoint interpretation), so it stays
 * free of knowledge semantics. It only guarantees id bookkeeping.
 *
 * Known limitation (documented, not hidden): endpoints referenced by a relation
 * payload are NOT checked for existence, because the payload endpoint key
 * convention is not frozen anywhere yet. See Review Node question D-1.
 */
export interface InMemoryMutationAdapter extends KnowledgeMutationAdapter {
  /** Test inspection only: a detached shallow copy of both namespaces. */
  dump(): { readonly nodes: Record<string, unknown>; readonly relations: Record<string, unknown> }
  has(id: string): boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(code: MutationFailureCode, reason: string, existed?: boolean): MutationResult {
  return { ok: false, code, reason, ...(existed !== undefined ? { existed } : {}) }
}

export function createInMemoryMutationAdapter(
  options: InMemoryMutationAdapterOptions = {},
): InMemoryMutationAdapter {
  const nodes = new Map<string, Record<string, unknown>>()
  const relations = new Map<string, Record<string, unknown>>()

  const seed = (target: Map<string, Record<string, unknown>>, entries?: readonly InMemorySeedEntry[]): void => {
    for (const entry of entries ?? []) {
      target.set(entry.id, isRecord(entry.payload) ? { ...entry.payload } : {})
    }
  }
  seed(nodes, options.nodes)
  seed(relations, options.relations)

  const created = (
    target: Map<string, Record<string, unknown>>,
    id: string | undefined,
    payload: unknown,
  ): MutationResult => {
    if (id === undefined || id === '') return fail('missing-target', 'create op has no target id')
    if (!isRecord(payload)) return fail('invalid-payload', 'create op payload is not a record')
    if (target.has(id)) return fail('duplicate-target', `'${id}' already exists`, true)
    target.set(id, { ...payload })
    // A successful create ALWAYS reports existed:false -- that is the whole
    // pre-state of a creation, and the reason no `before` payload is returned.
    return { ok: true, existed: false }
  }

  const updated = (
    target: Map<string, Record<string, unknown>>,
    id: string | undefined,
    payload: unknown,
  ): MutationResult => {
    if (id === undefined || id === '') return fail('missing-target', 'update op has no target id')
    if (!isRecord(payload)) return fail('invalid-payload', 'update op payload is not a record')
    const current = target.get(id)
    if (current === undefined) return fail('missing-target', `'${id}' does not exist`, false)
    const before = { ...current }
    target.set(id, { ...current, ...payload })
    return { ok: true, existed: true, before }
  }

  const deleted = (
    target: Map<string, Record<string, unknown>>,
    id: string | undefined,
  ): MutationResult => {
    if (id === undefined || id === '') return fail('missing-target', 'delete op has no target id')
    const current = target.get(id)
    if (current === undefined) return fail('missing-target', `'${id}' does not exist`, false)
    const before = { ...current }
    target.delete(id)
    return { ok: true, existed: true, before }
  }

  return {
    applyOp(op: ProposalOp): MutationResult {
      const nodeId = op.target.nodeId
      const relationId = op.target.relationId

      switch (op.type) {
        case 'node.create':
          return created(nodes, nodeId, op.payload)
        case 'node.update':
          return updated(nodes, nodeId, op.payload)
        case 'node.delete':
          return deleted(nodes, nodeId)
        case 'relation.create':
          return created(relations, relationId, op.payload)
        case 'relation.update':
          return updated(relations, relationId, op.payload)
        case 'relation.delete':
          return deleted(relations, relationId)
        default:
          // Unreachable through the Applier (validate rejects unknown types);
          // kept so a hand-built op fails as a Fact instead of throwing.
          return fail(
            'unsupported-op',
            `no mutation for op type '${String((op as { type?: unknown }).type)}'`,
          )
      }
    },

    dump(): { readonly nodes: Record<string, unknown>; readonly relations: Record<string, unknown> } {
      return { nodes: Object.fromEntries(nodes), relations: Object.fromEntries(relations) }
    },

    has(id: string): boolean {
      return nodes.has(id) || relations.has(id)
    },
  }
}
