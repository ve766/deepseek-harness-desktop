/**
 * Registrant-injected business face for the `documents` knowledge.workspace and
 * knowledge.detail entries.
 *
 * The face closes over the plugin's `ctx.remote.knowledge` (filled in
 * `apply`); the component never touches `ctx.remote` directly — it reads these
 * methods through the `useDocuments` hook. Every method returns the raw
 * `RemoteResult` the carrier folds failures into, so the hook (not the
 * component) owns the unwrap decision — identical to the KnowledgeInjected and
 * ImportInjected contracts.
 * @module @deepseek-ai/dsh-client-ui-documents/client/slots
 */

import type { KnowledgeItem, KnowledgeSearchQuery, KnowledgeSearchResult } from '@deepseek-ai/dsh-knowledge-storage/types'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'

/** The business face handed to the `documents` knowledge entries. */
export interface DocumentsInjected {
  /** Full-text / tag search over the knowledge base. */
  search: (query: KnowledgeSearchQuery) => Promise<RemoteResult<KnowledgeSearchResult>>
  /** Fetch one item by id (null when absent). */
  get: (id: string) => Promise<RemoteResult<KnowledgeItem | null>>
}
