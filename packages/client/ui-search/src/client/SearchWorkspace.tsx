/**
 * The registered `knowledge.workspace` entry component for search: a Spotlight-
 * like query field, a calm result list with query highlight, and a light tag
 * filter. Every knowledge call flows through {@link useSearch}; this component
 * never sees a `RemoteResult`. The selected id is written to the shared
 * {@link setSelectedId} store so the detail reader follows the selection.
 * @module @deepseek-ai/dsh-client-ui-search/client/SearchWorkspace
 */

import { useEffect, useMemo, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { SearchContext } from './SearchContext.ts'
import { useSearch } from './useSearch.ts'
import { useSelectedId, setSelectedId } from './selectionStore.ts'
import type { SearchInjected } from './slots.ts'
import type { KnowledgeItem } from '@deepseek-ai/dsh-knowledge-storage/types'
import { SearchBar } from './components/SearchBar.tsx'
import { FilterChips } from './components/FilterChips.tsx'
import { SearchResultItem } from './components/SearchResultItem.tsx'
import css from './SearchWorkspace.module.css'

/** Composed props: runtime share plus the registrant-injected search face. */
export type SearchWorkspaceProps = PropsRuntime<'knowledge.workspace'> & InjectFace<SearchInjected>

/** Initial result window; Load More steps through 20 -> 40 -> 80. */
const LIMITS = [20, 40, 80]

/**
 * Render the search workspace inside its inject-face provider.
 * @param props - composed slot props (runtime share + injected face).
 * @returns the search workspace.
 */
export function SearchWorkspace(props: SearchWorkspaceProps) {
  return (
    <SearchContext.Provider value={{ search: props.search, get: props.get }}>
      <SearchWorkspaceInner />
    </SearchContext.Provider>
  )
}

/** Inner view: owns query, paging, and the fetch effect. */
function SearchWorkspaceInner() {
  const { search } = useSearch()
  const selectedId = useSelectedId()
  const [query, setQuery] = useState('')
  const [limitStep, setLimitStep] = useState(0)
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const limit = LIMITS[Math.min(limitStep, LIMITS.length - 1)]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    search({ text: query, limit })
      .then(page => {
        if (cancelled) return
        setItems(page.items)
        setTotal(page.total)
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [search, query, limit])

  const tagFacets = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [items])

  const visible = useMemo(
    () => activeTag === null ? items : items.filter(item => item.tags.includes(activeTag)),
    [items, activeTag],
  )

  const hasMore = limit < total && limitStep < LIMITS.length - 1

  return (
    <div className={css.root}>
      <header className={css.header}>
        <h1 className={css.title}>检索</h1>
        <p className={css.subtitle}>
          输入关键词，从 {total} 条知识中精确定位你要的那一条。
        </p>
      </header>

      <SearchBar value={query} onSubmit={(text) => { setQuery(text); setLimitStep(0); setActiveTag(null) }} />

      <FilterChips tags={tagFacets} activeTag={activeTag} onTag={setActiveTag} />

      <section className={css.results}>
        {error !== null && (
          <p className={css.error} role="alert">{error}</p>
        )}
        {loading && items.length === 0 && (
          <p className={css.placeholder}>加载中…</p>
        )}
        {!loading && visible.length === 0 && (
          <p className={css.placeholder}>{query.length === 0 ? '输入查询开始检索。' : '未找到匹配的知识。'}</p>
        )}
        <ul className={css.list}>
          {visible.map(item => (
            <SearchResultItem
              key={item.id}
              item={item}
              query={query}
              selected={item.id === selectedId}
              onSelect={setSelectedId}
            />
          ))}
        </ul>
        {hasMore && (
          <button
            type="button"
            className={css.loadMore}
            onClick={() => setLimitStep(s => Math.min(s + 1, LIMITS.length - 1))}
          >
            加载更多
          </button>
        )}
      </section>
    </div>
  )
}
