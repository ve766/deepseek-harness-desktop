/**
 * Source picker: the three ways a document enters the importer.
 *
 * "File / URL / text" are not three remote capabilities — the Host Remote only
 * accepts `{ source?, raw, kind }`. They are three strategies for producing
 * `raw` locally: read a File, fetch a URL, or type into a textarea.
 * @module @deepseek-ai/dsh-client-ui-import/client/components/SourcePicker
 */

import { useCallback, useEffect, useState } from 'react'
import type { ImportKind } from '../slots.ts'
import css from './SourcePicker.module.css'

/** Normalized outcome of any source strategy. */
export interface SourcePayload {
  raw: string
  kind: ImportKind
  /** Origin locator; absent for pasted text with no name. */
  source?: string
}

export interface SourcePickerProps {
  onChange(payload: SourcePayload): void
  /** Disables interaction while an import is in flight. */
  disabled?: boolean
}

type TabId = 'file' | 'url' | 'text'

const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'file', label: '文件' },
  { id: 'url', label: 'URL' },
  { id: 'text', label: '文本' },
]

/** Markdown extensions map to the frontmatter-aware kind; everything else is text. */
function inferKind(fileName: string): ImportKind {
  return /\.(md|markdown)$/i.test(fileName) ? 'markdown' : 'text'
}

/**
 * Render the three-strategy source picker.
 * @param props - change sink and disable flag.
 * @returns the source picker.
 */
export function SourcePicker({ onChange, disabled }: SourcePickerProps) {
  const [tab, setTab] = useState<TabId>('text')
  const [raw, setRaw] = useState('')
  const [kind, setKind] = useState<ImportKind>('text')
  const [source, setSource] = useState<string | undefined>(undefined)
  const [urlInput, setUrlInput] = useState('')
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Re-normalize on every input change; blank source drops the key.
  useEffect(() => {
    const payload: SourcePayload = { raw, kind }
    if (source !== undefined && source.length > 0) payload.source = source
    onChange(payload)
  }, [raw, kind, source, onChange])

  const readFile = useCallback((file: File | undefined) => {
    setFetchError(null)
    if (file === undefined) return
    const reader = new FileReader()
    reader.onerror = () => { setFetchError('文件读取失败，请重试。') }
    reader.onload = () => {
      setRaw(typeof reader.result === 'string' ? reader.result : '')
      setKind(inferKind(file.name))
      setSource(file.name)
    }
    reader.readAsText(file)
  }, [])

  const fetchUrl = useCallback(async () => {
    setFetchError(null)
    const url = urlInput.trim()
    if (url.length === 0) {
      setFetchError('请填写 URL。')
      return
    }
    try {
      const response = await fetch(url)
      if (!response.ok) {
        setFetchError(`抓取失败：HTTP ${response.status}`)
        return
      }
      setRaw(await response.text())
      // A fetched body has no reliable type signal; default to text, user may override.
      setKind('text')
      setSource(url)
    } catch (err) {
      // CORS and network failures surface here rather than reaching the remote.
      setFetchError(`抓取失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }, [urlInput])

  return (
    <div className={css.picker}>
      <div className={css.tabs} role="tablist">
        {TABS.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? `${css.tab} ${css.tabActive}` : css.tab}
            disabled={disabled}
            onClick={() => { setTab(item.id) }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'file' && (
        <div className={css.panel}>
          <input
            type="file"
            className={css.fileInput}
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            disabled={disabled}
            onChange={event => { readFile(event.target.files?.[0]) }}
          />
          <p className={css.hint}>支持 .md / .markdown / .txt。文件在本地读取，仅正文上传。</p>
          {source !== undefined && <p className={css.meta}>已选择：{source}</p>}
        </div>
      )}

      {tab === 'url' && (
        <div className={css.panel}>
          <div className={css.row}>
            <input
              type="url"
              className={css.input}
              placeholder="https://example.com/article.md"
              value={urlInput}
              disabled={disabled}
              onChange={event => { setUrlInput(event.target.value) }}
            />
            <button type="button" className={css.button} disabled={disabled} onClick={fetchUrl}>
              抓取
            </button>
          </div>
          <p className={css.hint}>抓取后内容填入预览，可再编辑。跨域站点可能因 CORS 失败。</p>
        </div>
      )}

      {tab === 'text' && (
        <div className={css.panel}>
          <textarea
            className={css.textarea}
            placeholder="在此粘贴 Markdown 或纯文本…"
            value={raw}
            disabled={disabled}
            onChange={event => {
              setRaw(event.target.value)
              setSource(undefined)
            }}
          />
        </div>
      )}

      {fetchError !== null && <p className={css.error}>{fetchError}</p>}

      <div className={css.kindRow}>
        <span className={css.kindLabel}>正文格式</span>
        <div className={css.tabs}>
          {(['markdown', 'text'] as ImportKind[]).map(item => (
            <button
              key={item}
              type="button"
              className={kind === item ? `${css.tab} ${css.tabActive}` : css.tab}
              disabled={disabled}
              onClick={() => { setKind(item) }}
            >
              {item === 'markdown' ? 'Markdown' : '纯文本'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SourcePicker
