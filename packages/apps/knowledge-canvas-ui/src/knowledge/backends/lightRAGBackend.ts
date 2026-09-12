import type {
  KnowledgeBackend,
  KnowledgeNode,
  KnowledgeEdge,
  SourceRef,
  MemoryEntry,
  AgentId,
} from '../../types'
import type { LightRAGClient } from './lightragClient'
import { entityToNode, relationToEdge, sourceRefToId } from './lightragMapping'
import { ingestSource } from '../ingestion/ingestion'

// `LightRAGBackend` is an adapter: it makes LightRAG look like a
// `KnowledgeBackend` so the rest of the app (canvas store, SharedKnowledgeSpace,
// Employee lenses) is completely unaware of LightRAG. This is the single seam
// allowed by R6 — LightRAG lives ONLY behind this implementation; it never
// appears in `../../types`, the UI, or the Employee model.
//
// R5: Memory is delegated to an injected `memoryProvider` and is NEVER written
// into the graph. Memory / Capability / Knowledge stay orthogonal.

export interface MemoryProvider {
  getMemory(): Promise<MemoryEntry[]>
}

export interface LightRAGBackendOptions {
  client: LightRAGClient
  memoryProvider: MemoryProvider
}

export class LightRAGBackend implements KnowledgeBackend {
  private client: LightRAGClient
  private memoryProvider: MemoryProvider
  /** D3: sourceId -> ownerAgent side-map (the KG has no native owner field). */
  private ownerBySource = new Map<string, AgentId>()

  constructor(opts: LightRAGBackendOptions) {
    this.client = opts.client
    this.memoryProvider = opts.memoryProvider
  }

  async listNodes(): Promise<KnowledgeNode[]> {
    const entities = await this.client.getEntities()
    return entities.map((e) => {
      const owner = this.ownerBySource.get(e.source_ids[0] ?? '')
      return entityToNode(e, { ownerAgent: owner })
    })
  }

  async listEdges(): Promise<KnowledgeEdge[]> {
    const relations = await this.client.getRelations()
    return relations.map(relationToEdge)
  }

  async importSource(src: SourceRef): Promise<{ nodeId: string }> {
    return this.importSourceAs(src, undefined)
  }

  /** Interface-external extension (D3): tag the imported source with an owner
   *  WITHOUT changing the `KnowledgeBackend` contract. UI only ever sees the 5
   *  methods; owner attribution is a backend-internal concern. */
  async importSourceAs(src: SourceRef, ownerAgent?: AgentId): Promise<{ nodeId: string }> {
    const sourceId = sourceRefToId(src)
    if (ownerAgent) this.ownerBySource.set(sourceId, ownerAgent)
    // Stage 8: route through the ingestion layer (SourceRef → normalized text).
    // Scrapling/PDF/GitHub extraction happens there, never in this adapter.
    const doc = await ingestSource(src, { ownerAgent })
    await this.client.insert(doc.content, sourceId)
    return { nodeId: sourceId }
  }

  async getNeighbors(
    nodeId: string,
    text: string,
  ): Promise<{ nodeId: string; score: number; reason: string }[]> {
    const [graphNeighbors, queryHits] = await Promise.all([
      this.client.getGraphNeighbors(nodeId),
      text ? this.client.query(text) : Promise.resolve([]),
    ])
    const queryScore = new Map(queryHits.map(h => [h.entity, h.score]))
    const results = graphNeighbors.map((n) => {
      const q = queryScore.get(n.target) ?? 0
      // graph proximity (0.5) + query relevance (if any) -> score in [0,1]
      const score = Math.min(1, 0.5 + q)
      return { nodeId: n.target, score, reason: n.relation }
    })
    // No graph neighbours but the query produced hits -> surface those.
    if (results.length === 0 && queryHits.length > 0) {
      return queryHits.map(h => ({ nodeId: h.entity, score: h.score, reason: 'query match' }))
    }
    return results.sort((a, b) => b.score - a.score).slice(0, 12)
  }

  /**
   * S13-A (OB seam): free-form semantic retrieval across the WHOLE graph, not
   * anchored to a seed node. Interface-external (optional) — does NOT change the
   * `KnowledgeBackend` 5-method contract. Mirrors the query fusion inside
   * `getNeighbors` but without a seed, so Nox can retrieve grounding for an
   * arbitrary question. MockBackend lacks this method (returns unsupported);
   * that is exactly the graceful-degradation path the UI handles.
   */
  async query(text: string): Promise<{ nodeId: string; score: number; reason: string }[]> {
    if (!text) return []
    const hits = await this.client.query(text)
    return hits.map(h => ({ nodeId: h.entity, score: h.score, reason: 'query match' }))
  }

  async getMemory(): Promise<MemoryEntry[]> {
    // R5: delegate, never read from the graph.
    return this.memoryProvider.getMemory()
  }
}
