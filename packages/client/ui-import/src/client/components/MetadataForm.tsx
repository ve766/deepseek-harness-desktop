/**
 * Metadata editor for the pending import.
 *
 * Phase 6-B-2-B scope: `title`, `tags`, `category`, `summary` (all persisted
 * through Markdown frontmatter) plus `source`, which maps onto
 * `ImportRequest.source` directly and therefore works for both kinds.
 *
 * `date` is deliberately absent from the UI — `composeRaw` can emit it, but
 * this phase exposes no field for it.
 * @module @deepseek-ai/dsh-client-ui-import/client/components/MetadataForm
 */

import { useState } from 'react'
import css from './MetadataForm.module.css'

/** Editable metadata for the pending import. */
export interface ImportMetadata {
  title: string
  tags: string[]
  category: string
  summary: string
  /** Maps onto `ImportRequest.source`; absent when blank. */
  source?: string
  /**
   * Supported by `composeRaw` but deliberately not surfaced in the UI this
   * phase; the backend folds a frontmatter `date` into `KnowledgeItem.metadata`.
   */
  date?: string
}

/** The blank metadata a reset import starts from. */
export const EMPTY_METADATA: ImportMetadata = {
  title: '',
  tags: [],
  category: '',
  summary: '',
}

export interface MetadataFormProps {
  value: ImportMetadata
  onChange(next: ImportMetadata): void
  /** True while `kind === 'text'`: frontmatter keys are not parsed, so editing them would silently discard input. */
  metadataDisabled: boolean
  /** Disables every control while an import is in flight. */
  disabled?: boolean
}

/**
 * Render the metadata editor.
 * @param props - current value, change sink, and the two disable flags.
 * @returns the metadata form.
 */
export function MetadataForm({ value, onChange, metadataDisabled, disabled }: MetadataFormProps) {
  const [tagsText, setTagsText] = useState(value.tags.join(', '))
  const lockField = metadataDisabled || disabled === true

  const commitTags = (text: string): void => {
    onChange({
      ...value,
      tags: text.split(/[,，]/).map(tag => tag.trim()).filter(tag => tag.length > 0),
    })
  }

  return (
    <div className={css.form}>
      <label className={css.field}>
        <span className={css.label}>标题</span>
        <input
          type="text"
          className={css.input}
          placeholder="留空则由正文首个标题推断"
          value={value.title}
          disabled={lockField}
          onChange={event => { onChange({ ...value, title: event.target.value }) }}
        />
      </label>

      <label className={css.field}>
        <span className={css.label}>标签</span>
        <input
          type="text"
          className={css.input}
          placeholder="用逗号分隔，如：AI, 产品"
          value={tagsText}
          disabled={lockField}
          onChange={event => {
            setTagsText(event.target.value)
            commitTags(event.target.value)
          }}
        />
      </label>

      <label className={css.field}>
        <span className={css.label}>分类</span>
        <input
          type="text"
          className={css.input}
          placeholder="可选，如：商业分析"
          value={value.category}
          disabled={lockField}
          onChange={event => { onChange({ ...value, category: event.target.value }) }}
        />
      </label>

      <label className={css.field}>
        <span className={css.label}>摘要</span>
        <textarea
          className={css.textarea}
          placeholder="可选，一句话概括"
          value={value.summary}
          disabled={lockField}
          onChange={event => { onChange({ ...value, summary: event.target.value }) }}
        />
      </label>

      <label className={css.field}>
        <span className={css.label}>来源</span>
        <input
          type="text"
          className={css.input}
          placeholder="文件名或 URL"
          value={value.source ?? ''}
          disabled={disabled}
          onChange={event => {
            const next: ImportMetadata = { ...value }
            const trimmed = event.target.value.trim()
            // exactOptionalPropertyTypes: drop the key instead of assigning undefined.
            if (trimmed.length > 0) next.source = trimmed
            else delete next.source
            onChange(next)
          }}
        />
      </label>

      {metadataDisabled && (
        <p className={css.notice}>纯文本不解析 frontmatter，元数据字段已停用。</p>
      )}

      {value.tags.length > 0 && (
        <div className={css.chips}>
          {value.tags.map(tag => (
            <span key={tag} className={css.chip}>{tag}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default MetadataForm
