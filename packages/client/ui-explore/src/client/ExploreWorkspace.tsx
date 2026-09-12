/**
 * The registered `knowledge.workspace` entry component for explore: a facet rail
 * (category + tag) and a calm, airy result list. Every knowledge call flows
 * through {@link useExplore}; this component never sees a `RemoteResult`. The
 * selected id is written to the shared {@link setSelectedId} store so the
 * detail reader (rendered by a separate `renderSlot`) can follow the selection.
 * @module @deepseek-ai/dsh-client-ui-explore/client/ExploreWorkspace
 */

import { useEffect, useMemo, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { ExploreContext } from './ExploreContext.ts'
import { useExplore } from './useExplore.ts'
import { useSelectedId, setSelectedId } from './selectionStore.ts'
import type { ExploreInjected } from './slots.ts'
import type { KnowledgeItem } from '@deepseek-ai/dsh-knowledge-storage/types'
import { FacetPanel } from './components/FacetPanel.tsx'
import { ExploreItem } from './components/ExploreItem.tsx'
import css from './ExploreWorkspace.module.css'

/** Composed props: runtime share plus the registrant-injected explore face. */
export type ExploreWorkspaceProps = PropsRuntime<'knowledge.workspace'> & InjectFace<ExploreInjected>

/** Client-side ceiling for the initial corpus scan; the backend exposes no offset. */
const SCAN_LIMIT = 80

/**
 * Render the explore workspace inside its inject-face provider.
 * @param props - composed slot props (runtime share + injected face).
 * @returns the explore workspace.
 */
export function ExploreWorkspace(props: ExploreWorkspaceProps) {
  return (
    <ExploreContext.Provider value={{ search: props.search, get: props.get }}>
      <ExploreWorkspaceInner />
    </ExploreContext.Provider>
  )
}

/** Inner view: owns list state, facet computation, and the fetch effect. */
function ExploreWorkspaceInner() {
  const { search } = useExplore()
  const selectedId = useSelectedId()
  const [all, setAll] = useState<KnowledgeItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    search({ limit: SCAN_LIMIT })
      .then(page => {
        if (cancelled) return
        setAll(page.items)
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
  }, [search])

  const facets = useMemo(() => {
    const categories = new Map<string, number>()
    const tags = new Map<string, number>()
    for (const item of all) {
      if (item.category !== null) {
        categories.set(item.category, (categories.get(item.category) ?? 0) + 1)
      }
      for (const tag of item.tags) {
        tags.set(tag, (tags.get(tag) ?? 0) + 1)
      }
    }
    return {
      categories: [...categories.entries()].sort((a, b) => b[1] - a[1]),
      tags: [...tags.entries()].sort((a, b) => b[1] - a[1]),
    }
  }, [all])

  const visible = useMemo(() => all.filter(item => {
    if (activeCategory !== null && item.category !== activeCategory) return false
    if (activeTag !== null && !item.tags.includes(activeTag)) return false
    return true
  }), [all, activeCategory, activeTag])

  return (
    <div className={css.root}>
      <header className={css.header}>
        <h1 className={css.title}>探索</h1>
        <p className={css.subtitle}>
          在 {total} 条知识中自由发现关联，按分类与标签浏览。
        </p>
      </header>

      <div className={css.body}>
        <FacetPanel
          categories={facets.categories}
          tags={facets.tags}
          activeCategory={activeCategory}
          activeTag={activeTag}
          onCategory={setActiveCategory}
          onTag={setActiveTag}
        />

        <section className={css.results}>
          {error !== null && (
            <p className={css.error} role="alert">{error}</p>
          )}
          {loading && all.length === 0 && (
            <p className={css.placeholder}>加载中…</p>
          )}
          {!loading && visible.length === 0 && (
            <p className={css.placeholder}>暂无匹配的知识。</p>
          )}
          <ul className={css.list}>
            {visible.map(item => (
              <ExploreItem
                key={item.id}
                item={item}
                selected={item.id === selectedId}
                onSelect={setSelectedId}
              />
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
