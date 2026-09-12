// Stage 10 (D4): UI data-chain adapter for AI Employee Knowledge Visibility.
//
// Data chain (single source of truth):
//   UI component  →  useEmployeeKnowledgeAccess  →  EmployeeKnowledgeAccess
//                →  SharedKnowledgeUniverse  (via knowledgeUniverse seam)
//
// This hook is the ONLY bridge between the Employee UI surfaces and the
// knowledge layer. It imports ONLY `knowledgeUniverse` (the seam) + core types.
// R6 isolation: it must NEVER import LightRAG*, mock/mockBackend, or the
// KnowledgeBackend implementation — all reads go through EmployeeKnowledgeAccess.
//
// The hook is read-only: it never calls `contribute` and never mutates state.
// It also cleans up its async work on unmount (noMemoryLeak: cancelled guard),
// and carries no per-agent Memory structure (Memory stays user-level).

import { useEffect, useState } from 'react'
import type { AgentId, KnowledgeNode } from '../types'
// Data-chain seam (the ONLY runtime entry into the knowledge layer):
import { bindEmployeeAccess } from '../knowledge/knowledgeUniverse'
// Type-only import of the access contract (NOT a backend — the lens is the
// read-projection seam; runtime reads still go through `bindEmployeeAccess`).
import type { EmployeeKnowledgeAccess } from '../knowledge/lens/employeeKnowledgeAccess'

// Stage 12 D4: lightweight in-module mutation signal. When an employee
// contributes a source, the shared universe changes; this lets dependent
// projections (the owned list) refresh. It is plain pub/sub for cache
// invalidation — NOT a Workflow runtime, NOT a backend change, NOT a new
// capability. Employee model ⊥ Knowledge still holds.
type ContributionListener = (agentId: AgentId) => void
const _contributionListeners = new Set<ContributionListener>()

/** Notify subscribers that an employee contributed a source (triggers refresh). */
export function emitKnowledgeContribution(agentId: AgentId): void {
  for (const l of _contributionListeners) l(agentId)
}

/** Subscribe to contribution events; returns an unsubscribe function. */
export function subscribeKnowledgeContribution(cb: ContributionListener): () => void {
  _contributionListeners.add(cb)
  return () => {
    _contributionListeners.delete(cb)
  }
}

/** Resolved knowledge permission (read / contribute / own). */
export type KnowledgePermission = EmployeeKnowledgeAccess['permission']

/** Read-only projection of one employee's knowledge access. */
export interface EmployeeKnowledgeProjection {
  agentId: AgentId
  /** Resolved knowledge permission (read / contribute / own). */
  permission: KnowledgePermission
  /** L1: # of knowledge nodes contributed/owned by this employee. */
  ownedCount: number
  /** L1: ids of owned nodes. */
  ownedNodeIds: readonly string[]
  /** L1: full owned nodes (for the detail list + provenance). */
  ownedNodes: KnowledgeNode[]
  /** L0: total nodes in the shared universe (the breadth this employee can read). */
  relatedCount: number
  loading: boolean
  error: string | null
}

/**
 * Subscribe a component to one employee's read-only knowledge projection.
 * `id` is the employee's AgentId; the hook re-resolves when it changes.
 */
export function useEmployeeKnowledgeAccess(id: AgentId): EmployeeKnowledgeProjection {
  const [proj, setProj] = useState<EmployeeKnowledgeProjection>({
    agentId: id,
    permission: 'read',
    ownedCount: 0,
    ownedNodeIds: [],
    ownedNodes: [],
    relatedCount: 0,
    loading: true,
    error: null,
  })

  useEffect(() => {
    const access: EmployeeKnowledgeAccess = bindEmployeeAccess(id)
    let cancelled = false

    const resolve = () => {
      if (cancelled) return
      setProj(p => ({ ...p, agentId: id, loading: true, error: null }))
      Promise.all([access.summary(), access.listOwned(), access.listAll()])
        .then(([summary, owned, all]) => {
          if (cancelled) return
          setProj({
            agentId: id,
            permission: access.permission,
            ownedCount: summary.nodeCount,
            ownedNodeIds: summary.ownedNodeIds,
            ownedNodes: owned,
            relatedCount: all.length,
            loading: false,
            error: null,
          })
        })
        .catch((e: unknown) => {
          if (cancelled) return
          setProj(p => ({ ...p, loading: false, error: String(e) }))
        })
    }

    resolve()

    // D4: re-resolve when this employee's contribution lands so the owned list
    // reflects the new node without a remount (ownedProjectionRefresh).
    const unsub = subscribeKnowledgeContribution((aid) => {
      if (aid === id) resolve()
    })

    // noMemoryLeak: cancel in-flight resolution + unsubscribe on unmount / id change.
    return () => {
      cancelled = true
      unsub()
    }
  }, [id])

  return proj
}
