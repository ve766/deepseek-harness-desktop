// Stage 11 (D1-A / D4): read-only knowledge-aware suggestion adapter.
//
// Reuses the existing `EmployeeKnowledgeAccess.query` (which delegates to the
// backend `getNeighbors`) to surface "related knowledge" for one of the
// employee's owned nodes. PURELY READ-ONLY (D4):
//   - no Runtime, no recommendation engine, no write-back;
//   - the seed is an owned node id supplied by the caller (the employee's own
//     contribution context), never an arbitrary free-text search;
//   - cleans up in-flight work on change/unmount (noMemoryLeak — D8).
//
// Data chain: UI -> this hook -> EmployeeKnowledgeAccess -> SharedUniverse.
// Imports ONLY `knowledgeUniverse` + core types (R6 isolation).

import { useEffect, useMemo, useState } from 'react'
import type { AgentId, KnowledgeNode } from '../types'
import { bindEmployeeAccess } from '../knowledge/knowledgeUniverse'

export interface KnowledgeSuggestion {
  node: KnowledgeNode
  score: number
  reason: string
}

export function useEmployeeKnowledgeSuggestions(
  id: AgentId,
  seedNodeId: string | null,
): { suggestions: KnowledgeSuggestion[]; loading: boolean; error: string | null } {
  const access = useMemo(() => bindEmployeeAccess(id), [id])
  const [suggestions, setSuggestions] = useState<KnowledgeSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!seedNodeId) {
      setSuggestions([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    access
      .listAll()
      .then(async (all) => {
        if (cancelled) return
        const seed = all.find(n => n.id === seedNodeId)
        const hits = await access.query(seedNodeId, seed?.title ?? '')
        if (cancelled) return
        const byId = new Map(all.map(n => [n.id, n]))
        const mapped = hits
          .map((h) => {
            const node = byId.get(h.nodeId)
            return node ? { node, score: h.score, reason: h.reason } : null
          })
          .filter((s): s is KnowledgeSuggestion => s !== null)
          .slice(0, 5)
        setSuggestions(mapped)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(String(e))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [access, seedNodeId])

  return { suggestions, loading, error }
}
