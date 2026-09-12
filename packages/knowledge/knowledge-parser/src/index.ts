/**
 * Parser entry point for the AI Knowledge Agent.
 *
 * Exposes the two first-version ingestion paths: Markdown (with frontmatter)
 * and plain text / manual input. PDF and video parsing are intentionally
 * excluded from the MVP and will be added in a later phase.
 *
 * @module @deepseek-ai/dsh-knowledge-parser
 */

export { parseMarkdown } from './markdown.ts'
export { parseText } from './text.ts'
export type { ParseOptions } from './markdown.ts'
