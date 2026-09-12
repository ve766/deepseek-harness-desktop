/**
 * Lightweight tag filter for the search workspace. Apple-inspired: a single-row
 * of low-saturation pills derived from the current result set — no dense filter
 * rail, no control wall.
 * @module @deepseek-ai/dsh-client-ui-search/client/components/FilterChips
 */

import { Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './FilterChips.module.css'

/** Filter chips props. */
export interface FilterChipsProps {
  /** Tag counts, pre-sorted by frequency descending. */
  tags: readonly (readonly [string, number])[]
  /** Currently active tag filter. */
  activeTag: string | null
  /** Called with the next tag filter (null clears it). */
  onTag: (value: string | null) => void
}

/**
 * Render the tag filter row.
 * @param props - tag data and the filter sink.
 * @returns the chip row.
 */
export function FilterChips({ tags, activeTag, onTag }: FilterChipsProps) {
  if (tags.length === 0) return null
  return (
    <div className={css.root}>
      <Pill active={activeTag === null} onClick={() => onTag(null)}>全部</Pill>
      {tags.map(([tag, count]) => (
        <Pill
          key={tag}
          active={activeTag === tag}
          onClick={() => onTag(tag)}
        >
          {tag} · {count}
        </Pill>
      ))}
    </div>
  )
}
