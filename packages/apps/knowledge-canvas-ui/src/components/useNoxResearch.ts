// S13-A (T6): Nox research hook — the ONLY consumer of the `LlmClient` seam.
//
// Discipline (S13-A 仅 seam+UI, and the T1-scope ruling):
//   - This hook imports ONLY `llmContext` (the single LLM seam) and the knowledge
//     lens/access API. It never imports `@deepseek-ai/dsh-llm*`.
//   - The LLM call is read-only inference; retrieval is a separate read seam and
//     never writes the graph.
//   - In the browser prototype the LlmClient is the documented degradation stub
//     (available=false) — we surface that honestly instead of faking an answer.

import { useCallback, useRef, useState } from 'react'
import type { AgentId } from '../types'
import { bindEmployeeAccess } from '../knowledge/knowledgeUniverse'
import { getLlmClient, type LlmContextNode } from '../llm/llmContext'
import { emitUserActivity } from '../activity/activityBus'
import { useT } from '../i18n'

export type ResearchStatus = 'idle' | 'retrieving' | 'thinking' | 'done' | 'error'

export interface ResearchState {
  status: ResearchStatus
  query: string
  /** Retrieved grounding nodes (empty if backend unsupported or no hits). */
  contextNodes: LlmContextNode[]
  /** Accumulated "thinking" text (model reasoning trace, if any). */
  thinking: string
  /** Accumulated answer text. */
  answer: string
  /** True when the active backend has no `query` capability (graceful degradation). */
  retrievalUnsupported: boolean
  /** True when the LLM host is unavailable (browser prototype / no Node host). */
  llmUnavailable: boolean
  errorText?: string
}

const IDLE: ResearchState = {
  status: 'idle',
  query: '',
  contextNodes: [],
  thinking: '',
  answer: '',
  retrievalUnsupported: false,
  llmUnavailable: false,
}

export function useNoxResearch(employeeId: AgentId = 'nox') {
  const { t } = useT()
  const [state, setState] = useState<ResearchState>(IDLE)
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(
    async (rawQuery: string) => {
      const query = rawQuery.trim()
      if (!query) return

      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      // Read the abort flag through a function call: oxlint treats `ac.signal.aborted`
      // as a stable value and would narrow it to `false` at direct read sites (it
      // cannot see `ac.abort()` mutate the getter), so a function's return type
      // (`boolean`) is used instead — never narrowed to a literal at call sites.
      const isAborted = () => ac.signal.aborted

      setState({ ...IDLE, status: 'retrieving', query })
      emitUserActivity('search.performed', { query })

      // Outer guard: `bindEmployeeAccess` or any unexpected throw must not reject
      // this promise (the panel fires it fire-and-forget via `void run(...)`).
      try {
        // 1) Retrieval seam (read-only). MockBackend lacks `query` -> unsupported.
        let contextNodes: LlmContextNode[] = []
        let retrievalUnsupported = false
        try {
          const access = bindEmployeeAccess(employeeId)
          const res = await access.researchQuery(query)
          if (res.ok) {
            const nodes = await access.listAll()
            const titleById = new Map(nodes.map(n => [n.id, n.title]))
            contextNodes = res.hits.slice(0, 8).map(h => ({
              nodeId: h.nodeId,
              title: titleById.get(h.nodeId) ?? h.nodeId,
              snippet: '',
              score: h.score,
              reason: h.reason,
            }))
          } else {
            retrievalUnsupported = true
          }
        } catch {
          retrievalUnsupported = true
        }

        if (isAborted()) return
        setState(s => ({ ...s, contextNodes, retrievalUnsupported }))

        // 2) LLM seam — single entry via llmContext. Browser returns a degraded stub.
        try {
          const client = await getLlmClient()
          if (!client.available) {
            setState(s => ({ ...s, status: 'done', llmUnavailable: true }))
            return
          }
          setState(s => ({ ...s, status: 'thinking', thinking: '', answer: '' }))
          const stream = await client.research({ query, contextNodes }, ac.signal)
          let thinking = ''
          let answer = ''
          for await (const c of stream) {
            if (isAborted()) break
            if (c.type === 'thinking' && c.text) {
              thinking += c.text
              setState(s => ({ ...s, thinking }))
            } else if (c.type === 'text' && c.text) {
              answer += c.text
              setState(s => ({ ...s, status: answer ? 'done' : 'thinking', answer }))
            } else if (c.type === 'error') {
              setState(s => ({
                ...s,
                status: 'error',
                errorText: c.error ?? c.text ?? t('nox.research.error'),
              }))
              return
            }
          }
          if (!isAborted()) setState(s => ({ ...s, status: 'done' }))
        } catch (e) {
          if (!isAborted()) {
            setState(s => ({
              ...s,
              status: 'error',
              errorText: e instanceof Error ? e.message : String(e),
            }))
          }
        }
      } catch (e) {
        setState(s => ({
          ...s,
          status: 'error',
          errorText: e instanceof Error ? e.message : String(e),
        }))
      }
    },
    [employeeId, t],
  )

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(IDLE)
  }, [])

  return { state, run, reset }
}
