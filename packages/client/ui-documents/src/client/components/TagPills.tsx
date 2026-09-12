/**
 * Read-only row of tag chips, rendered with the platform `Pill` primitive.
 * @module @deepseek-ai/dsh-client-ui-documents/client/components/TagPills
 */

import { Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './TagPills.module.css'

/** Tag pills props. */
export interface TagPillsProps {
  /** Tag labels to render. */
  tags: string[]
}

/**
 * Render a non-interactive row of tag pills.
 * @param props - the tag labels.
 * @returns the tag row.
 */
export function TagPills({ tags }: TagPillsProps) {
  return (
    <div className={css.root}>
      {tags.map(tag => (
        <Pill key={tag} active={false}>{tag}</Pill>
      ))}
    </div>
  )
}
