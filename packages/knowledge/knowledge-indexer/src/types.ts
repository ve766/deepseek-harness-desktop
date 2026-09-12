/**
 * Request and result types for the KnowledgeService Remote surface.
 *
 * @module @deepseek-ai/dsh-knowledge-indexer
 */

import type { KnowledgeItem, KnowledgeItemPatch } from '@deepseek-ai/dsh-knowledge-storage'

/** Source kinds accepted by {@link KnowledgeService#import}. */
export type KnowledgeSourceKind = 'markdown' | 'text'

/** Import a raw document into the knowledge store. */
export interface ImportRequest {
  /** Origin locator (file path or URL); falls back to `manual`. */
  source?: string
  /** Raw document text. */
  raw: string
  /** How to interpret `raw`; `'markdown'` parses frontmatter, `'text'` does not. */
  kind: KnowledgeSourceKind
}

/** Save a pre-structured draft into the knowledge store. */
export type SaveRequest = import('@deepseek-ai/dsh-knowledge-storage').KnowledgeItemDraft

/** Fetch one item by id. */
export interface GetRequest {
  id: string
}

/** Update one item by id. */
export interface UpdateRequest {
  id: string
  patch: KnowledgeItemPatch
}

/** Remove one item by id. */
export interface DeleteRequest {
  id: string
}

/** Answer a natural-language question over the knowledge base (RAG-lite). */
export interface QueryRequest {
  question: string
  /** Recall window size for retrieval. */
  limit?: number
}

/** A query answer with the passages it was grounded on. */
export interface QueryResult {
  /** Synthesized answer text. */
  answer: string
  /** Items the answer was grounded on. */
  sources: KnowledgeItem[]
}
