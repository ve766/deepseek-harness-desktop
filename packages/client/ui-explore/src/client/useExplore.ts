/**
 * The single explore access seam for every view in this package.
 *
 * `useExplore` reads the injected face from {@link ExploreContext} — so no
 * component ever reaches `ctx.remote` — and unwraps `RemoteResult`, throwing
 * {@link ExploreRemoteError} on the failure branch. The returned object is
 * memoized and stable for the provider's lifetime.
 * @module @deepseek-ai/dsh-client-ui-explore/client/useExplore
 */

import { useContext, useMemo } from 'react'
import type { KnowledgeItem, KnowledgeSearchQuery, KnowledgeSearchResult } from '@deepseek-ai/dsh-knowledge-storage/types'
import type { RemoteFailure } from '@deepseek-ai/dsh-typert-protocol'
import { ExploreContext, ExploreContextMissingError } from './ExploreContext.ts'

/** Thrown when a Remote call returns its error branch. */
export class ExploreRemoteError extends Error {
  /** The carrier-reported failure. */
  readonly failure: RemoteFailure
  constructor(failure: RemoteFailure) {
    super(failure.message)
    this.name = 'ExploreRemoteError'
    this.failure = failure
  }
}

/** The unwrapped, component-facing explore API. */
export interface ExploreApi {
  /** Search the knowledge base; resolves to the matching page (items + total). */
  search: (query?: Partial<KnowledgeSearchQuery>) => Promise<KnowledgeSearchResult>
  /** Fetch one item by id (null when absent). */
  get: (id: string) => Promise<KnowledgeItem | null>
}

/**
 * Read the injected explore face and expose an unwrapped, promise-returning
 * API. Call from any component rendered inside an `explore` entry provider.
 * @returns the unwrapped explore API.
 */
export function useExplore(): ExploreApi {
  const injected = useContext(ExploreContext)
  if (injected === null) throw new ExploreContextMissingError()
  return useMemo<ExploreApi>(() => ({
    async search(query = {}) {
      const normalized: KnowledgeSearchQuery = { ...query, text: query.text ?? '' }
      const result = await injected.search(normalized)
      if (!result.ok) throw new ExploreRemoteError(result.error)
      return result.value
    },
    async get(id) {
      const result = await injected.get(id)
      if (!result.ok) throw new ExploreRemoteError(result.error)
      return result.value
    },
  }), [injected])
}
