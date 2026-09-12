/**
 * P2/Commit5 — Result Panel.
 *
 * Renders the derived {@link ResultView}: the employee's delivered results.
 * Apple-restrained: progressive disclosure, no empty placeholders, no fabricated
 * data — every item traces back to a real snapshot source.
 *
 * @module @deepseek-ai/dsh-client-ui-desktop/client/ResultPanel
 */
import { useState } from 'react'
import { MarkdownText, CodeBlock, Button, Pill, writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  CURRENT_CAP,
  RECENT_CAP,
  type ResultView,
  type ResultItem,
  type FileResultItem,
} from '../workspaceResult.ts'
import css from './ResultPanel.module.css'

const ACTION_LABEL: Record<FileResultItem['action'], string> = {
  edit: '编辑',
  read: '读取',
  search: '搜索',
  diff: '差异',
  web: '网页',
}

/** One file result: action badge + path + copy affordance. */
function FileRow({ item }: { item: FileResultItem }) {
  const [copied, setCopied] = useState(false)
  const onCopy = () => {
    void writeClipboard(item.path).then((ok) => {
      if (!ok) return
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    })
  }
  return (
    <div className={css.fileRow}>
      <Pill>{ACTION_LABEL[item.action]}</Pill>
      <span className={css.filePath} title={item.path}>{item.path}</span>
      <button type="button" className={css.copyBtn} onClick={onCopy}>
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  )
}

/** Render a single result item by its kind. */
function ItemView({ item }: { item: ResultItem }) {
  switch (item.kind) {
    case 'text':
      return (
        <div className={css.textItem}>
          <MarkdownText text={item.text} />
        </div>
      )
    case 'code':
      return (
        <div className={css.codeItem}>
          <CodeBlock code={item.code} lang={item.language ?? undefined} />
        </div>
      )
    case 'image':
      // Detection only: we surface the asset's label, never a fabricated URL.
      return <div className={css.imageChip}>图片 · {item.name ?? item.mediaType}</div>
    case 'file':
      return <FileRow item={item} />
    case 'link':
      return (
        <a className={css.linkItem} href={item.url} target="_blank" rel="noopener noreferrer">
          {item.title ? `${item.title} — ${item.url}` : item.url}
        </a>
      )
  }
}

/** One labelled bucket (current / recent) with an optional expand control. */
function Bucket({ label, items, cap }: { label: string; items: ResultItem[]; cap: number }) {
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null
  const shown = expanded ? items : items.slice(0, cap)
  return (
    <div className={css.bucket}>
      <div className={css.bucketLabel}>{label}</div>
      <div className={css.bucketItems}>
        {shown.map((it, i) => (
          <ItemView key={`${it.kind}-${it.seq}-${i}`} item={it} />
        ))}
      </div>
      {items.length > cap && (
        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? '收起' : `展开全部 (${items.length})`}
        </Button>
      )}
    </div>
  )
}

/** The Result Panel: the employee's delivered output, replacing the old placeholder. */
export function ResultPanel({ result }: { result: ResultView }) {
  if (result.current.length === 0 && result.recent.length === 0) return null
  return (
    <div className={css.root}>
      <div className={css.blockLabel}>产出</div>
      <Bucket label="当前任务产物" items={result.current} cap={CURRENT_CAP} />
      <Bucket label="最近结果" items={result.recent} cap={RECENT_CAP} />
    </div>
  )
}
