/**
 * Knowledge data model and store contract for the AI Knowledge Agent.
 *
 * @module @deepseek-ai/dsh-knowledge-storage
 */

/** Stable identifier for one knowledge record. */
export type KnowledgeId = string

/**
 * One persisted unit of personal knowledge extracted from a source document.
 * The store returns plain objects; treat the returned shape as immutable.
 */
export interface KnowledgeItem {
  /** Opaque stable identifier (UUID). */
  id: KnowledgeId
  /** Human-readable title. */
  title: string
  /** Origin locator: a file path, a web URL, or the literal `manual`. null when unknown. */
  source: string | null
  /** Primary Markdown body of the knowledge. */
  content: string
  /** One-paragraph condensation of the content. */
  summary: string | null
  /** Coarse topic bucket, e.g. `research` | `business`. */
  category: string | null
  /** Free-form topical labels. */
  tags: string[]
  /** Arbitrary string key/value metadata carried from the source. */
  metadata: Record<string, string>
  /** Absolute path of the Obsidian-compatible Markdown file, when written. */
  markdownPath?: string | null
  /** Unix epoch milliseconds. */
  createdAt: number
  /** Unix epoch milliseconds. */
  updatedAt: number
}

/** The mutable fields a parser or caller supplies before the store assigns ids/timestamps. */
export interface KnowledgeItemDraft {
  title: string
  source: string | null
  content: string
  summary: string | null
  category: string | null
  tags: string[]
  metadata: Record<string, string>
}

/** A partial update applied over an existing item. */
export interface KnowledgeItemPatch {
  title?: string
  source?: string | null
  content?: string
  summary?: string | null
  category?: string | null
  tags?: string[]
  metadata?: Record<string, string>
}

/** A full-text / tag search over the knowledge store. */
export interface KnowledgeSearchQuery {
  /** Free-text terms; an empty string matches everything (most recent first). */
  text: string
  /** Optional tag filter (AND semantics with the text query). */
  tags?: string[]
  /** Maximum number of rows to return. */
  limit?: number
}

/** A search result page. */
export interface KnowledgeSearchResult {
  items: KnowledgeItem[]
  total: number
}

/**
 * The storage contract reused by every backend. The first implementation is
 * SQLite + FTS5; a future vector backend (Chroma/Qdrant) implements the same
 * interface and only the wiring in `KnowledgeService` changes.
 */
export interface KnowledgeStore {
  /** Create or replace one item; assigns `createdAt`/`updatedAt` from the input. */
  save(item: KnowledgeItem): Promise<KnowledgeItem>
  /** Fetch one item by id, or undefined when absent. */
  get(id: KnowledgeId): Promise<KnowledgeItem | undefined>
  /** Full-text and tag search. */
  search(query: KnowledgeSearchQuery): Promise<KnowledgeSearchResult>
  /** Apply a partial patch; returns the updated item, or undefined when absent. */
  update(id: KnowledgeId, patch: KnowledgeItemPatch): Promise<KnowledgeItem | undefined>
  /** Remove one item; returns true when something was deleted. */
  delete(id: KnowledgeId): Promise<boolean>
  /** Release the underlying database handle. */
  close(): Promise<void>
}
