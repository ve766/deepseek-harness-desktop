// LightRAG HTTP client — the concrete `LightRAGClient` backed by a running
// `lightrag-server` (LightRAG HKUDS, `pip install "lightrag-hku[api]"`).
//
// Architecture (Stage 8 D1, Option A):
//   AIOS UI → LightRAGBackend → LightRAGHttpClient → lightrag-server → Storage
//
// This file is the ONLY place that knows about the HTTP wire format. It implements
// the `LightRAGClient` contract from `./lightragClient`, so swapping the engine
// (in-memory mirror ↔ real server) never touches `KnowledgeBackend`, the canvas
// store, the UI, or the Employee model (R6).
//
// S13-B B-1: pinned to the REAL `lightrag-server 1.5.7` wire format:
//   * POST /documents/text { text, file_source }              → { status, message, track_id }
//   * GET  /graphs?label=*&max_nodes=N                        → { nodes[], edges[], is_truncated }
//   * GET  /graphs?label=<id>&max_depth=1                     → { nodes[], edges[], is_truncated }
//   * POST /query { query, mode, top_k, include_references }  → { response, references[], ... }
// Nodes carry their data under `properties` (entity_id/entity_type/description/
// source_id/file_path); edges use `source`/`target` with `properties.weight` /
// `properties.description`. `label=*` asks 1.5.7 for the whole graph (its
// documented whole-graph convention), so one request covers all entities/edges.
//
// 1.5.7 `references[]` is FILE-level ({ reference_id, file_path }) and carries no
// entity name or score. To keep `LightRAGQueryHit { entity, score }` semantically
// usable we resolve each reference's file path back to graph entity names; the
// score is reported as 0 because 1.5.7 exposes no per-hit score.

import type {
  LightRAGClient,
  LightRAGEntity,
  LightRAGRelation,
  LightRAGQueryMode,
  LightRAGQueryHit,
  LightRAGGraphNeighbor,
} from './lightragClient'
import type { LightRAGHttpConfig } from './lightragConfig'

type FetchImpl = (
  input: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
  },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

// --- 1.5.7 wire shapes (local, structural; never exported — R6 isolation) ---

interface GraphNodeProperties {
  entity_id?: string
  entity_type?: string
  description?: string
  source_id?: string
  file_path?: string
}

interface GraphNodeDto {
  id?: string
  labels?: string[]
  properties?: GraphNodeProperties
}

interface GraphEdgeProperties {
  description?: string
  weight?: number
}

interface GraphEdgeDto {
  source?: string
  target?: string
  properties?: GraphEdgeProperties
}

interface GraphDto {
  nodes?: GraphNodeDto[]
  edges?: GraphEdgeDto[]
  is_truncated?: boolean
}

interface ReferenceDto {
  reference_id?: string
  file_path?: string
}

interface QueryDto {
  response?: string
  references?: ReferenceDto[]
}

/** 1.5.7 whole-graph convention: `label=*` returns every entity/edge. */
const WHOLE_GRAPH_LABEL = '*'
/** Server-side node ceiling; generous so small/medium graphs stay complete. */
const MAX_GRAPH_NODES = 2000

function getGlobalFetch(): FetchImpl {
  const f = (globalThis as unknown as { fetch?: FetchImpl }).fetch
  if (!f) throw new Error('LightRAGHttpClient: no global fetch available')
  return f
}

export interface LightRAGHttpClientOptions {
  config: LightRAGHttpConfig
  /** Injectable for tests / non-browser runtimes (defaults to global `fetch`). */
  fetchImpl?: FetchImpl
}

export class LightRAGHttpClient implements LightRAGClient {
  private readonly baseURL: string
  private readonly apiKey?: string
  private readonly fetchImpl: FetchImpl
  /** Lineage: our stable source id → server background track id (best-effort). */
  private trackIdBySource = new Map<string, string>()

