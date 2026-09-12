/**
 * P2/Commit5 — Employee Result System (v0.1).
 *
 * Pure derivation layer: `ConversationSnapshot` → `ResultView`.
 *
 * Discipline (no fabrication):
 *   - No runtime field added, no backend contract, no storage.
 *   - Every `ResultItem` is sourced from real snapshot data.
 *   - Supported kinds: text | code | image | file | link.
 *   - `document` is intentionally excluded: runtime has no artifact/file contract.
 *
 * @module @deepseek-ai/dsh-client-ui-desktop/client/workspaceResult
 */

import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'

/** The five result kinds v0.1 models. */
export type ResultItemKind = 'text' | 'code' | 'image' | 'file' | 'link'

interface ResultItemBase {
  kind: ResultItemKind
  /** Source node seq (for ordering / debugging). */
  seq: number
  source: 'assistant' | 'tool-result'
}

export interface TextResultItem extends ResultItemBase {
  kind: 'text'
  text: string
}
export interface CodeResultItem extends ResultItemBase {
  kind: 'code'
  code: string
  language: string | null
}
export interface ImageResultItem extends ResultItemBase {
  kind: 'image'
  attachmentId: string
  mediaType: string
  width: number
  height: number
  name?: string | undefined
}
export interface FileResultItem extends ResultItemBase {
  kind: 'file'
  path: string
  /** What the tool did with the file. */
  action: 'edit' | 'read' | 'search' | 'diff' | 'web'
}
export interface LinkResultItem extends ResultItemBase {
  kind: 'link'
  url: string
  title?: string | undefined
}

export type ResultItem = TextResultItem | CodeResultItem | ImageResultItem | FileResultItem | LinkResultItem

/** The assembled result view-model for one employee's session. */
export interface ResultView {
  /** Products of the most recent turn (tail heuristic). */
  current: ResultItem[]
  /** Earlier completed results, in order. */
  recent: ResultItem[]
  /** True when either bucket was capped. */
  hasMore: boolean
}

/** Default display caps (the Panel can expand beyond these on demand). */
export const CURRENT_CAP = 3
export const RECENT_CAP = 4
/** Hard ceiling on a single text item's rendered length. */
const MAX_TEXT = 280

interface TaggedItem {
  item: ResultItem
  nodeIndex: number
}

const FENCE = /```(\w*)\r?\n([\s\S]*?)```/g

