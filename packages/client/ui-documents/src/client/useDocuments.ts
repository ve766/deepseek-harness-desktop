/**
 * The single documents access seam for every view in this package.
 *
 * `useDocuments` reads the injected face from {@link DocumentsContext} — so no
 * component ever reaches `ctx.remote` — and unwraps `RemoteResult`, throwing
 * {@link DocumentsRemoteError} on the failure branch. The returned object is
 * memoized and stable for the provider's lifetime.
 * @module @deepseek-ai/dsh-client-ui-documents/client/useDocuments
 */

import { useContext, useMemo } from 'react'
import type { KnowledgeItem, KnowledgeSearchQuery, KnowledgeSearchResult } from '@deepseek-ai/dsh-knowledge-storage/types'
import type { RemoteFailure } from '@deepseek-ai/dsh-typert-protocol'
import { DocumentsContext, DocumentsContextMissingError } from './DocumentsContext.ts'

/** Thrown when a Remote call returns its error branch. */
export class DocumentsRemoteError extends Error {
  /** The carrier-reported failure. */
  readonly failure: RemoteFailure
  constructor(failure: RemoteFailure) {
    super(failure.message)
    this.name = 'DocumentsRemoteError'
    this.failure = failure
  }
}

/** The unwrapped, component-facing documents API. */
export interface DocumentsApi {
  /** Search the knowledge base; resolves to the matching page (items + total). */
  search: (query?: Partial<KnowledgeSearchQuery>) => Promise<KnowledgeSearchResult>
  /** Fetch one item by id (null when absent). */
  get: (id: string) => Promise<KnowledgeItem | null>
}

/**
 * Read the injected documents face and expose an unwrapped, promise-returning
 * API. Call from any component rendered inside a `documents` entry provider.
 * @returns the unwrapped documents API.
 */
export function useDocuments(): DocumentsApi {
  const injected = useContext(DocumentsContext)
  if (injected === null) throw new DocumentsContextMissingError()
  return useMemo<DocumentsApi>(() => ({
    async search(query = {}) {
      const normalized: KnowledgeSearchQuery = { ...query, text: query.text ?? '' }
      const result = await injected.search(normalized)
      if (!result.ok) throw new DocumentsRemoteError(result.error)
      return result.value
    },
    async get(id) {
      const result = await injected.get(id)
      if (!result.ok) throw new DocumentsRemoteError(result.error)
      return result.value
    },
  }), [injected])
}
