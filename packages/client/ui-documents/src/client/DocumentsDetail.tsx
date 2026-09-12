/**
 * The registered `knowledge.detail` entry component for documents: the reader
 * pane shown in KnowledgeRoot's third column. It follows the selection held in
 * the shared {@link useSelectedId} store (written by the workspace list), so a
 * click on a card opens the full document here without any cross-plugin
 * messaging. When nothing is selected — or the `文档` row is not active — the
 * shell leaves this column empty via its `only: active` filter.
 * @module @deepseek-ai/dsh-client-ui-documents/client/DocumentsDetail
 */

import { useEffect, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { DocumentsContext } from './DocumentsContext.ts'
import { useDocuments } from './useDocuments.ts'
import { useSelectedId } from './selectionStore.ts'
import type { DocumentsInjected } from './slots.ts'
import type { KnowledgeItem } from '@deepseek-ai/dsh-knowledge-storage/types'
import { MetadataPanel } from './components/MetadataPanel.tsx'
import { MarkdownView } from './components/MarkdownView.tsx'
import css from './DocumentsDetail.module.css'

/** Composed props: runtime share plus the registrant-injected documents face. */
export type DocumentsDetailProps = PropsRuntime<'knowledge.detail'> & InjectFace<DocumentsInjected>

/**
 * Render the documents detail reader inside its inject-face provider.
 * @param props - composed slot props (runtime share + injected face).
 * @returns the documents detail reader.
 */
export function DocumentsDetail(props: DocumentsDetailProps) {
  return (
    <DocumentsContext.Provider value={{ search: props.search, get: props.get }}>
      <DocumentsDetailInner />
    </DocumentsContext.Provider>
  )
}

/** Inner view: owns the fetched item and the get effect. */
function DocumentsDetailInner() {
  const { get } = useDocuments()
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
    return <p className={css.placeholder}>从左侧选择一篇文档查看详情。</p>
  }
  if (loading && item === null) {
    return <p className={css.placeholder}>加载中…</p>
  }
  if (error !== null) {
    return <p className={css.error} role="alert">{error}</p>
  }
  if (item === null) {
    return <p className={css.placeholder}>未找到该文档。</p>
  }
  return (
    <article className={css.root}>
      <MetadataPanel item={item} />
      <MarkdownView content={item.content} />
    </article>
  )
}
