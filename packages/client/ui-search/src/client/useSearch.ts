/**
 * The single search access seam for every view in this package.
 *
 * `useSearch` reads the injected face from {@link SearchContext} — so no
 * component ever reaches `ctx.remote` — and unwraps `RemoteResult`, throwing
 * {@link SearchRemoteError} on the failure branch. The returned object is
 * memoized and stable for the provider's lifetime.
 * @module @deepseek-ai/dsh-client-ui-search/client/useSearch
 */

import { useContext, useMemo } from 'react'
import type { KnowledgeItem, KnowledgeSearchQuery, KnowledgeSearchResult } from '@deepseek-ai/dsh-knowledge-storage/types'
import { SearchContext, SearchContextMissingError } from './SearchContext.ts'
import { SearchRemoteError } from '../invariant.ts'

/** The unwrapped, component-facing search API. */
export interface SearchApi {
  /** Search the knowledge base; resolves to the matching page (items + total). */
  search: (query?: Partial<KnowledgeSearchQuery>) => Promise<KnowledgeSearchResult>
  /** Fetch one item by id (null when absent). */
  get: (id: string) => Promise<KnowledgeItem | null>
}

/**
 * Read the injected search face and expose an unwrapped, promise-returning API.
 * Call from any component rendered inside a `search` entry provider.
 * @returns the unwrapped search API.
 */
export function useSearch(): SearchApi {
  const injected = useContext(SearchContext)
  if (injected === null) throw new SearchContextMissingError()
  return useMemo<SearchApi>(() => ({
    async search(query = {}) {
      const normalized: KnowledgeSearchQuery = { ...query, text: query.text ?? '' }
      const result = await injected.search(normalized)
      if (!result.ok) throw new SearchRemoteError(result.error)
      return result.value
    },
    async get(id) {
      const result = await injected.get(id)
      if (!result.ok) throw new SearchRemoteError(result.error)
      return result.value
    },
  }), [injected])
}
