/**
 * The single knowledge access seam for every view in this package.
 *
 * `useKnowledge` reads the injected face from {@link KnowledgeContext} — so no
 * component ever reaches `ctx.remote` — and unwraps `RemoteResult`, throwing
 * {@link KnowledgeRemoteError} on the failure branch. The returned object is
 * memoized and stable for the provider's lifetime.
 * @module @deepseek-ai/dsh-client-ui-knowledge/client/useKnowledge
 */

import { useContext, useMemo } from 'react'
import type { KnowledgeItem, KnowledgeItemDraft, KnowledgeSearchQuery } from '@deepseek-ai/dsh-knowledge-storage/types'
import type { ImportRequest, QueryResult } from '@deepseek-ai/dsh-knowledge-indexer/types'
import type { RemoteFailure } from '@deepseek-ai/dsh-typert-protocol'
import { KnowledgeContext, KnowledgeContextMissingError } from './KnowledgeContext.ts'

/** Thrown when a Remote call returns its error branch. */
export class KnowledgeRemoteError extends Error {
  /** The carrier-reported failure. */
  readonly failure: RemoteFailure
  constructor(failure: RemoteFailure) {
    super(failure.message)
    this.name = 'KnowledgeRemoteError'
    this.failure = failure
  }
}

/** The unwrapped, component-facing knowledge API. */
export interface KnowledgeApi {
  /** Search the knowledge base; resolves to the matching items. */
  search: (query?: Partial<KnowledgeSearchQuery>) => Promise<KnowledgeItem[]>
  /** Fetch one item by id (null when absent). */
  get: (id: string) => Promise<KnowledgeItem | null>
  /** Ask a natural-language question over the knowledge base. */
  query: (question: string, limit?: number) => Promise<QueryResult>
  /** Import a raw document into the knowledge store. */
  importDoc: (request: ImportRequest) => Promise<KnowledgeItem>
  /** Save a pre-structured draft into the knowledge store. */
  save: (draft: KnowledgeItemDraft) => Promise<KnowledgeItem>
}

/**
 * Read the injected knowledge face and expose an unwrapped, promise-returning
 * API. Call from any component rendered inside the `knowledge` app.view.
 * @returns the unwrapped knowledge API.
 */
export function useKnowledge(): KnowledgeApi {
  const injected = useContext(KnowledgeContext)
  if (injected === null) throw new KnowledgeContextMissingError()
  return useMemo<KnowledgeApi>(() => ({
    async search(query = {}) {
      const normalized: KnowledgeSearchQuery = { ...query, text: query.text ?? '' }
      const result = await injected.search(normalized)
      if (!result.ok) throw new KnowledgeRemoteError(result.error)
      return result.value.items
    },
    async get(id) {
      const result = await injected.get(id)
      if (!result.ok) throw new KnowledgeRemoteError(result.error)
      return result.value
    },
    async query(question, limit) {
      const result = await injected.query(question, limit)
      if (!result.ok) throw new KnowledgeRemoteError(result.error)
      return result.value
    },
    async importDoc(request) {
      const result = await injected.importDoc(request)
      if (!result.ok) throw new KnowledgeRemoteError(result.error)
      return result.value
    },
    async save(draft) {
      const result = await injected.save(draft)
      if (!result.ok) throw new KnowledgeRemoteError(result.error)
      return result.value
    },
  }), [injected])
}
