// Store mutation adapter — op -> domain entity mapping over a write port
// (P2-5 route A1, rulings D2/D4).
//
//   Applier --(KnowledgeMutationAdapter)--> THIS FILE --(KnowledgeWritePort)--> CanvasStore
//
// WHAT LIVES HERE (and why it is the right place)
// The op payload is NOT a domain entity: `node.create` carries
// `{ kind, title, ownerAgent, aiStatus }` while `KnowledgeNode` requires
// `{ id, kind, title, meta, position }`. Somebody has to fill that gap, and by
// ruling D4 the DEFAULTS live here -- as a small, explicit, testable table --
// rather than in the builder (which would need a contract change) or in the
// Applier (which must stay ignorant of domain shape).
//
// DEFAULTS (explicit, no blind payload spread):
//   id        <- the op target id (pre-allocated by the ProposalBuilder)
//   kind      <- payload.kind (required; kind policing is the entity contract's job)
//   title     <- payload.title (required)
//   meta      <- payload.meta if it is a string map, else {} (an empty meta is a
//                missing description, not a broken node)
//   position  <- placement strategy over the port's current node count (deterministic)
//   aiStatus / ownerAgent <- payload values when present (the Import Rule has
//                already guaranteed the AI markers on AI-sourced creates)
//   edge.kind <- payload.kind, defaulting to 'manual' (the domain's own default
//                for a relation that is not marked AI-generated)
//
// WHAT DOES NOT LIVE HERE: policy. No Import Rule, no approval, no review, no
// agent knowledge, no routing. Facts in, facts out -- the Applier still maps
// adapter facts to governance verdicts.
//
// Dependency direction: workflow --(op types)--> contracts, --(adapter types)-->
// knowledge/write, --(entities + port)--> types / this layer.
// Forbidden: agent, llm, mock, demo, components, react. The store is reached
// ONLY through the injected port, never imported.

import type { ProposalOp } from '../../contracts/knowledgeWrite'
import type {
  KnowledgeMutationAdapter,
  MutationFailureCode,
  MutationResult,
} from '../../knowledge/write/mutationAdapter'
import type { AiStatus, KnowledgeEdge, KnowledgeNode, NodeKind } from '../../types'
import type { EdgePatch, KnowledgeWritePort, NodePatch, WriteOutcome } from '../knowledgeWritePort'

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

export type PlacementStrategy = (index: number) => { readonly x: number; readonly y: number }

/**
 * Deterministic golden-angle spiral. No RNG, no clock: node `i` always lands on
 * the same spot, which keeps the whole write chain replayable.
 */
export const goldenAnglePlacement: PlacementStrategy = (index) => {
  const goldenAngle = 2.399963229728653
  const radius = 18 * Math.sqrt(index + 1)
  const angle = index * goldenAngle
  return {
    x: Math.round(radius * Math.cos(angle)),
    y: Math.round(radius * Math.sin(angle)),
  }
}

// ---------------------------------------------------------------------------
// Payload readers (no blind spread)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

function readStringMap(source: Record<string, unknown>, key: string): Record<string, string> | undefined {
  const value = source[key]
  if (!isRecord(value)) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}

function fail(code: MutationFailureCode, reason: string, existed?: boolean): MutationResult {
  return { ok: false, code, reason, ...(existed !== undefined ? { existed } : {}) }
}

function fromNodeOutcome(outcome: WriteOutcome<KnowledgeNode>): MutationResult {
  return outcome.existed
    ? { ok: false, code: 'duplicate-target', reason: `node '${outcome.before?.id ?? '?'}' already exists`, existed: true }
    : { ok: true, existed: false }
}

