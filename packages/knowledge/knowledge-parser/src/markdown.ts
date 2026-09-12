/**
 * Minimal frontmatter-aware Markdown parser for the AI Knowledge Agent.
 *
 * Only the subset of YAML used by Obsidian-compatible notes is understood:
 * `title`, `tags`, `category`, `source`, `date`, `summary`. Anything unknown is
 * carried verbatim into `metadata`. This keeps the dependency surface zero while
 * remaining compatible with files produced by {@link SqliteKnowledgeStore}.
 *
 * @module @deepseek-ai/dsh-knowledge-parser
 */

import type { KnowledgeItemDraft } from '@deepseek-ai/dsh-knowledge-storage'

export interface ParseOptions {
  /** Origin locator for the parsed text (file path or URL). */
  source?: string
}

/** Strip a single pair of matching quotes from a YAML scalar. */
function unquote(value: string): string {
  const v = value.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  return v
}

/** Parse a `tags` scalar that may be a bracketed list `[a, b]` or `a, b`. */
function parseTags(raw: string): string[] {
  const inner = raw.trim()
  if (inner.startsWith('[') && inner.endsWith(']')) {
    return inner
      .slice(1, -1)
      .split(',')
      .map(unquote)
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
  }
  return inner
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
}

/**
 * Parse a Markdown document (with optional YAML frontmatter) into a draft.
 *
 * Title resolution order: frontmatter `title` → first `#` heading → `Untitled`.
 * The body is everything after the closing `---`, trimmed.
 */
export function parseMarkdown(raw: string, options: ParseOptions = {}): KnowledgeItemDraft {
  const text = raw.trim()
  let title: string | undefined
  let category: string | null = null
  let summary: string | null = null
  const tags: string[] = []
  const metadata: Record<string, string> = {}

  let body = text
  const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (fmMatch) {
    const fmBlock = fmMatch[1] ?? ''
    body = fmMatch[2] ?? ''
    for (const line of fmBlock.split(/\r?\n/)) {
      const idx = line.indexOf(':')
      if (idx === -1) continue
      const key = line.slice(0, idx).trim()
      const value = line.slice(idx + 1).trim()
      switch (key) {
        case 'title':
          title = unquote(value)
          break
        case 'tags':
          tags.push(...parseTags(value))
          break
        case 'category':
          category = unquote(value)
          break
        case 'summary':
          summary = unquote(value)
          break
        case 'date':
          // captured as metadata; not used for timestamps in draft
          metadata.date = value
          break
        default:
          metadata[key] = unquote(value)
      }
    }
  }

  if (title === undefined) {
    // fall back to the first heading
    const heading = body.match(/^\s*#{1,6}\s+(.+)$/m)
    title = heading !== null && heading[1] !== undefined ? heading[1].trim() : 'Untitled'
  }

  const content = body.trim()
  return {
    title,
    source: options.source ?? null,
    content,
    summary,
    category,
    tags,
    metadata,
  }
}
