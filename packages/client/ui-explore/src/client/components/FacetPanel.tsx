/**
 * Facet rail for the explore workspace. Apple-inspired: a calm, low-noise list
 * of category and tag pills that filter the result set. Built atop the platform
 * `Pill` primitive so selection state stays consistent across surfaces.
 * @module @deepseek-ai/dsh-client-ui-explore/client/components/FacetPanel
 */

import { Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './FacetPanel.module.css'

/** Facet panel props. */
export interface FacetPanelProps {
  /** Category counts, pre-sorted by frequency descending. */
  categories: readonly (readonly [string, number])[]
  /** Tag counts, pre-sorted by frequency descending. */
  tags: readonly (readonly [string, number])[]
  /** Currently active category filter. */
  activeCategory: string | null
  /** Currently active tag filter. */
  activeTag: string | null
  /** Called with the next category filter (null clears it). */
  onCategory: (value: string | null) => void
  /** Called with the next tag filter (null clears it). */
  onTag: (value: string | null) => void
}

/**
 * Render the facet rail.
 * @param props - facet data and the two filter sinks.
 * @returns the facet rail.
 */
export function FacetPanel({ categories, tags, activeCategory, activeTag, onCategory, onTag }: FacetPanelProps) {
  return (
    <aside className={css.root}>
      <section className={css.group}>
        <h2 className={css.groupTitle}>分类</h2>
        <div className={css.chips}>
          <Pill active={activeCategory === null} onClick={() => onCategory(null)}>全部</Pill>
          {categories.map(([category, count]) => (
            <Pill
              key={category}
              active={activeCategory === category}
              onClick={() => onCategory(category)}
            >
              {category} · {count}
            </Pill>
          ))}
        </div>
      </section>

      <section className={css.group}>
        <h2 className={css.groupTitle}>标签</h2>
        <div className={css.chips}>
          <Pill active={activeTag === null} onClick={() => onTag(null)}>全部</Pill>
          {tags.map(([tag, count]) => (
            <Pill
              key={tag}
              active={activeTag === tag}
              onClick={() => onTag(tag)}
            >
              #{tag} · {count}
            </Pill>
          ))}
        </div>
      </section>
    </aside>
  )
}
