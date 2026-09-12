/**
 * One knowledge row in the search result list. Clicking selects the item
 * (writing its id to the shared selection store) so the detail reader follows.
 * Matched query terms are highlighted with a soft Apple-style mark.
 * @module @deepseek-ai/dsh-client-ui-search/client/components/SearchResultItem
 */

import type { ReactNode } from 'react'
import type { KnowledgeItem } from '@deepseek-ai/dsh-knowledge-storage/types'
import css from './SearchResultItem.module.css'

/** Split `text` and wrap query-matches in a highlight marker. */
function highlight(text: string, query: string): ReactNode {
  const q = query.trim()
  if (q.length === 0) return text
  const lower = text.toLowerCase()
  const needle = q.toLowerCase()
  const parts: ReactNode[] = []
  let i = 0
  let key = 0
  while (i < text.length) {
    const hit = lower.indexOf(needle, i)
    if (hit === -1) {
      parts.push(text.slice(i))
      break
    }
    if (hit > i) parts.push(text.slice(i, hit))
    parts.push(
      <mark key={key++} className={css.match}>{text.slice(hit, hit + needle.length)}</mark>,
    )
    i = hit + needle.length
  }
  return parts
}

/** Search result row props. */
export interface SearchResultItemProps {
  /** The knowledge item to render. */
  item: KnowledgeItem
  /** Currently typed query, used for highlight. */
  query: string
  /** Whether this row is the currently selected one. */
  selected: boolean
  /** Select this item by id. */
  onSelect: (id: string)  => void
}

/**
 * Render one search result row.
 * @param props - the item, query, selected state, and select sink.
 * @returns the list row.
 */
export function SearchResultItem({ item, query, selected, onSelect }: SearchResultItemProps) {
  const className = selected ? `${css.row} ${css.rowSelected}` : css.row
  return (
    <li className={css.item}>
      <button type="button" className={className} onClick={() => onSelect(item.id)}>
        <h2 className={css.title}>{highlight(item.title, query)}</h2>
        {item.summary !== null && item.summary.length > 0 && (
          <p className={css.summary}>{highlight(item.summary, query)}</p>
        )}
        <div className={css.meta}>
          {item.category !== null && <span className={css.category}>{item.category}</span>}
          <span className={css.date}>{new Date(item.createdAt).toLocaleDateString()}</span>
        </div>
      </button>
    </li>
  )
}
