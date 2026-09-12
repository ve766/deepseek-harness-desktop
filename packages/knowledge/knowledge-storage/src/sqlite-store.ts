/**
 * SQLite + FTS5 implementation of {@link KnowledgeStore}.
 *
 * The structured record lives in the `knowledge` table; a standalone FTS5
 * virtual table (`knowledge_fts`) mirrors the searchable text and is kept in
 * sync on every write. A directory of Obsidian-compatible Markdown files is
 * optionally mirrored alongside the database.
 *
 * @module @deepseek-ai/dsh-knowledge-storage
 */

import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  KnowledgeId,
  KnowledgeItem,
  KnowledgeItemPatch,
  KnowledgeSearchQuery,
  KnowledgeSearchResult,
  KnowledgeStore,
} from './types.ts'

/** One row of the `knowledge` table as returned by node:sqlite. */
interface KnowledgeRow {
  id: string
  title: string
  source: string | null
  content: string
  summary: string | null
  category: string | null
  tags: string
  metadata: string
  markdown_path: string | null
  created_at: number
  updated_at: number
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS knowledge (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT,
  content TEXT NOT NULL,
  summary TEXT,
  category TEXT,
  tags TEXT NOT NULL,
  metadata TEXT NOT NULL,
  markdown_path TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  id UNINDEXED,
  title,
  content,
  summary,
  tags
);
`

/** Construction options for {@link SqliteKnowledgeStore}. */
export interface SqliteKnowledgeStoreOptions {
  /** Absolute path of the SQLite database file. Parent directories are created. */
  dbPath: string
  /** Directory for Obsidian-compatible Markdown exports; null disables them. */
  markdownDir: string | null
}

/** Build a safe FTS5 MATCH expression from free text (OR over quoted tokens). */
function toFtsQuery(text: string): string {
  const tokens = text
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length > 0)
  if (tokens.length === 0) return ''
  // Double-quote each token and escape embedded quotes by doubling them.
  return tokens
    .map(token => `"${token.replace(/"/g, '""')}"`)
    .join(' OR ')
}

/** Escape a scalar as a YAML double-quoted flow scalar. */
function yamlScalar(value: string): string {
  return JSON.stringify(value)
}

/** Render one item as an Obsidian-compatible Markdown document. */
function toMarkdown(item: KnowledgeItem): string {
  const lines: string[] = ['---']
  lines.push(`title: ${yamlScalar(item.title)}`)
  lines.push(`date: ${new Date(item.createdAt).toISOString().slice(0, 10)}`)
  lines.push(`tags: [${item.tags.map(yamlScalar).join(', ')}]`)
  if (item.category !== null) lines.push(`category: ${yamlScalar(item.category)}`)
  if (item.source !== null) lines.push(`source: ${yamlScalar(item.source)}`)
  lines.push(`id: ${yamlScalar(item.id)}`)
  lines.push('---')
  lines.push('')
  if (item.summary !== null) {
    lines.push('# Summary')
    lines.push(item.summary)
    lines.push('')
  }
  lines.push('# Content')
  lines.push(item.content)
  return lines.join('\n')
}

/**
 * The default SQLite-backed knowledge store.
 */
export class SqliteKnowledgeStore implements KnowledgeStore {
  private readonly db: DatabaseSync
  private readonly markdownDir: string | null

