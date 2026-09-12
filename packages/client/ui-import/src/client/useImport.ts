/**
 * The single import seam for this package.
 *
 * `useImport` reads the injected face from {@link ImportContext} — so no
 * component ever reaches `ctx.remote` — and unwraps `RemoteResult` by throwing
 * {@link ImportRemoteError} on the failure branch, then folds that throw into
 * local UI state. The unwrap decision matches Phase 6-B-1's `useKnowledge`;
 * only the catch site moves into the hook so the view reads plain state instead
 * of handling `RemoteResult`.
 * @module @deepseek-ai/dsh-client-ui-import/client/useImport
 */

import { useCallback, useContext, useMemo, useState } from 'react'
import type { KnowledgeItem } from '@deepseek-ai/dsh-knowledge-storage/types'
import type { ImportRequest } from '@deepseek-ai/dsh-knowledge-indexer/types'
import type { RemoteFailure } from '@deepseek-ai/dsh-typert-protocol'
import { ImportContext, ImportContextMissingError } from './ImportContext.tsx'

/**
 * Thrown when a knowledge Remote call returns its failure branch.
 *
 * Deliberately defined here rather than imported from ui-knowledge: the shared
 * client-bundle purity gate rejects cross-plugin **value** imports — sharing
 * one class across two bundles would inline a second runtime identity and
 * break `instanceof`. This is therefore the structural counterpart of
 * ui-knowledge's `KnowledgeRemoteError` (same message source, same `failure`
 * carrier), not a competing taxonomy: any view that catches one behaves
 * identically with the other.
 */
export class ImportRemoteError extends Error {
  /** The carrier-reported failure. */
  readonly failure: RemoteFailure

  constructor(failure: RemoteFailure) {
    super(failure.message)
    this.name = 'ImportRemoteError'
    this.failure = failure
  }
}

/** Import lifecycle state exposed to the view. */
export type ImportStatus = 'idle' | 'importing' | 'success' | 'error'

/** View-facing import controller. */
export interface ImportController {
  /** Current lifecycle state. */
  status: ImportStatus
  /** Human-readable failure text; null unless `status === 'error'`. */
  error: string | null
  /** The stored item after a successful import; null otherwise. */
  item: KnowledgeItem | null
  /** Submit an import request; never rejects — failures land in `error`. */
  run(request: ImportRequest): Promise<void>
  /** Return to `idle`, clearing `error` and `item`. */
  reset(): void
}

/**
 * Read the injected import face and expose a state-machine controller.
 * Call from any component rendered inside the `import` knowledge.workspace entry.
 * @returns the import controller.
 */
export function useImport(): ImportController {
  const injected = useContext(ImportContext)
  if (injected === null) throw new ImportContextMissingError()

  const [status, setStatus] = useState<ImportStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [item, setItem] = useState<KnowledgeItem | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setItem(null)
  }, [])

  const run = useCallback(async (request: ImportRequest): Promise<void> => {
    // Client-side guard: never spend a round trip on empty content.
    if (request.raw.trim().length === 0) {
      setStatus('error')
      setError('内容为空，无法导入。')
      setItem(null)
      return
    }

    setStatus('importing')
    setError(null)
    setItem(null)

    try {
      const result = await injected.importDoc(request)
      // Same unwrap decision as useKnowledge: throw, then fold into state.
      if (!result.ok) throw new ImportRemoteError(result.error)
      setItem(result.value)
      setStatus('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }, [injected])

  return useMemo<ImportController>(
    () => ({ status, error, item, run, reset }),
    [status, error, item, run, reset],
  )
}

export default useImport
