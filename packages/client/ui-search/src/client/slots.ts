/**
 * Registrant-injected business face for the `search` knowledge.workspace and
 * knowledge.detail entries.
 *
 * The face closes over the plugin's `ctx.remote.knowledge` (filled in `apply`);
 * the component never touches `ctx.remote` directly — it reads these methods
 * through the `useSearch` hook. Every method returns the raw `RemoteResult` the
 * carrier folds failures into, so the hook (not the component) owns the unwrap
 * decision — identical to the DocumentsInjected and ExploreInjected contracts.
 * @module @deepseek-ai/dsh-client-ui-search/client/slots
 */

import type { KnowledgeItem, KnowledgeSearchQuery, KnowledgeSearchResult } from '@deepseek-ai/dsh-knowledge-storage/types'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'

/** The business face handed to the `search` knowledge entries. */
export interface SearchInjected {
  /** Full-text / tag search over the knowledge base. */
  search: (query: KnowledgeSearchQuery) => Promise<RemoteResult<KnowledgeSearchResult>>
  /** Fetch one item by id (null when absent). */
  get: (id: string) => Promise<RemoteResult<KnowledgeItem | null>>
}