  constructor(options: SqliteKnowledgeStoreOptions) {
    this.markdownDir = options.markdownDir
    const parent = dirname(options.dbPath)
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true })
    this.db = new DatabaseSync(options.dbPath)
    this.db.exec(SCHEMA)
  }

  async save(item: KnowledgeItem): Promise<KnowledgeItem> {
    const now = item.createdAt > 0 ? item.createdAt : Date.now()
    const markdownPath = this.resolveMarkdownPath(item.id)
    const stored: KnowledgeItem = {
      ...item,
      markdownPath,
      createdAt: now,
      updatedAt: now,
    }
    this.db.prepare(
      `INSERT OR REPLACE INTO knowledge
        (id, title, source, content, summary, category, tags, metadata, markdown_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      stored.id,
      stored.title,
      stored.source,
      stored.content,
      stored.summary,
      stored.category,
      JSON.stringify(stored.tags),
      JSON.stringify(stored.metadata),
      markdownPath,
      stored.createdAt,
      stored.updatedAt,
    )
    this.replaceFts(stored.id, stored.title, stored.content, stored.summary, stored.tags)
    if (markdownPath !== null) this.writeMarkdown(stored)
    return stored
  }

  async get(id: KnowledgeId): Promise<KnowledgeItem | undefined> {
    const row = this.db
      .prepare('SELECT * FROM knowledge WHERE id = ?')
      .get(id) as KnowledgeRow | undefined
    return row === undefined ? undefined : rowToItem(row)
  }

  async search(query: KnowledgeSearchQuery): Promise<KnowledgeSearchResult> {
    const limit = query.limit ?? 20
    const text = query.text.trim()
    if (text.length === 0) {
      const rows = this.db
        .prepare('SELECT * FROM knowledge ORDER BY updated_at DESC LIMIT ?')
        .all(limit) as unknown as KnowledgeRow[]
      const items = rows.map(rowToItem)
      return { items, total: this.countAll() }
    }
    const match = toFtsQuery(text)
    const ids = this.db
      .prepare('SELECT id FROM knowledge_fts WHERE knowledge_fts MATCH ? ORDER BY rank LIMIT ?')
      .all(match, limit) as unknown as Array<{ id: string }>
    let items = ids
      .map(record => this.readRow(record.id))
      .filter((item): item is KnowledgeItem => item !== undefined)
    if (query.tags !== undefined && query.tags.length > 0) {
      const wanted = new Set(query.tags)
      items = items.filter(item => item.tags.some(tag => wanted.has(tag)))
    }
    return { items, total: items.length }
  }

  async update(id: KnowledgeId, patch: KnowledgeItemPatch): Promise<KnowledgeItem | undefined> {
    const existing = this.readRow(id)
    if (existing === undefined) return undefined
    const markdownPath = this.resolveMarkdownPath(id)
    const next: KnowledgeItem = {
      ...existing,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.source !== undefined ? { source: patch.source } : {}),
      ...(patch.content !== undefined ? { content: patch.content } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
      markdownPath: markdownPath,
      updatedAt: Date.now(),
    }
    this.db.prepare(
      `UPDATE knowledge SET title=?, source=?, content=?, summary=?, category=?, tags=?, metadata=?, markdown_path=?, updated_at=? WHERE id=?`,
    ).run(
      next.title,
      next.source,
      next.content,
      next.summary,
      next.category,
      JSON.stringify(next.tags),
      JSON.stringify(next.metadata),
      markdownPath,
      next.updatedAt,
      id,
    )
    this.replaceFts(id, next.title, next.content, next.summary, next.tags)
    if (next.markdownPath !== null) this.writeMarkdown(next)
    return next
  }

  async delete(id: KnowledgeId): Promise<boolean> {
    const existing = this.readRow(id)
    if (existing === undefined) return false
    this.db.prepare('DELETE FROM knowledge WHERE id = ?').run(id)
    this.db.prepare('DELETE FROM knowledge_fts WHERE id = ?').run(id)
    if (existing.markdownPath != null && existsSync(existing.markdownPath)) {
      rmSync(existing.markdownPath)
    }
    return true
  }

  async close(): Promise<void> {
    this.db.close()
  }

  private resolveMarkdownPath(id: KnowledgeId): string | null {
    return this.markdownDir === null ? null : join(this.markdownDir, `${id}.md`)
  }

  private readRow(id: KnowledgeId): KnowledgeItem | undefined {
    const row = this.db
      .prepare('SELECT * FROM knowledge WHERE id = ?')
      .get(id) as KnowledgeRow | undefined
    return row === undefined ? undefined : rowToItem(row)
  }

  private replaceFts(
    id: string,
    title: string,
    content: string,
    summary: string | null,
    tags: string[],
  ): void {
    this.db.prepare('DELETE FROM knowledge_fts WHERE id = ?').run(id)
    this.db.prepare(
      'INSERT INTO knowledge_fts (id, title, content, summary, tags) VALUES (?, ?, ?, ?, ?)',
    ).run(id, title, content, summary, tags.join(' '))
  }

  private writeMarkdown(item: KnowledgeItem): void {
    const path = item.markdownPath
    if (path == null) return
    const parent = dirname(path)
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true })
    writeFileSync(path, toMarkdown(item), 'utf8')
  }

  private countAll(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM knowledge').get() as { n: number }
    return row.n
  }
}

/** Project one database row back into a {@link KnowledgeItem}. */
function rowToItem(row: KnowledgeRow): KnowledgeItem {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    content: row.content,
    summary: row.summary,
    category: row.category,
    tags: JSON.parse(row.tags) as string[],
    metadata: JSON.parse(row.metadata) as Record<string, string>,
    markdownPath: row.markdown_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
