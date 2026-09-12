// Architecture seam: the Shared Knowledge Universe.
//
// This module is the SINGLE place in the app that names a concrete backend
// implementation. Everything else (the canvas store, the shell, future surfaces)
// only ever touches the `KnowledgeBackend` interface — never a concrete engine.
// Swapping GraphRAG / a real KG engine in later = replace only `createBackend()`
// below; no UI or store code changes.
//
// Stage 4 decisions (approved D1 / D2 / D3):
//   D1 seam-only — no UI, no surface, no Rail item. This is infrastructure.
//   D2 module singleton — `getSharedUniverse()` is a plain module-level
//      singleton, NOT a React Provider/Context. Keeps the component tree and the
//      single-glass budget untouched.
//   D3 adapter seam — knowledgeUniverse -> KnowledgeBackend interface ->
//      mockBackend. Concretely:
//        * does NOT import canvasStore (decoupled from the canvas state layer);
//        * does NOT bypass KnowledgeBackend (bindEmployee reads only through the
//          interface methods);
//        * bindEmployee(id) returns a READ-ONLY lens (canWrite: false);
//        * a future KG engine is swapped by replacing the single backend
//          instantiation in `createBackend()`.

import type { AgentId, KnowledgeBackend } from '../types'
import { MockBackend } from '../mock/mockBackend'
import { LightRAGBackend } from './backends/lightRAGBackend'
import { InMemoryLightRAGClient } from './backends/inMemoryLightRAGClient'
import { LightRAGHttpClient } from './backends/lightragHttpClient'
import { resolveLightRAGConfig, isScrapingEnabled } from './backends/lightragConfig'
import {
  createEmployeeKnowledgeAccess,
  type EmployeeKnowledgeAccess,
} from './lens/employeeKnowledgeAccess'
import { resolvePermission } from './lens/knowledgeAccess'

/** Read-only projection of the shared universe for one employee. */
export interface EmployeeKnowledgeLens {
  agentId: AgentId
  /** # of knowledge nodes owned/contributed by this employee (read-only derivation). */
  nodeCount: number
  /** # of edges in the shared universe (read-only derivation). */
  edgeCount: number
  /** Reference-only list of owned node ids — referenced, never mutated. */
  readonly ownedNodeIds: readonly string[]
  /** Architectural guarantee: lenses are always read-only. */
  readonly canWrite: false
}

/** The single shared universe instance. `null` until first access (lazy). */
let _sharedUniverse: KnowledgeBackend | null = null

// The ONLY place a concrete backend is named. Replace MockBackend with a real
// KG/GraphRAG backend here to swap the engine; the rest of the app is unaware.
//
// Stage 7 + 8: `LightRAGBackend` is available as an adapter prototype.
//   * Stage 8 (D2): when runtime/local config resolves a LightRAG HTTP endpoint,
//     we use `LightRAGBackend` backed by `LightRAGHttpClient` (real lightrag-server,
//     Option A). Config precedence: runtime > .env > globalThis.
//   * Stage 7 (R7): a globalThis opt-in flag still selects the in-memory prototype.
// `MockBackend` remains the default fallback and this function stays the single
// switch point — no other module names a backend.
export function createBackend(): KnowledgeBackend {
  const httpCfg = resolveLightRAGConfig()
  if (httpCfg) {
    try {
      return new LightRAGBackend({
        client: new LightRAGHttpClient({ config: httpCfg }),
        // R5: Memory is delegated, never stored in the graph. We reuse MockBackend
        // purely as the Memory channel here (MockBackend is NOT deleted, R7).
        memoryProvider: { getMemory: () => new MockBackend().getMemory() },
      })
    } catch {
      return new MockBackend()
    }
  }
  if (isLightRAGPrototypeEnabled()) {
    try {
      return new LightRAGBackend({
        client: new InMemoryLightRAGClient(),
        memoryProvider: { getMemory: () => new MockBackend().getMemory() },
      })
    } catch {
      // Any failure to spin up the prototype falls back to MockBackend.
      return new MockBackend()
    }
  }
  return new MockBackend()
}

/** Stage 7 opt-in gate. Off by default so the app keeps using MockBackend. */
function isLightRAGPrototypeEnabled(): boolean {
  const g = globalThis as Record<string, unknown>
  return g['__KCU_ENABLE_LIGHTRAG_BACKEND'] === true
}

/** Returns the one shared universe instance (module-level singleton, D2). */
export function getSharedUniverse(): KnowledgeBackend {
  if (!_sharedUniverse) _sharedUniverse = createBackend()
  return _sharedUniverse
}

/**
 * Bind an employee to the shared universe as a READ-ONLY lens.
 *
 * The lens derives everything through the `KnowledgeBackend` interface only —
 * it never writes back to `AgentProfile` / `Employee*Context` and never reaches
 * into store internals (D3). Employee model ⊥ knowledge universe.
 *
 * Note: `KnowledgeBackend` exposes nodes/edges/memory but not learning paths,
 * so path attribution is intentionally omitted here rather than bypassing the
 * interface. It can be added when the interface gains `listPaths()`.
 */
export async function bindEmployee(id: AgentId): Promise<EmployeeKnowledgeLens> {
  const universe = getSharedUniverse()
  const [nodes, edges] = await Promise.all([universe.listNodes(), universe.listEdges()])
  const owned = nodes.filter(n => n.ownerAgent === id)
  return {
    agentId: id,
    nodeCount: owned.length,
    edgeCount: edges.length,
    ownedNodeIds: owned.map(n => n.id),
    canWrite: false,
  }
}

/**
 * Stage 9 (D1): bind an employee to the shared universe with full read +
 * contribution access. Additive sibling of `bindEmployee` (which returns the
 * read-only `EmployeeKnowledgeLens`). This wraps the shared universe singleton
 * and never creates a second instance (D2: single source of truth).
 */
export function bindEmployeeAccess(id: AgentId): EmployeeKnowledgeAccess {
  return createEmployeeKnowledgeAccess(id, getSharedUniverse())
}

// ---------------------------------------------------------------------------
// Capture seam probe hook (Stage 4 verification only).
// Exposes the read-only seam on `window` so scripts/capture-showcase.cjs can
// assert the singleton identity and the read-only lens contract at runtime.
// No UI, no observable app-side effects.
// ---------------------------------------------------------------------------
interface KnowledgeUniverseSeamProbe {
  getSharedUniverse: typeof getSharedUniverse
  bindEmployee: typeof bindEmployee
  createBackend: typeof createBackend
  resolveLightRAGConfig: typeof resolveLightRAGConfig
  isScrapingEnabled: typeof isScrapingEnabled
  // Stage 9: employee knowledge consumption seam (additive, backward compatible).
  bindEmployeeAccess: typeof bindEmployeeAccess
  resolvePermission: typeof resolvePermission
}

declare global {
  interface Window {
    __kcuKnowledgeUniverse?: KnowledgeUniverseSeamProbe
  }
}

// Only attach in a DOM/Electron context; never crash SSR, tests, or headless runs.
if (typeof window !== 'undefined') {
  window.__kcuKnowledgeUniverse = {
    getSharedUniverse,
    bindEmployee,
    createBackend,
    resolveLightRAGConfig,
    isScrapingEnabled,
    bindEmployeeAccess,
    resolvePermission,
  }
}
