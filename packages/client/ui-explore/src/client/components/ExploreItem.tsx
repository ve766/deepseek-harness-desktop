/**
 * One knowledge row in the explore result list. Clicking selects the item
 * (writing its id to the shared selection store) so the detail reader follows.
 * @module @deepseek-ai/dsh-client-ui-explore/client/components/ExploreItem
 */

import type { KnowledgeItem } from '@deepseek-ai/dsh-knowledge-storage/types'
import css from './ExploreItem.module.css'

/** Explore item row props. */
export interface ExploreItemProps {
  /** The knowledge item to render. */
  item: KnowledgeItem
  /** Whether this row is the currently selected one. */
  selected: boolean
  /** Select this item by id. */
  onSelect: (id: string) => void
}

/**
 * Render one explore row.
 * @param props - the item, its selected state, and the select sink.
 * @returns the list row.
 */
export function ExploreItem({ item, selected, onSelect }: ExploreItemProps) {
  const className = selected ? `${css.row} ${css.rowSelected}` : css.row
  return (
    <li className={css.item}>
      <button type="button" className={className} onClick={() => onSelect(item.id)}>
        <h2 className={css.title}>{item.title}</h2>
        {item.summary !== null && item.summary.length > 0 && (
          <p className={css.summary}>{item.summary}</p>
        )}
        <div className={css.meta}>
          {item.category !== null && <span className={css.category}>{item.category}</span>}
          <span className={css.date}>{new Date(item.createdAt).toLocaleDateString()}</span>
        </div>
      </button>
    </li>
  )
}
