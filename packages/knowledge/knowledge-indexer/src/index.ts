/**
 * KnowledgeService — the host-side brain of the AI Knowledge Agent.
 *
 * Owns a SQLite-backed {@link KnowledgeStore} and exposes a Remote surface that
 * the UI and the in-session tools both call. The store hides the persistence
 * detail (SQLite today; a vector backend later) so swapping engines only touches
 * the wiring here.
 *
 * @module @deepseek-ai/dsh-knowledge-indexer
 */

import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import s from '@deepseek-ai/schemastery'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import {
  SqliteKnowledgeStore,
  type KnowledgeItem,
  type KnowledgeStore,
  type KnowledgeSearchResult,
} from '@deepseek-ai/dsh-knowledge-storage'
import { parseMarkdown, parseText } from '@deepseek-ai/dsh-knowledge-parser'
import type {
  DeleteRequest,
  GetRequest,
  ImportRequest,
  QueryRequest,
  QueryResult,
  SaveRequest,
  UpdateRequest,
} from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    knowledge: KnowledgeService
  }
}

/** Configuration for {@link KnowledgeService}. */
export interface Config {
  /** Directory holding `knowledge.db`; created on first use. */
  readonly dbDir: string
  /** Directory for Obsidian-compatible Markdown exports; defaults to `<dbDir>/Processed`. */
  readonly markdownDir: string
}

/**
 * Validate the deployment-only directory settings. The schemastery Config below
 * already defaults both fields, so this reshapes them into the store options.
 */
function toStoreOptions(config: Config): { dbPath: string; markdownDir: string } {
  return {
    dbPath: join(config.dbDir, 'knowledge.db'),
    markdownDir: config.markdownDir,
  }
}

/**
 * The KnowledgeService. Implements import / save / search / get / update /
 * delete / query, and exposes them as a Remote for the browser client.
 */
export class KnowledgeService extends TypertRemoteService {
  static inject = ['llm']

  static Config: s<Config> = s.object({
    dbDir: s.string().default(join(process.env.DSH_HOME ?? '.', 'knowledge')),
    markdownDir: s.string().default(join(process.env.DSH_HOME ?? '.', 'knowledge', 'Processed')),
  })

  private readonly store: KnowledgeStore

  constructor(ctx: Context, config: Config) {
    super(ctx, 'knowledge')
    this.store = new SqliteKnowledgeStore(toStoreOptions(config))
  }

  /** Close the store when the service disposes. */
  protected async [Service.init](): Promise<void> {
    this.ctx.effect(() => async () => {
      await this.store.close()
    }, 'knowledge.storeClose')
  }

  /**
   * Ingest a raw document and store the structured result. The chosen parser is
   * selected by `kind`; the store assigns the id and timestamps.
   */
  @Remote('import')
  async import(request: ImportRequest): Promise<KnowledgeItem> {
    const draft =
      request.kind === 'markdown'
        ? parseMarkdown(request.raw, request.source === undefined ? {} : { source: request.source })
        : parseText(request.raw, request.source === undefined ? {} : { source: request.source })
    return this.store.save({
      ...draft,
      id: randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  /** Store a pre-structured draft supplied by a caller or another agent. */
  @Remote('save')
  async save(request: SaveRequest): Promise<KnowledgeItem> {
    return this.store.save({
      ...request,
      id: randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  /** Full-text / tag search over the knowledge base. */
  @Remote('search')
  async search(request: import('@deepseek-ai/dsh-knowledge-storage').KnowledgeSearchQuery): Promise<KnowledgeSearchResult> {
    return this.store.search(request)
  }

  /** Fetch one item by id, or null when absent. */
  @Remote('get')
  async get(request: GetRequest): Promise<KnowledgeItem | null> {
    const item = await this.store.get(request.id)
    return item ?? null
  }

  /** Apply a partial patch to one item. */
  @Remote('update')
  async update(request: UpdateRequest): Promise<KnowledgeItem | null> {
    const updated = await this.store.update(request.id, request.patch)
    return updated ?? null
  }

  /** Remove one item. Returns true when something was deleted. */
  @Remote('delete')
  async delete(request: DeleteRequest): Promise<boolean> {
    return this.store.delete(request.id)
  }

  /**
   * Answer a question over the knowledge base. Phase 1 uses extractive
   * retrieval (FTS5) plus an optional LLM pass; if no model is reachable, it
   * falls back to a citation list so the call is always useful offline.
   */
  @Remote('query')
  async query(request: QueryRequest): Promise<QueryResult> {
    const limit = request.limit ?? 5
    const results = await this.store.search({ text: request.question, limit })
    const sources = results.items
    const context = sources
      .map((item, i) => `【${i + 1}】 ${item.title}\n${item.content.slice(0, 800)}`)
      .join('\n\n')

    let answer: string
    try {
      const response = await this.ctx.llm.stream({
        provider: 'local',
        model: 'auto',
        system:
          'You are a personal knowledge assistant. Answer the question using ONLY the provided passages. '
          + 'Cite sources by number. If the passages do not contain the answer, say so.',
        messages: [
          createUserMessage({
            content: [
              {
                type: 'text',
                text: `Question: ${request.question}\n\nPassages:\n${context}`,
              },
            ],
            source: { kind: 'user' },
          }),
        ],
      })
      const parts: string[] = []
      for await (const chunk of response) {
        if (chunk.type === 'text-delta') parts.push(chunk.text)
      }
      answer = parts.join('').trim() || fallbackAnswer(sources)
    } catch {
      answer = fallbackAnswer(sources)
    }
    return { answer, sources }
  }
}

/** Extractive fallback used when no LLM is configured or the call fails. */
function fallbackAnswer(sources: KnowledgeItem[]): string {
  if (sources.length === 0) {
    return 'No relevant knowledge found in your local library.'
  }
  const lines = ['Based on your knowledge library, here are the most relevant entries:']
  for (const item of sources) {
    lines.push(`- ${item.title}: ${item.summary ?? item.content.slice(0, 160)}`)
  }
  return lines.join('\n')
}

export default KnowledgeService
