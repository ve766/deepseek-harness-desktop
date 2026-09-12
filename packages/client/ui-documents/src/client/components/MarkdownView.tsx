/**
 * Document body renderer. Delegates to the platform `MarkdownText` primitive —
 * this package does not ship its own Markdown renderer (F2).
 * @module @deepseek-ai/dsh-client-ui-documents/client/components/MarkdownView
 */

import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './MarkdownView.module.css'

/** Markdown view props. */
export interface MarkdownViewProps {
  /** Raw Markdown source of the document body. */
  content: string
}

/**
 * Render a Markdown document body.
 * @param props - the Markdown source.
 * @returns the rendered body.
 */
export function MarkdownView({ content }: MarkdownViewProps) {
  return (
    <div className={css.root}>
      <MarkdownText text={content} streaming={false} />
    </div>
  )
}
