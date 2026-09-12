/**
 * Plain-text ingestion for the AI Knowledge Agent.
 *
 * Manual notes and `.txt` files are wrapped into a draft with no frontmatter.
 * The first non-empty line is used as the title when it is short (<= 80 chars);
 * otherwise the document is titled `Manual Note`.
 *
 * @module @deepseek-ai/dsh-knowledge-parser
 */

import type { KnowledgeItemDraft } from '@deepseek-ai/dsh-knowledge-storage'
import type { ParseOptions } from './markdown.ts'

/**
 * Parse plain text into a draft.
 *
 * Text coming from the user (manual input) is always `source: 'manual'`.
 */
export function parseText(raw: string, options: ParseOptions = {}): KnowledgeItemDraft {
  const content = raw.trim()
  const firstLine = content.split(/\r?\n/)[0] ?? ''
  const title =
    firstLine.length > 0 && firstLine.length <= 80 ? firstLine : 'Manual Note'
  return {
    title,
    source: options.source ?? 'manual',
    content,
    summary: null,
    category: null,
    tags: [],
    metadata: {},
  }
}
