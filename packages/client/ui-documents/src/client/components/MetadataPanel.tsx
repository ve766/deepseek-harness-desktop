/**
 * Document metadata header shown above the Markdown body in the detail reader.
 * Nullable fields are guarded so partial items still render cleanly; the
 * `markdownPath` is surfaced only as an informational line when present (Q4).
 * @module @deepseek-ai/dsh-client-ui-documents/client/components/MetadataPanel
 */

import type { KnowledgeItem } from '@deepseek-ai/dsh-knowledge-storage/types'
import { TagPills } from './TagPills.tsx'
import css from './MetadataPanel.module.css'

/** Metadata panel props. */
export interface MetadataPanelProps {
  /** The knowledge item whose metadata to render. */
  item: KnowledgeItem
}

/**
 * Render the document metadata header.
 * @param props - the knowledge item.
 * @returns the metadata header.
 */
export function MetadataPanel({ item }: MetadataPanelProps) {
  return (
    <div className={css.root}>
      <h1 className={css.title}>{item.title}</h1>
      {item.summary !== null && item.summary.length > 0 && (
        <p className={css.summary}>{item.summary}</p>
      )}
      <dl className={css.fields}>
        {item.category !== null && item.category.length > 0 && (
          <div className={css.field}>
            <dt className={css.label}>分类</dt>
            <dd className={css.value}>{item.category}</dd>
          </div>
        )}
        <div className={css.field}>
          <dt className={css.label}>创建时间</dt>
          <dd className={css.value}>{new Date(item.createdAt).toLocaleString()}</dd>
        </div>
        {item.source !== null && item.source.length > 0 && (
          <div className={css.field}>
            <dt className={css.label}>来源</dt>
            <dd className={css.value}>{item.source}</dd>
          </div>
        )}
        {item.markdownPath !== undefined && item.markdownPath !== null && (
          <div className={css.field}>
            <dt className={css.label}>Markdown 路径</dt>
            <dd className={css.value}>{item.markdownPath}</dd>
          </div>
        )}
      </dl>
      {item.tags.length > 0 && (
        <div className={css.tags}>
          <span className={css.label}>标签</span>
          <TagPills tags={item.tags} />
        </div>
      )}
    </div>
  )
}
