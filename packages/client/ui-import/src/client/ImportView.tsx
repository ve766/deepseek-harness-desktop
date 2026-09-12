/**
 * The `import` knowledge.workspace entry: source picker + metadata editor +
 * preview + lifecycle state. Every knowledge call flows through
 * {@link useImport}; this component never touches `ctx.remote` and never sees
 * a `RemoteResult`.
 * @module @deepseek-ai/dsh-client-ui-import/client/ImportView
 */

import { useCallback, useMemo, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ImportRequest } from '@deepseek-ai/dsh-knowledge-indexer/types'
// Type-only: pulls the `knowledge.workspace` SlotMap merge (declared by
// ui-knowledge) into the program so the composed props type-check.
import type {} from '@deepseek-ai/dsh-client-ui-knowledge/client'
import { SourcePicker, type SourcePayload } from './components/SourcePicker.tsx'
import { MetadataForm, EMPTY_METADATA, type ImportMetadata } from './components/MetadataForm.tsx'
import { useImport } from './useImport.ts'
import type { ImportKind } from './slots.ts'
import css from './ImportView.module.css'

export type ImportViewProps = PropsRuntime<'knowledge.workspace'>

/** Preview character cap; the remainder is summarized in a trailing line. */
const PREVIEW_LIMIT = 500

/** Matches a leading YAML frontmatter block plus everything after it. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

/**
 * Serialize one frontmatter scalar.
 *
 * Text scalars are JSON-quoted so the parser's `unquote` strips them and
 * embedded colons survive. `tags` is the exception: it is emitted as a bare
 * bracketed list because the parser's `parseTags` only enters its list branch
 * when the raw value starts with `[` — quoting it would break tag splitting.
 */
function scalar(key: string, value: string): string {
  return key === 'tags' ? value : JSON.stringify(value)
}

/**
 * Compose the text actually submitted as `ImportRequest.raw`.
 *
 * `kind === 'text'` never receives frontmatter: the backend's text parser does
 * not strip it, so a `---` block would silently become document body.
 *
 * When the source document already carries frontmatter, the block is merged
 * into a single one (form values win, unknown keys are preserved). Prepending a
 * second block instead would leave the parser reading only the first — and
 * discarding every value entered here.
 * @param body - the raw text produced by the chosen source strategy.
 * @param meta - the metadata form values.
 * @param kind - the selected source kind.
 * @returns the composed raw text.
 */
export function composeRaw(body: string, meta: ImportMetadata, kind: ImportKind): string {
  if (kind !== 'markdown') return body

  const desired: Record<string, string> = {}
  if (meta.title.trim().length > 0) desired.title = meta.title.trim()
  if (meta.tags.length > 0) desired.tags = `[${meta.tags.join(', ')}]`
  if (meta.category.trim().length > 0) desired.category = meta.category.trim()
  if (meta.summary.trim().length > 0) desired.summary = meta.summary.trim()
  if (meta.date !== undefined && meta.date.length > 0) desired.date = meta.date

  const match = FRONTMATTER.exec(body)
  if (match === null) {
    const keys = Object.keys(desired)
    if (keys.length === 0) return body
    const lines = keys.map(key => `${key}: ${scalar(key, desired[key] ?? '')}`)
    return `---\n${lines.join('\n')}\n---\n\n${body}`
  }

  const [, block = '', rest = ''] = match
  const seen = new Set<string>()
  const merged = block.split(/\r?\n/).map(line => {
    const idx = line.indexOf(':')
    if (idx === -1) return line
    const key = line.slice(0, idx).trim()
    if (!(key in desired)) return line
    seen.add(key)
    return `${key}: ${scalar(key, desired[key] ?? '')}`
  })
  for (const key of Object.keys(desired)) {
    if (!seen.has(key)) merged.push(`${key}: ${scalar(key, desired[key] ?? '')}`)
  }

  return `---\n${merged.join('\n')}\n---\n\n${rest}`
}

/**
 * Render the import workspace.
 * @param props - the knowledge.workspace runtime share.
 * @returns the import surface.
 */
export function ImportView(_props: ImportViewProps) {
  const [payload, setPayload] = useState<SourcePayload>({ raw: '', kind: 'text' })
  const [metadata, setMetadata] = useState<ImportMetadata>(EMPTY_METADATA)
  const { status, error, item, run, reset } = useImport()

  const finalRaw = useMemo(
    () => composeRaw(payload.raw, metadata, payload.kind),
    [payload.raw, metadata, payload.kind],
  )
  const importing = status === 'importing'
  const canImport = !importing && finalRaw.trim().length > 0

  const handleSourceChange = useCallback((next: SourcePayload) => {
    setPayload(next)
    // Backfill the file name / URL into source, but never clobber a user edit.
    // Bound to a const first: TS does not carry a property narrowing into the
    // closure, and exactOptionalPropertyTypes rejects `source: string | undefined`.
    const incoming = next.source
    if (incoming !== undefined) {
      setMetadata(current => {
        if (current.source !== undefined) return current
        return { ...current, source: incoming }
      })
    }
  }, [])

  const handleImport = useCallback(async () => {
    const request: ImportRequest = { raw: finalRaw, kind: payload.kind }
    const source = metadata.source?.trim() || payload.source
    if (source !== undefined && source.length > 0) request.source = source
    await run(request)
  }, [finalRaw, payload.kind, payload.source, metadata.source, run])

  const handleReset = useCallback(() => {
    setPayload({ raw: '', kind: 'text' })
    setMetadata(EMPTY_METADATA)
    reset()
  }, [reset])

  const preview = finalRaw.slice(0, PREVIEW_LIMIT)
  const overflow = finalRaw.length - preview.length

  return (
    <div className={css.root}>
      <header className={css.header}>
        <h1 className={css.title}>导入知识</h1>
        <p className={css.subtitle}>
          支持 Markdown 与纯文本。文件在本地读取，URL 在浏览器侧抓取，最终都以正文提交。
        </p>
      </header>

      <div className={css.body}>
        <div className={css.column}>
          <h2 className={css.sectionTitle}>来源</h2>
          <SourcePicker onChange={handleSourceChange} disabled={importing} />

          <h2 className={css.sectionTitle}>元数据</h2>
          <MetadataForm
            value={metadata}
            onChange={setMetadata}
            metadataDisabled={payload.kind === 'text'}
            disabled={importing}
          />
        </div>

        <div className={css.column}>
          <h2 className={css.sectionTitle}>预览</h2>
          <pre className={css.preview}>
            {preview.length > 0 ? preview : <span className={css.placeholder}>尚无内容</span>}
            {overflow > 0 && <span className={css.placeholder}>{`\n… 还有 ${overflow} 字符`}</span>}
          </pre>
          <p className={css.counter}>共 {finalRaw.length} 字符</p>
        </div>
      </div>

      <footer className={css.footer}>
        <div className={css.status} role="status" aria-live="polite">
          {importing && <span>导入中…</span>}
          {status === 'error' && <span className={css.error}>{error}</span>}
          {status === 'success' && (
            <span className={css.success}>导入成功{item?.id !== undefined ? `（id: ${item.id}）` : ''}</span>
          )}
        </div>
        <div className={css.actions}>
          <button type="button" className={css.secondaryButton} disabled={importing} onClick={handleReset}>
            重置
          </button>
          <button type="button" className={css.primaryButton} disabled={!canImport} onClick={handleImport}>
            {importing ? '导入中…' : '导入'}
          </button>
        </div>
      </footer>
    </div>
  )
}

export default ImportView
