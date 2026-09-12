/**
 * The injected face this surface consumes from the knowledge host. Mirrors the
 * `knowledge` remote contract; the carrier folds failures into `RemoteResult`,
 * so the hook (not the components) unwraps it.
 * @module @deepseek-ai/dsh-client-ui-explore/client/slots
 */

import type { KnowledgeItem, KnowledgeSearchQuery, KnowledgeSearchResult } from '@deepseek-ai/dsh-knowledge-storage/types'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'

/** The explorer's view of the knowledge backend. */
export interface ExploreInjected {
  /** Search the knowledge base; resolves to the matching page (items + total). */
  search: (query: KnowledgeSearchQuery) => Promise<RemoteResult<KnowledgeSearchResult>>
  /** Fetch one item by id (null when absent). */
  get: (id: string) => Promise<RemoteResult<KnowledgeItem | null>>
}
