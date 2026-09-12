/**
 * The registered `knowledge.workspace` entry component for documents: a search
 * box, a scrollable card list, and a "load more" pager. Every knowledge call
 * flows through {@link useDocuments}; this component never sees a `RemoteResult`.
 * The selected id is written to the shared {@link setSelectedId} store so the
 * detail reader (rendered by a separate `renderSlot`) can follow the selection.
 * @module @deepseek-ai/dsh-client-ui-documents/client/DocumentsWorkspace
 */

import { useEffect, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { DocumentsContext } from './DocumentsContext.ts'
import { useDocuments } from './useDocuments.ts'
import { useSelectedId, setSelectedId } from './selectionStore.ts'
import type { DocumentsInjected } from './slots.ts'
import type { KnowledgeItem } from '@deepseek-ai/dsh-knowledge-storage/types'
import { SearchBar } from './components/SearchBar.tsx'
import { DocumentCard } from './components/DocumentCard.tsx'
import { LoadMore } from './components/LoadMore.tsx'
import css from './DocumentsWorkspace.module.css'

/** Composed props: runtime share plus the registrant-injected documents face. */
export type DocumentsWorkspaceProps = PropsRuntime<'knowledge.workspace'> & InjectFace<DocumentsInjected>

/** Client-only pager steps: 20 → 40 → 80 (the backend exposes no offset). */
const LIMIT_STEPS = [20, 40, 80] as const

/** Largest page the client will request; beyond it the backend cannot page. */
const MAX_LIMIT = LIMIT_STEPS[LIMIT_STEPS.length - 1]

/**
 * Render the documents workspace inside its inject-face provider.
 * @param props - composed slot props (runtime share + injected face).
 * @returns the documents workspace.
 */
export function DocumentsWorkspace(props: DocumentsWorkspaceProps) {
  return (
    <DocumentsContext.Provider value={{ search: props.search, get: props.get }}>
      <DocumentsWorkspaceInner />
    </DocumentsContext.Provider>
  )
}

/** Inner view: owns list state and the fetch effect. */
function DocumentsWorkspaceInner() {
  const { search } = useDocuments()
  const selectedId = useSelectedId()
  const [text, setText] = useState('')
  const [limit, setLimit] = useState<number>(LIMIT_STEPS[0])
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    search({ text, limit })
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
  }, [search, text, limit])

  const canLoadMore = limit < MAX_LIMIT && items.length < total

  return (
    <div className={css.root}>
      <header className={css.header}>
        <h1 className={css.title}>文档</h1>
        <p className={css.subtitle}>
          浏览与检索已导入的知识。共 {total} 条，已显示 {items.length} 条。
        </p>
      </header>

      <SearchBar value={text} onChange={setText} />

      {error !== null && (
        <p className={css.error} role="alert">{error}</p>
      )}

      {items.length === 0 && !loading ? (
        <p className={css.placeholder}>没有匹配的文档。</p>
      ) : (
        <ul className={css.list}>
          {items.map(item => (
            <DocumentCard
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={setSelectedId}
            />
          ))}
        </ul>
      )}

      {canLoadMore && (
        <LoadMore
          loading={loading}
          onLoadMore={() => setLimit(current => Math.min(current * 2, MAX_LIMIT))}
        />
      )}
      {!canLoadMore && items.length < total && (
        <p className={css.note}>已达客户端显示上限（{items.length}/{total}）。</p>
      )}
    </div>
  )
}
