// Stage 11 (D1-B / D3 / D7): UI contribution seam for AI Employee knowledge.
//
// Single controlled write only — wraps `EmployeeKnowledgeAccess.contribute`,
// which is the Stage 9 `contribute()` seam. This hook:
//   - is GATED by permission (D7): if permission === 'read', `contribute` is a
//     no-op that records a permission-denied result, and the UI never renders the
//     write entry for read-only agents;
//   - performs ONE controlled write (no Workflow Runtime, no task orchestration,
//     no Chat UI — D3);
//   - NEVER auto-confirms: it only surfaces the real `ContributionResult`
//     (status: 'draft' + ownerAttribution) — D5 forbids inventing review/confirmed;
//   - cleans up in-flight work on unmount (noMemoryLeak: cancelled guard — D8).
//
// Data chain: UI -> this hook -> EmployeeKnowledgeAccess -> SharedUniverse
// (via the knowledgeUniverse seam). It imports ONLY `knowledgeUniverse` + core
// types; R6 isolation holds (no LightRAG*, no mockBackend, no KnowledgeBackend impl).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AgentId, SourceRef } from '../types'
import { bindEmployeeAccess } from '../knowledge/knowledgeUniverse'
import { emitIngestionActivity } from '../activity/activityBus'
import type { ContributionResult, KnowledgePermission } from '../knowledge/lens/knowledgeAccess'

export function useEmployeeKnowledgeContribute(id: AgentId) {
  const access = useMemo(() => bindEmployeeAccess(id), [id])
  const permission: KnowledgePermission = access.permission
  const canContribute = permission !== 'read'

  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ContributionResult | null>(null)
  const cancelledRef = useRef(false)

  // noMemoryLeak (D8): cancel in-flight resolution on unmount / id change.
  useEffect(() => {
    return () => {
      cancelledRef.current = true
    }
  }, [])

  const contribute = useCallback(
    async (src: SourceRef) => {
      if (!canContribute) {
        // D7: hard gate — read-only agents cannot write.
        setResult({ ok: false, reason: 'permission-denied' })
        return
      }
      setSubmitting(true)
      try {
        const r = await access.contribute(src)
        if (cancelledRef.current) return
        setResult(r)
        // P2-4.1: the ingestion path announces itself (observation only — the
        // write already went through the Stage 12 `contribute` seam).
        if (r.ok) emitIngestionActivity('document.imported', { docId: r.nodeId })
      } catch {
        if (cancelledRef.current) return
        setResult({ ok: false, reason: 'ingest-failed' })
      } finally {
        if (!cancelledRef.current) setSubmitting(false)
      }
    },
    [access, canContribute],
  )

  const reset = useCallback(() => {
    setResult(null)
  }, [])

  return { canContribute, permission, contribute, submitting, result, reset }
}
