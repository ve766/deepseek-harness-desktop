// LightRAG client abstraction — the bridge between the TS-side `LightRAGBackend`
// and a LightRAG engine.
//
// LightRAG is a Python library; this interface is the ONLY contract the backend
// depends on, so the concrete engine (an in-memory mirror now, a real
// `lightrag-server` over HTTP in Phase 1) can be swapped WITHOUT touching the
// `KnowledgeBackend` interface, the canvas store, the UI, or the Employee model.
//
// ISOLATION (R6): these types are intentionally NOT exported from `../types`.
// No core knowledge model, UI, Employee code, or Rail/Nav code may import them.

export interface LightRAGEntity {
  entity_name: string
  entity_type: string
  description: string
  source_ids: string[]
  meta?: Record<string, string>
}

export interface LightRAGRelation {
  src_id: string
  tgt_id: string
  description: string
  /** 1..10, mirrors LightRAG edge weight. */
  weight: number
}

export type LightRAGQueryMode = 'local' | 'global' | 'hybrid' | 'naive' | 'mix'

export interface LightRAGQueryHit {
  entity: string
  score: number
}

export interface LightRAGGraphNeighbor {
  target: string
  relation: string
}

export interface LightRAGClient {
  /** Ingest a document's text under a stable source id (the source node id). */
  insert(content: string, sourceId: string): Promise<void>
  /** LightRAG-style retrieval over the graph + vector index. */
  query(text: string, mode?: LightRAGQueryMode): Promise<LightRAGQueryHit[]>
  /** All entities currently in the graph (NetworkX nodes). */
  getEntities(): Promise<LightRAGEntity[]>
  /** All relations currently in the graph (NetworkX edges). */
  getRelations(): Promise<LightRAGRelation[]>
  /** Direct graph neighbours of a node with the connecting relation label. */
  getGraphNeighbors(nodeId: string): Promise<LightRAGGraphNeighbor[]>
}
