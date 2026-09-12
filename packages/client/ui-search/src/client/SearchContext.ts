/**
 * React context carrying the registrant-injected search face down to every
 * descendant. Keeping the face in context (rather than prop-drilling it) lets
 * child components call `useSearch()` without reaching `ctx.remote`.
 * @module @deepseek-ai/dsh-client-ui-search/client/SearchContext
 */

import { createContext } from 'react'
import type { SearchInjected } from './slots.ts'

/** Carries the injected search face; null only if a view escapes the provider. */
export const SearchContext = createContext<SearchInjected | null>(null)

/** Diagnostic thrown when a component uses `useSearch` outside the provider. */
export class SearchContextMissingError extends Error {
  constructor() {
    super('useSearch() must be called within a search provider')
    this.name = 'SearchContextMissingError'
  }
}