  constructor(opts: LightRAGHttpClientOptions) {
    this.baseURL = opts.config.baseURL.replace(/\/+$/, '')
    this.apiKey = opts.config.apiKey
    this.fetchImpl = opts.fetchImpl ?? getGlobalFetch()
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) h['X-API-Key'] = this.apiKey
    return h
  }

  private url(path: string): string {
    return `${this.baseURL}${path.startsWith('/') ? '' : '/'}${path}`
  }

  async insert(content: string, sourceId: string): Promise<void> {
    // 1.5.7 requires `file_source`; the legacy `source` field is rejected (400).
    const res = await this.fetchImpl(this.url('/documents/text'), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ text: content, file_source: sourceId }),
    })
    if (!res.ok) {
      throw new Error(`LightRAG insert failed: HTTP ${res.status}`)
    }
    // Insertion is queued asynchronously; record the returned track id (best-effort).
    try {
      const data = (await res.json()) as { track_id?: string }
      if (data.track_id) this.trackIdBySource.set(sourceId, data.track_id)
    } catch {
      // ignore non-JSON / empty bodies; lineage is best-effort
    }
  }

  async query(text: string, mode?: LightRAGQueryMode): Promise<LightRAGQueryHit[]> {
    const res = await this.fetchImpl(this.url('/query'), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        query: text,
        mode: mode ?? 'local',
        top_k: 10,
        include_references: true,
      }),
    })
    if (!res.ok) {
      throw new Error(`LightRAG query failed: HTTP ${res.status}`)
    }
    const data = (await res.json()) as QueryDto
    const refs = data.references ?? []
    if (refs.length === 0) return []

    // 1.5.7 gives file-level references only. One graph read lets us turn them
    // into entity names, keeping `LightRAGQueryHit.entity` a real graph node id.
    const graph = await this.fetchGraph(WHOLE_GRAPH_LABEL)
    const entitiesByFile = new Map<string, string[]>()
    for (const n of graph.nodes ?? []) {
      const name = n.properties?.entity_id ?? n.id
      const file = n.properties?.file_path
      if (!name || !file) continue
      const bucket = entitiesByFile.get(file)
      if (bucket) bucket.push(name)
      else entitiesByFile.set(file, [name])
    }

    const hits: LightRAGQueryHit[] = []
    const seen = new Set<string>()
    for (const r of refs) {
      const file = r.file_path
      const resolved = file ? entitiesByFile.get(file) : undefined
      const names = resolved && resolved.length > 0 ? resolved : [r.reference_id ?? file ?? '']
      for (const name of names) {
        if (!name || seen.has(name)) continue
        seen.add(name)
        // 1.5.7 exposes no per-hit score.
        hits.push({ entity: name, score: 0 })
      }
    }
    return hits
  }

  async getEntities(): Promise<LightRAGEntity[]> {
    const graph = await this.fetchGraph(WHOLE_GRAPH_LABEL)
    const out: LightRAGEntity[] = []
    for (const n of graph.nodes ?? []) {
      const name = n.properties?.entity_id ?? n.id
      if (!name) continue
      const meta: Record<string, string> = {}
      if (n.properties?.file_path) meta.file_path = n.properties.file_path
      out.push({
        entity_name: name,
        entity_type: n.properties?.entity_type ?? 'concept',
        description: n.properties?.description ?? '',
        source_ids: n.properties?.source_id ? [n.properties.source_id] : [],
        meta,
      })
    }
    return out
  }

  async getRelations(): Promise<LightRAGRelation[]> {
    const graph = await this.fetchGraph(WHOLE_GRAPH_LABEL)
    const out: LightRAGRelation[] = []
    for (const e of graph.edges ?? []) {
      const src = e.source
      const tgt = e.target
      if (!src || !tgt) continue
      out.push({
        src_id: src,
        tgt_id: tgt,
        description: e.properties?.description ?? '',
        weight: typeof e.properties?.weight === 'number' ? e.properties.weight : 5,
      })
    }
    return out
  }

  async getGraphNeighbors(nodeId: string): Promise<LightRAGGraphNeighbor[]> {
    // 1.5.7 `GET /graphs` demands a `label`; a depth-1 read around `nodeId`
    // returns exactly its incident edges (no full-graph scan).
    const graph = await this.fetchGraph(nodeId, { maxDepth: 1 })
    const seen = new Set<string>()
    const out: LightRAGGraphNeighbor[] = []
    for (const e of graph.edges ?? []) {
      const src = e.source
      const tgt = e.target
      let other: string | undefined
      if (src === nodeId) other = tgt
      else if (tgt === nodeId) other = src
      if (!other || seen.has(other)) continue
      seen.add(other)
      out.push({ target: other, relation: e.properties?.description ?? '' })
    }
    return out
  }

  private async fetchGraph(label: string, opts?: { maxDepth?: number }): Promise<GraphDto> {
    const params = new URLSearchParams()
    params.set('label', label)
    params.set('max_nodes', String(MAX_GRAPH_NODES))
    if (opts?.maxDepth !== undefined) params.set('max_depth', String(opts.maxDepth))
    const res = await this.fetchImpl(this.url(`/graphs?${params.toString()}`), {
      method: 'GET',
      headers: this.headers(),
    })
    if (!res.ok) {
      throw new Error(`LightRAG graph fetch failed: HTTP ${res.status}`)
    }
    const data = (await res.json()) as GraphDto
    return { nodes: data.nodes ?? [], edges: data.edges ?? [] }
  }
}
