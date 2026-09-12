// KnowledgeReadPort — the narrow READ-ONLY port the composition root uses for
// relation planning (P2-5 route B, ruling D5).
//
// WHY NOT REUSE `KnowledgeBackend`
// `KnowledgeBackend` is read-only by accident (F2 freeze), and it also carries
// methods that have nothing to do with planning -- and one (`importSource`) that
// *induces* a write. Handing that surface to planning would blur "read to plan"
// with "read to write". This port therefore declares ONLY what the frozen
// planning spec actually consumes:
//
//   nearest-2-by-layout-distance  ->  listNodes()   (ids + positions)
//
// NO `getNeighbors` yet. A port method with no consumer is exactly the R-6 trap
// (a surface nobody uses drifts silently); the method gets added when a spec
// needs it, through the same discipline as any other extension.
//
// Dependency direction: workflow -> here (a leaf: no imports from agent,
// knowledge/write, store or UI).

export interface KnowledgeReadNode {
  readonly id: string
  readonly title: string
  readonly position: { readonly x: number; readonly y: number }
}

/**
 * Everything planning is allowed to know about existing knowledge: what exists
 * and where it sits. No payloads, no relations, no history.
 */
export interface KnowledgeReadPort {
  listNodes(): Promise<readonly KnowledgeReadNode[]>
}

// ---------------------------------------------------------------------------
// Test double — an in-memory read port (probes and future unit tests)
// ---------------------------------------------------------------------------

export function createInMemoryReadPort(
  nodes: readonly KnowledgeReadNode[] = [],
): KnowledgeReadPort {
  const snapshot: readonly KnowledgeReadNode[] = nodes.map(node => ({
    id: node.id,
    title: node.title,
    position: { x: node.position.x, y: node.position.y },
  }))

  return {
    async listNodes(): Promise<readonly KnowledgeReadNode[]> {
      return snapshot
    },
  }
}
