/**
 * The registered `knowledge.detail` entry component for explore: the reader
 * pane shown in KnowledgeRoot's third column. It follows the selection held in
 * the package-local {@link useSelectedId} store (written by the workspace list),
 * so a click on a card opens the full document here without cross-plugin
 * messaging. When nothing is selected — or the `探索` row is not active — the
 * shell leaves this column empty via its `only: active` filter.
 * @module @deepseek-ai/dsh-client-ui-explore/client/ExploreDetail
 */

import { useEffect, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { ExploreContext } from './ExploreContext.ts'
import { useExplore } from './useExplore.ts'
import { useSelectedId } from './selectionStore.ts'
import type { ExploreInjected } from './slots.ts'
import type { KnowledgeItem } from '@deepseek-ai/dsh-knowledge-storage/types'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './ExploreDetail.module.css'

/** Composed props: runtime share plus the registrant-injected explore face. */
export type ExploreDetailProps = PropsRuntime<'knowledge.detail'> & InjectFace<ExploreInjected>

/**
 * Render the explore detail reader inside its inject-face provider.
 * @param props - composed slot props (runtime share + injected face).
 * @returns the explore detail reader.
 */
export function ExploreDetail(props: ExploreDetailProps) {
  return (
    <ExploreContext.Provider value={{ search: props.search, get: props.get }}>
      <ExploreDetailInner />
    </ExploreContext.Provider>
  )
}

/** Inner view: owns the fetched item and the get effect. */
function ExploreDetailInner() {
  const { get } = useExplore()
  const selectedId = useSelectedId()
  const [item, setItem] = useState<KnowledgeItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedId === null) {
      setItem(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    get(selectedId)
      .then(fetched => {
        if (cancelled) return
        setItem(fetched)
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [get, selectedId])

  if (selectedId === null) {
    return <p className={css.placeholder}>从左侧选择一项以查看详情。</p>
  }
  if (loading && item === null) {
    return <p className={css.placeholder}>加载中…</p>
  }
  if (error !== null) {
    return <p className={css.error} role="alert">{error}</p>
  }
  if (item === null) {
    return <p className={css.placeholder}>未找到该条目。</p>
  }
  return (
    <article className={css.root}>
      <div className={css.meta}>
        {item.category !== null && <span className={css.category}>{item.category}</span>}
        <span className={css.date}>{new Date(item.createdAt).toLocaleDateString()}</span>
      </div>
      <h1 className={css.title}>{item.title}</h1>
      {item.summary !== null && item.summary.length > 0 && (
        <p className={css.summary}>{item.summary}</p>
      )}
      <MarkdownText text={item.content} streaming={false} />
    </article>
  )
}