function clampText(text: string): string {
  const t = text.trim()
  return t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT)}…` : t
}

/**
 * Split a markdown text block into text and code items (real content only).
 * Code fences (```lang … ```) become `code` items; surrounding prose becomes
 * `text` items. Nothing is invented — only what the model actually emitted.
 */
function emitTextOrCode(text: string, nodeIndex: number, out: TaggedItem[]): void {
  const parts: Array<{ type: 'text'; text: string } | { type: 'code'; code: string; lang: string | null }> = []
  let last = 0
  let m: RegExpExecArray | null
  FENCE.lastIndex = 0
  while ((m = FENCE.exec(text)) !== null) {
    const before = text.slice(last, m.index).trim()
    if (before) parts.push({ type: 'text', text: before })
    const code = m[2] ?? ''
    parts.push({ type: 'code', code: code.replace(/\n$/, ''), lang: m[1] ? m[1] : null })
    last = FENCE.lastIndex
  }
  const tail = text.slice(last).trim()
  if (tail) parts.push({ type: 'text', text: tail })

  if (parts.length === 0) {
    const t = clampText(text)
    if (t) out.push({ item: { kind: 'text', seq: nodeIndex, source: 'assistant', text: t }, nodeIndex })
    return
  }
  for (const p of parts) {
    if (p.type === 'text') {
      const t = clampText(p.text)
      if (t) out.push({ item: { kind: 'text', seq: nodeIndex, source: 'assistant', text: t }, nodeIndex })
    } else {
      out.push({ item: { kind: 'code', seq: nodeIndex, source: 'assistant', code: p.code, language: p.lang }, nodeIndex })
    }
  }
}

/** Extract text / code / image items from one assistant message's blocks. */
function collectAssistant(blocks: readonly unknown[], nodeIndex: number, out: TaggedItem[]): void {
  for (const block of blocks) {
    if (block === null || typeof block !== 'object') continue
    const b = block as { kind?: unknown }
    if (b.kind === 'text') {
      const text = (block as { text?: unknown }).text
      if (typeof text === 'string') emitTextOrCode(text, nodeIndex, out)
    } else if (b.kind === 'image') {
      // ImageAttachmentRef detection only — no decode (v0.1).
      const att = (block as { attachment?: Record<string, unknown> }).attachment
      if (att && typeof att === 'object') {
        const id = att.attachmentId
        const mediaType = att.mediaType
        if (typeof id === 'string' && typeof mediaType === 'string') {
          out.push({
            item: {
              kind: 'image',
              seq: nodeIndex,
              source: 'assistant',
              attachmentId: id,
              mediaType,
              width: typeof att.width === 'number' ? att.width : 0,
              height: typeof att.height === 'number' ? att.height : 0,
              name: typeof att.name === 'string' ? att.name : undefined,
            },
            nodeIndex,
          })
        }
      }
    }
    // reasoning / tool-call / other → not a deliverable surface in v0.1
  }
}

/**
 * Derive the Result layer for one employee session.
 *
 * File / link items come strictly from a tool result's structured render view
 * (`resultView`): diff `path`s, read `path`, search `path`s, web `url`s. Text and
 * code come from assistant message blocks. Image is detection-only.
 *
 * `current` vs `recent` split uses a tail heuristic: the most recent
 * `assistant` node onward is treated as the current turn. This is an
 * approximation (tool results carry no `turn` field) but introduces no fabricated
 * data.
 *
 * @param snap - live conversation snapshot.
 * @returns the assembled {@link ResultView}.
 */
export function deriveResultView(snap: ConversationSnapshot): ResultView {
  const tagged: TaggedItem[] = []
  let lastAssistantIndex = -1

  snap.nodes.forEach((node, index) => {
    if (node.kind === 'assistant') {
      lastAssistantIndex = index
      collectAssistant(node.blocks, index, tagged)
      return
    }
    if (node.kind !== 'tool-result') return
    if (node.isError) return
    const view = node.resultView
    if (!view) return

    switch (view.card) {
      case 'diff':
        for (const d of view.diffs) {
          if (d.path) tagged.push({ item: { kind: 'file', seq: index, source: 'tool-result', path: d.path, action: 'diff' }, nodeIndex: index })
        }
        break
      case 'read':
        if (view.path) tagged.push({ item: { kind: 'file', seq: index, source: 'tool-result', path: view.path, action: 'read' }, nodeIndex: index })
        break
      case 'search':
        if (view.shape === 'paths') {
          for (const p of view.paths) {
            if (p) tagged.push({ item: { kind: 'file', seq: index, source: 'tool-result', path: p, action: 'search' }, nodeIndex: index })
          }
        } else {
          for (const f of view.files) {
            if (f.path) tagged.push({ item: { kind: 'file', seq: index, source: 'tool-result', path: f.path, action: 'search' }, nodeIndex: index })
          }
        }
        break
      case 'web':
        if (view.kind === 'fetch') {
          if (view.url) tagged.push({ item: { kind: 'link', seq: index, source: 'tool-result', url: view.url, title: undefined }, nodeIndex: index })
        } else {
          for (const s of view.sources) {
            if (s.url) tagged.push({ item: { kind: 'link', seq: index, source: 'tool-result', url: s.url, title: s.title }, nodeIndex: index })
          }
        }
        break
      // generic / terminal → not modeled as deliverables in v0.1 (no fabrication)
      default:
        break
    }
  })

  const current: ResultItem[] = []
  const recent: ResultItem[] = []
  for (const { item, nodeIndex } of tagged) {
    if (lastAssistantIndex >= 0 && nodeIndex >= lastAssistantIndex) current.push(item)
    else recent.push(item)
  }

  const hasMore = current.length > CURRENT_CAP || recent.length > RECENT_CAP
  return { current, recent, hasMore }
}
