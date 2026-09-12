/**
 * Registrant-injected business face for the `knowledge` app.view entry.
 *
 * The face closes over the plugin's `ctx.remote.knowledge` (filled in
 * `apply`); the component never touches `ctx.remote` directly — it reads these
 * methods through the `useKnowledge` hook. Every method returns the raw
 * `RemoteResult` the carrier folds failures into, so the hook (not the
 * component) owns the unwrap decision.
 * @module @deepseek-ai/dsh-client-ui-knowledge/client/slots
 */

import type { KnowledgeItem, KnowledgeItemDraft, KnowledgeSearchQuery, KnowledgeSearchResult } from '@deepseek-ai/dsh-knowledge-storage/types'
import type { ImportRequest, QueryResult } from '@deepseek-ai/dsh-knowledge-indexer/types'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'

/** The business face handed to the `knowledge` app.view component. */
export interface KnowledgeInjected {
  /** Full-text / tag search over the knowledge base. */
  search: (query: KnowledgeSearchQuery) => Promise<RemoteResult<KnowledgeSearchResult>>
  /** Fetch one item by id (null when absent). */
  get: (id: string) => Promise<RemoteResult<KnowledgeItem | null>>
  /** Natural-language question over the knowledge base (RAG-lite). */
  query: (question: string, limit?: number) => Promise<RemoteResult<QueryResult>>
  /** Import a raw document into the knowledge store. */
  importDoc: (request: ImportRequest) => Promise<RemoteResult<KnowledgeItem>>
  /** Save a pre-structured draft into the knowledge store. */
  save: (draft: KnowledgeItemDraft) => Promise<RemoteResult<KnowledgeItem>>
}
