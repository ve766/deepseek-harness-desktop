/**
 * One document row in the workspace list. Clicking selects the item (writing
 * its id to the shared selection store) so the detail reader can follow.
 * @module @deepseek-ai/dsh-client-ui-documents/client/components/DocumentCard
 */

import type { KnowledgeItem } from '@deepseek-ai/dsh-knowledge-storage/types'
import { TagPills } from './TagPills.tsx'
import css from './DocumentCard.module.css'

/** Document card props. */
export interface DocumentCardProps {
  /** The knowledge item to render. */
  item: KnowledgeItem
  /** Whether this card is the currently selected one. */
  selected: boolean
  /** Select this item by id. */
  onSelect: (id: string) => void
}

/**
 * Render one document card.
 * @param props - the item, its selected state, and the select sink.
 * @returns the card list item.
 */
export function DocumentCard({ item, selected, onSelect }: DocumentCardProps) {
  const className = selected ? `${css.card} ${css.cardSelected}` : css.card
  return (
    <li className={css.item}>
      <button type="button" className={className} onClick={() => onSelect(item.id)}>
        <h2 className={css.title}>{item.title}</h2>
        {item.summary !== null && item.summary.length > 0 && (
          <p className={css.summary}>{item.summary}</p>
        )}
        <div className={css.meta}>
          {item.category !== null && item.category.length > 0 && (
            <span className={css.category}>{item.category}</span>
          )}
          <span className={css.date}>{new Date(item.createdAt).toLocaleDateString()}</span>
        </div>
        {item.tags.length > 0 && <TagPills tags={item.tags} />}
      </button>
    </li>
  )
}
