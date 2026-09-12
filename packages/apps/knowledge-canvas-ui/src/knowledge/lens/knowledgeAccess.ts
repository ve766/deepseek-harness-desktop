// Stage 9 (D7): Permission gate for AI Employee knowledge consumption.
//
// The policy lives OUTSIDE the backend. `KnowledgeBackend` keeps its single
// responsibility (store knowledge) and its 5-method interface untouched (red
// line). Permission is resolved here as a pure function so it is unit-testable
// without a backend and swappable without touching the engine (R6/R7).
//
// R6 isolation: this module imports only the `KnowledgeBackend` INTERFACE TYPE
// and `AgentId` from core types — never a concrete backend, never a LightRAG*,
// never an Employee UI component. Employee ⊥ Knowledge.

import type { AgentId, KnowledgeBackend, SourceRef } from '../../types'

export type KnowledgePermission = 'read' | 'contribute' | 'own'

/**
 * Result of an employee attempting to contribute a source to the shared universe.
 * `status` reflects the contribution lifecycle (draft → review → confirmed);
 * Stage 9 defines the seam + initial `draft` state. The review/confirm
 * transition is deferred to a later stage (D6 adjusted).
 */
export type ContributionResult =
  | { ok: true; nodeId: string; status: 'draft'; ownerAttribution: 'attributed' | 'unsupported' }
  | { ok: false; reason: 'permission-denied' | 'backend-unsupported' | 'ingest-failed' }

/**
 * Default P1 policy (Stage 9 §7.2). Code-level constant, NOT a UI/config (D8:
 * no permission UI). Overrideable at runtime via `resolvePermission(id, over)`.
 */
export const DEFAULT_PERMISSION_POLICY: Record<AgentId, KnowledgePermission> = {
  assistant: 'read',
  nox: 'contribute',
  knowledge: 'contribute',
  task: 'read',
}

/**
 * Resolve an employee's knowledge permission.
 *
 * Precedence (D2 alignment with Stage 8 config style): explicit runtime
 * override > default policy table. No build-time hardcoding.
 */
export function resolvePermission(
  id: AgentId,
  override?: Partial<Record<AgentId, KnowledgePermission>>,
): KnowledgePermission {
  if (override && override[id]) return override[id] as KnowledgePermission
  return DEFAULT_PERMISSION_POLICY[id]
}

/** Narrow capability probe: does this backend support attributed (owner-tagged) import? */
interface OwnedImportCapable {
  importSourceAs?(src: SourceRef, agentId: AgentId): Promise<{ nodeId: string }>
}

/**
 * S13-A (OB seam): optional free-form semantic retrieval over the whole graph,
 * distinct from the 5-method `getNeighbors` (which is anchored to a seed node).
 * Backends that support a global vector/keyword search expose `query(text)`.
 * MockBackend does NOT (returns unsupported); LightRAGBackend does (OB).
 */
interface KnowledgeQueryCapable {
  query?(text: string): Promise<{ nodeId: string; score: number; reason: string }[]>
}

export type RetrieveResult =
  | { ok: true; hits: { nodeId: string; score: number; reason: string }[] }
  | { ok: false; reason: 'backend-unsupported' }

/**
 * Retrieve knowledge context for a free-form question.
 *
 * Graceful degradation (C ruling): if the backend has no `query` capability,
 * returns `{ ok: false, reason: 'backend-unsupported' }` — MockBackend stays
 * unsupported. This keeps "LLM available != Knowledge connected" honest: Nox can
 * still run its research flow, just without retrieved grounding.
 */
export async function retrieve(
  backend: KnowledgeBackend,
  text: string,
): Promise<RetrieveResult> {
  const capable = backend as unknown as KnowledgeQueryCapable
  if (typeof capable.query !== 'function' || !text) {
    return { ok: false, reason: 'backend-unsupported' }
  }
  try {
    const hits = await capable.query(text)
    return { ok: true, hits }
  } catch {
    return { ok: false, reason: 'backend-unsupported' }
  }
}

async function tryAttributedImport(
  backend: KnowledgeBackend,
  src: SourceRef,
  agentId: AgentId,
): Promise<string | null> {
  const capable = backend as unknown as OwnedImportCapable
  if (typeof capable.importSourceAs !== 'function') return null
  // NOTE (Stage 12 D3): do NOT swallow errors here — let an ingestion failure
  // propagate to `contribute`'s try/catch so it surfaces as `ingest-failed`.
  const r = await capable.importSourceAs(src, agentId)
  return r.nodeId
}

/**
 * Contribute a source on behalf of an employee (D6 seam).
 *
 * Gate + delegation only — never bypasses permission or the backend interface.
 * Stage 12 D3: contribution MUST route through the ingestion layer via the
 * interface-external `importSourceAs` seam (which every compliant backend routes
 * through `ingestSource`). There is deliberately NO fallback to the 5-method
 * `importSource` (that path bypasses ingestion, G2). A backend without
 * `importSourceAs` cannot accept employee contributions (returns
 * `backend-unsupported`). The backend's import path records the provenance.
 */
export async function contribute(
  backend: KnowledgeBackend,
  src: SourceRef,
  agentId: AgentId,
): Promise<ContributionResult> {
  if (resolvePermission(agentId) === 'read') {
    return { ok: false, reason: 'permission-denied' }
  }
  // Stage 12 D3: contribution MUST route through the ingestion layer. The only
  // supported path is `importSourceAs` (an interface-external seam) which every
  // compliant backend routes through `ingestSource(...)`. We deliberately do NOT
  // fall back to the 5-method `importSource` — that path bypasses ingestion (G2).
  // A backend without `importSourceAs` cannot accept employee contributions.
  try {
    const attributed = await tryAttributedImport(backend, src, agentId)
    if (attributed) {
      return { ok: true, nodeId: attributed, status: 'draft', ownerAttribution: 'attributed' }
    }
    return { ok: false, reason: 'backend-unsupported' }
  } catch {
    return { ok: false, reason: 'ingest-failed' }
  }
}
