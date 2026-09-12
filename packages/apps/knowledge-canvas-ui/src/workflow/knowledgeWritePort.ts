// KnowledgeWritePort — the persistence seam for governed knowledge writes
// (P2-5 route A1, ruling D2).
//
//   Applier  ->  KnowledgeMutationAdapter   (contract-shaped: applyOp -> MutationResult)
//                     |  implemented by
//                store mutation adapter      (op -> domain entity mapping + D4 defaults)
//                     |  writes through
//                KnowledgeWritePort          (THIS FILE: the persistence seam)
//                     |  implemented by
//                CanvasStore write port      (the only file that touches the store)
//
// WHY A PORT AND NOT `KnowledgeBackend`
// `KnowledgeBackend` is the READ interface (F2 freeze: listNodes/listEdges/
// importSource/getNeighbors/getMemory) and has no write method at all. Extending
// it would mean touching a frozen contract; declaring a separate write seam keeps
// the two directions independent and lets a future persistence target (SQLite,
// vector db, plugin runtime) implement the same port without the Applier -- or
// the contract -- noticing.
//
// WRITE METHODS REPORT PRE-STATE FACTS
// Every method returns `{ existed, before? }`: the mechanical answer to "what was
// there before?". That is what the Applier needs for its snapshot slot (it must
// not query the store itself), and it keeps this port strictly write-only (no
// read surface beyond the placement count).
//
// SYNCHRONOUS BY DESIGN -- AND THAT IS A REAL LIMIT
// `KnowledgeMutationAdapter.applyOp` is synchronous (P2-4.4.3), and the Applier's
// `apply` loop is written against it. A synchronous port is therefore the only
// shape that can be plugged in today. An asynchronous backend (SQLite, an HTTP
// store) CANNOT be integrated without renegotiating the adapter contract -- that
// is recorded as a finding in the P2-5 A1 review, not worked around here (a
// sync-looking API over an async store would be a lie).

import type { AiStatus, KnowledgeEdge, KnowledgeNode, NodeKind } from '../types'

/** Facts returned by every write, so the caller can snapshot without reading. */
export interface WriteOutcome<TBefore> {
  /** Did the target exist before the write? */
  readonly existed: boolean
  /** Pre-state (shallow copy). Absent when nothing existed. */
  readonly before?: TBefore
}

/** Explicit patch surface: only fields the write chain is allowed to change. */
export interface NodePatch {
  readonly title?: string
  readonly meta?: Record<string, string>
  readonly aiStatus?: AiStatus
  readonly ownerAgent?: KnowledgeNode['ownerAgent']
}

export interface EdgePatch {
  readonly kind?: KnowledgeEdge['kind']
  readonly reason?: string
  readonly from?: string
  readonly to?: string
}

export interface KnowledgeWritePort {
  /** Current node count. Used ONLY to allocate a deterministic placement. */
  nodeCount(): number

  /** Fails as a fact (existed: true) when the id is occupied -- never overwrites. */
  createNode(node: KnowledgeNode): WriteOutcome<KnowledgeNode>
  updateNode(id: string, patch: NodePatch): WriteOutcome<KnowledgeNode>
  deleteNode(id: string): WriteOutcome<KnowledgeNode>

  createEdge(edge: KnowledgeEdge): WriteOutcome<KnowledgeEdge>
  updateEdge(id: string, patch: EdgePatch): WriteOutcome<KnowledgeEdge>
  deleteEdge(id: string): WriteOutcome<KnowledgeEdge>
}

// ---------------------------------------------------------------------------
// Test double — an in-memory write port (probes and unit tests of the mapping)
// ---------------------------------------------------------------------------

export function createInMemoryWritePort(
  seedNodes: readonly KnowledgeNode[] = [],
  seedEdges: readonly KnowledgeEdge[] = [],
): KnowledgeWritePort {
  const nodes = new Map<string, KnowledgeNode>()
  const edges = new Map<string, KnowledgeEdge>()
  for (const node of seedNodes) nodes.set(node.id, { ...node, position: { ...node.position } })
  for (const edge of seedEdges) edges.set(edge.id, { ...edge })

  const cloneNode = (node: KnowledgeNode): KnowledgeNode => ({ ...node, position: { ...node.position } })

  return {
    nodeCount: () => nodes.size,

    createNode(node: KnowledgeNode): WriteOutcome<KnowledgeNode> {
      if (nodes.has(node.id)) return { existed: true, before: cloneNode(nodes.get(node.id) as KnowledgeNode) }
      nodes.set(node.id, cloneNode(node))
      return { existed: false }
    },

    updateNode(id: string, patch: NodePatch): WriteOutcome<KnowledgeNode> {
      const current = nodes.get(id)
      if (current === undefined) return { existed: false }
      const before = cloneNode(current)
      const next: KnowledgeNode = {
        ...current,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.meta !== undefined ? { meta: { ...patch.meta } } : {}),
        ...(patch.aiStatus !== undefined ? { aiStatus: patch.aiStatus } : {}),
        ...(patch.ownerAgent !== undefined ? { ownerAgent: patch.ownerAgent } : {}),
      }
      nodes.set(id, next)
      return { existed: true, before }
    },

    deleteNode(id: string): WriteOutcome<KnowledgeNode> {
      const current = nodes.get(id)
      if (current === undefined) return { existed: false }
      const before = cloneNode(current)
      nodes.delete(id)
      for (const edge of [...edges.values()]) {
        if (edge.from === id || edge.to === id) edges.delete(edge.id)
      }
      return { existed: true, before }
    },

    createEdge(edge: KnowledgeEdge): WriteOutcome<KnowledgeEdge> {
      if (edges.has(edge.id)) return { existed: true, before: { ...(edges.get(edge.id) as KnowledgeEdge) } }
      edges.set(edge.id, { ...edge })
      return { existed: false }
    },

    updateEdge(id: string, patch: EdgePatch): WriteOutcome<KnowledgeEdge> {
      const current = edges.get(id)
      if (current === undefined) return { existed: false }
      const before = { ...current }
      const next: KnowledgeEdge = {
        ...current,
        ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
        ...(patch.reason !== undefined ? { reason: patch.reason } : {}),
        ...(patch.from !== undefined ? { from: patch.from } : {}),
        ...(patch.to !== undefined ? { to: patch.to } : {}),
      }
      edges.set(id, next)
      return { existed: true, before }
    },

    deleteEdge(id: string): WriteOutcome<KnowledgeEdge> {
      const current = edges.get(id)
      if (current === undefined) return { existed: false }
      const before = { ...current }
      edges.delete(id)
      return { existed: true, before }
    },
  }
}
