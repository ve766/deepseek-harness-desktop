/**
 * Basic Knowledge Dashboard: loads the most recent items on mount and renders
 * a friendly empty state when the base is empty. The only active surface for
 * Phase 6-B-1-B; search / assistant / graph views land in later phases.
 * @module @deepseek-ai/dsh-client-ui-knowledge/client/views/Dashboard
 */

import { useEffect, useState } from 'react'
import type { KnowledgeItem } from '@deepseek-ai/dsh-knowledge-storage/types'
import { useKnowledge } from '../useKnowledge.ts'
import css from './Dashboard.module.css'

/**
 * Render the Knowledge Dashboard.
 * @returns the Dashboard surface.
 */
export function Dashboard() {
  const knowledge = useKnowledge()
  const [items, setItems] = useState<readonly KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    knowledge.search({ text: '', limit: 20 })
      .then(found => { if (!cancelled) setItems(found) })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [knowledge])

  return (
    <section className={css.root}>
      <header className={css.header}>
        <h1 className={css.title}>知识概览</h1>
        <p className={css.subtitle}>个人知识库 · 共 {items.length} 条</p>
      </header>
      {loading
        ? <div className={css.state}>加载中…</div>
        : error
          ? <div className={`${css.state} ${css.stateError}`}>加载失败：{error}</div>
          : items.length === 0
            ? (
              <div className={css.state}>
                还没有任何知识条目。导入文档后，条目会显示在这里。
              </div>
            )
            : (
              <ul className={css.list}>
                {items.map(item => (
                  <li key={item.id} className={css.card}>
                    <h2 className={css.cardTitle}>{item.title}</h2>
                    {item.summary && <p className={css.cardSummary}>{item.summary}</p>}
                    {item.tags.length > 0 && (
                      <div className={css.tags}>
                        {item.tags.map(tag => (
                          <span key={tag} className={css.tag}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
    </section>
  )
}