function fromEdgeOutcome(outcome: WriteOutcome<KnowledgeEdge>): MutationResult {
  return outcome.existed
    ? { ok: false, code: 'duplicate-target', reason: `relation '${outcome.before?.id ?? '?'}' already exists`, existed: true }
    : { ok: true, existed: false }
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export interface StoreMutationAdapterOptions {
  readonly port: KnowledgeWritePort
  /** Defaults to the deterministic golden-angle spiral. */
  readonly placement?: PlacementStrategy
}

export function createStoreMutationAdapter(
  options: StoreMutationAdapterOptions,
): KnowledgeMutationAdapter {
  const { port } = options
  const placement = options.placement ?? goldenAnglePlacement

  const buildNode = (op: ProposalOp, payload: Record<string, unknown>): KnowledgeNode | string => {
    const id = op.target.nodeId
    if (id === undefined || id === '') return 'node.create has no target id'
    const title = readString(payload, 'title')
    if (title === undefined) return 'node.create payload has no title'
    const kind = readString(payload, 'kind')
    if (kind === undefined) return 'node.create payload has no kind'

    const aiStatus = readString(payload, 'aiStatus')
    const ownerAgent = readString(payload, 'ownerAgent')

    return {
      id,
      // Kind policing belongs to the entity contract, not to the write chain: an
      // unknown kind shows up in the UI, whereas rejecting it here would invent
      // a second, weaker validator.
      kind: kind as NodeKind,
      title,
      meta: readStringMap(payload, 'meta') ?? {},
      position: placement(port.nodeCount()),
      ...(aiStatus !== undefined ? { aiStatus: aiStatus as AiStatus } : {}),
      ...(ownerAgent !== undefined ? { ownerAgent: ownerAgent as KnowledgeNode['ownerAgent'] } : {}),
    }
  }

  const buildEdge = (op: ProposalOp, payload: Record<string, unknown>): KnowledgeEdge | string => {
    const id = op.target.relationId
    if (id === undefined || id === '') return 'relation.create has no target id'
    const from = readString(payload, 'from')
    if (from === undefined) return 'relation.create payload has no from'
    const to = readString(payload, 'to')
    if (to === undefined) return 'relation.create payload has no to'
    const kind = readString(payload, 'kind')
    const reason = readString(payload, 'reason')

    return {
      id,
      from,
      to,
      // Domain default for a relation that is not marked AI-generated. The Import
      // Rule already forces 'ai-auto' on AI-sourced creates.
      kind: (kind === 'ai-auto' ? 'ai-auto' : 'manual'),
      ...(reason !== undefined ? { reason } : {}),
    }
  }

  const nodePatch = (payload: Record<string, unknown>): NodePatch => {
    const title = readString(payload, 'title')
    const meta = readStringMap(payload, 'meta')
    const aiStatus = readString(payload, 'aiStatus')
    const ownerAgent = readString(payload, 'ownerAgent')
    return {
      ...(title !== undefined ? { title } : {}),
      ...(meta !== undefined ? { meta } : {}),
      ...(aiStatus !== undefined ? { aiStatus: aiStatus as AiStatus } : {}),
      ...(ownerAgent !== undefined ? { ownerAgent: ownerAgent as KnowledgeNode['ownerAgent'] } : {}),
    }
  }

  const edgePatch = (payload: Record<string, unknown>): EdgePatch => {
    const from = readString(payload, 'from')
    const to = readString(payload, 'to')
    const reason = readString(payload, 'reason')
    const kind = readString(payload, 'kind')
    return {
      ...(from !== undefined ? { from } : {}),
      ...(to !== undefined ? { to } : {}),
      ...(reason !== undefined ? { reason } : {}),
      ...(kind === 'ai-auto' || kind === 'manual' ? { kind } : {}),
    }
  }

  return {
    applyOp(op: ProposalOp): MutationResult {
      try {
        const payload = op.payload
        if (!isRecord(payload)) {
          return fail('invalid-payload', `${op.type} payload is not a record`)
        }

        switch (op.type) {
          case 'node.create': {
            const node = buildNode(op, payload)
            if (typeof node === 'string') return fail('invalid-payload', node)
            return fromNodeOutcome(port.createNode(node))
          }
          case 'node.update': {
            const id = op.target.nodeId
            if (id === undefined || id === '') return fail('missing-target', 'node.update has no target id')
            const outcome = port.updateNode(id, nodePatch(payload))
            return outcome.existed
              ? { ok: true, existed: true, before: outcome.before }
              : fail('missing-target', `node '${id}' does not exist`, false)
          }
          case 'node.delete': {
            const id = op.target.nodeId
            if (id === undefined || id === '') return fail('missing-target', 'node.delete has no target id')
            const outcome = port.deleteNode(id)
            return outcome.existed
              ? { ok: true, existed: true, before: outcome.before }
              : fail('missing-target', `node '${id}' does not exist`, false)
          }
          case 'relation.create': {
            const edge = buildEdge(op, payload)
            if (typeof edge === 'string') return fail('invalid-payload', edge)
            return fromEdgeOutcome(port.createEdge(edge))
          }
          case 'relation.update': {
            const id = op.target.relationId
            if (id === undefined || id === '') return fail('missing-target', 'relation.update has no target id')
            const outcome = port.updateEdge(id, edgePatch(payload))
            return outcome.existed
              ? { ok: true, existed: true, before: outcome.before }
              : fail('missing-target', `relation '${id}' does not exist`, false)
          }
          case 'relation.delete': {
            const id = op.target.relationId
            if (id === undefined || id === '') return fail('missing-target', 'relation.delete has no target id')
            const outcome = port.deleteEdge(id)
            return outcome.existed
              ? { ok: true, existed: true, before: outcome.before }
              : fail('missing-target', `relation '${id}' does not exist`, false)
          }
          default:
            return fail('unsupported-op', `no mutation for op type '${String((op as { type?: unknown }).type)}'`)
        }
      } catch (error: unknown) {
        return fail('engine-error', error instanceof Error ? error.message : String(error))
      }
    },
  }
}
