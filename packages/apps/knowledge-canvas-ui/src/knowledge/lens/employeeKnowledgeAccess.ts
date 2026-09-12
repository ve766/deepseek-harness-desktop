// Stage 9 (D1): Additive sibling of `EmployeeKnowledgeLens`.
//
// `EmployeeKnowledgeLens` (knowledgeUniverse.ts) is preserved untouched with its
// `canWrite: false` literal — Stage 4/7/8 assertions depend on it. This new
// `EmployeeKnowledgeAccess` adds the read projection + contribution seam WITHOUT
// modifying the old type (zero regression).
//
// Every read delegates to the `KnowledgeBackend` 5 methods (no caching, no copy,
// no write-back): the lens is a PROJECTION of the single Shared Universe (D2).
// It imports only the `KnowledgeBackend` interface type + `AgentId`/`SourceRef`/
// `MemoryCategory` — never a concrete backend, never LightRAG*, never Employee UI.

import type {
  AgentId,
  KnowledgeBackend,
  KnowledgeNode,
  MemoryCategory,
  MemoryEntry,
  SourceRef,
} from '../../types'
import {
  resolvePermission,
  contribute,
  retrieve,
  type ContributionResult,
  type KnowledgePermission,
  type RetrieveResult,
} from './knowledgeAccess'

/** Neighbor hit returned by the lens query wrapper (mirrors backend getNeighbors). */
export interface NeighborHit {
  nodeId: string
  score: number
  reason: string
}

export interface QueryOptions {
  /** Restrict hits to nodes owned by this employee (lens-side filter; D3-c). */
  scope?: 'owned' | 'all'
}

/**
 * Full read + contribution surface for one employee. Backed by the shared
 * `KnowledgeBackend` instance; holds no node copy.
 */
export interface EmployeeKnowledgeAccess {
  readonly agentId: AgentId
  readonly permission: KnowledgePermission
  /** Derived: 'read' → false; 'contribute'|'own' → true. */
  readonly canWrite: boolean

  /** L1: nodes contributed/owned by this employee (ownerAgent === agentId). */
  listOwned(): Promise<KnowledgeNode[]>
  /** L0: all nodes (Shared Universe is globally readable, D2-A). */
  listAll(): Promise<KnowledgeNode[]>
  /** L2/existing-query-wrapper: neighbor query for a seed node (D3-c; no free search). */
  query(seedNodeId: string, text: string, opts?: QueryOptions): Promise<NeighborHit[]>
  /**
   * S13-A (Nox research): retrieve knowledge context for a FREE-FORM question.
   * Read-only; no LLM call here (the LLM answer is produced by the Nox research UI
   * via the `LlmClient` abstraction). Delegates to the `retrieve` seam, so a
   * backend without `query` (MockBackend) returns
   * `{ ok: false, reason: 'backend-unsupported' }` — Nox still runs its flow, just
   * without retrieved grounding. This keeps "LLM available != Knowledge connected".
   */
  researchQuery(text: string): Promise<RetrieveResult>
  /** Memory as user-context, optionally filtered by category (R5: user-owned, read-only). */
  memory(category?: MemoryCategory): Promise<MemoryEntry[]>
  /** Backward-compatible read-only summary (same shape as EmployeeKnowledgeLens). */
  summary(): Promise<{
    agentId: AgentId
    nodeCount: number
    edgeCount: number
    ownedNodeIds: readonly string[]
    canWrite: false
  }>
  /** Contribute a source (gated; D6 seam, Stage 9 does not auto-confirm). */
  contribute(src: SourceRef): Promise<ContributionResult>
}

export function createEmployeeKnowledgeAccess(
  agentId: AgentId,
  backend: KnowledgeBackend,
): EmployeeKnowledgeAccess {
  const permission = resolvePermission(agentId)
  const canWrite = permission !== 'read'

  async function listOwned(): Promise<KnowledgeNode[]> {
    const nodes = await backend.listNodes()
    return nodes.filter(n => n.ownerAgent === agentId)
  }

  async function listAll(): Promise<KnowledgeNode[]> {
    return await backend.listNodes()
  }

  async function query(
    seedNodeId: string,
    text: string,
    opts?: QueryOptions,
  ): Promise<NeighborHit[]> {
    const hits = await backend.getNeighbors(seedNodeId, text)
    if (opts?.scope === 'owned') {
      const owned = new Set((await listOwned()).map(n => n.id))
      return hits.filter(h => owned.has(h.nodeId))
    }
    return hits
  }

  /**
   * S13-A (Nox research): retrieve grounding context for a free-form question.
   * Delegates to the `retrieve` seam over the shared backend; MockBackend has no
   * `query` capability so it returns `{ ok: false, reason: 'backend-unsupported' }`.
   */
  async function researchQuery(text: string): Promise<RetrieveResult> {
    return retrieve(backend, text)
  }

  async function memory(category?: MemoryCategory): Promise<MemoryEntry[]> {
    const all = await backend.getMemory()
    return category ? all.filter(m => m.category === category) : all
  }

  async function summary() {
    const [owned, edges] = await Promise.all([listOwned(), backend.listEdges()])
    return {
      agentId,
      nodeCount: owned.length,
      edgeCount: edges.length,
      ownedNodeIds: owned.map(n => n.id),
      canWrite: false,
    }
  }

  return {
    agentId,
    permission,
    canWrite,
    listOwned,
    listAll,
    query,
    researchQuery,
    memory,
    summary,
    contribute: (src: SourceRef) => contribute(backend, src, agentId),
  }
}
