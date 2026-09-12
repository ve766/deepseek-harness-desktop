/**
 * P2/Commit7 — Employee Memory & Knowledge Entry (v0.1).
 *
 * Pure derivation layer: `ConversationSnapshot` → `KnowledgeDraftView`.
 *
 * Discipline (no fabrication):
 *   - No runtime field added, no backend contract, no storage on the derive side.
 *   - The draft is built ONLY from real snapshot data (assistant message text).
 *   - `ConversationSnapshot` has no title / summary / artifact field, so both
 *     `title` and `summary` are derived from the conversation text (first user
 *     question → title; head of the last assistant answer → summary). Nothing
 *     invented.
 *   - `category` is fixed to `employee-work` (v0.1 validates the Employee →
 *     Knowledge OS flow); `tags` carries `employee.id` only.
 *   - Saving is MANUAL (a button). Never automatic. No feedback / goal / artifact.
 *
 * @module @deepseek-ai/dsh-client-ui-desktop/client/workspaceKnowledge
 */

import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { Employee } from '../types.ts'

/** Fixed knowledge category for v0.1 (validates the Employee → Knowledge OS flow). */
export const KNOWLEDGE_CATEGORY = 'employee-work'

/** Hard ceiling on a derived title's rendered length. */
const MAX_TITLE = 60
/** Hard ceiling on a derived summary's rendered length. */
const MAX_SUMMARY = 140

/** Reason saving is currently disabled, for the disabled-state hint. */
export type KnowledgeDisabledReason = 'empty' | 'running' | 'pending'

/** The derived, save-ready knowledge draft for one employee's session. */
export interface KnowledgeDraftView {
  /** Whether the snapshot currently yields saveable content. */
  canSave: boolean
  /** Why saving is disabled, when {@link canSave} is false (null when saveable). */
  disabledReason: KnowledgeDisabledReason | null
  /** Derived note title. */
  title: string
  /** Derived markdown body (no frontmatter). */
  body: string
  /** Derived one-line summary. */
  summary: string
  /** Fixed category. */
  category: 'employee-work'
  /** Tags: `employee.id` only (v0.1). */
  tags: string[]
}

/** Collect plain text from a message node's text blocks (assistant `blocks` or
 *  user `content` — both expose a `text` block variant, so the shape-agnostic
 *  walk is safe across both node kinds). */
function textOf(blocks: readonly unknown[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block === null || typeof block !== 'object') continue
    const b = block as { kind?: unknown; text?: unknown }
    if (b.kind === 'text' && typeof b.text === 'string') parts.push(b.text)
  }
  return parts.join('\n\n').trim()
}

/** Collapse whitespace and clamp to a display length with an ellipsis. */
function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/**
 * Derive the Knowledge Entry draft for one employee session.
 *
 * Title ← first user message (the request); body ← last assistant answer; summary
 * ← head of the body. Saving is disabled while the session is still running or has
 * unresolved pending interactions (no mid-flight capture, no auto-save).
 *
 * @param snap - live conversation snapshot.
 * @param employee - the owning employee (for the stable tag).
 * @returns the derived {@link KnowledgeDraftView}.
 */
export function deriveKnowledgeDraft(snap: ConversationSnapshot, employee: Employee): KnowledgeDraftView {
  // No saveable content while the employee is still working or awaiting input.
  if (snap.running) {
    return { canSave: false, disabledReason: 'running', title: '', body: '', summary: '', category: KNOWLEDGE_CATEGORY, tags: [employee.id] }
  }
  if (snap.pending.length > 0) {
    return { canSave: false, disabledReason: 'pending', title: '', body: '', summary: '', category: KNOWLEDGE_CATEGORY, tags: [employee.id] }
  }

  let firstQuestion = ''
  let lastAnswer = ''
  for (const node of snap.nodes) {
    if (node.kind === 'user') {
      if (firstQuestion === '') firstQuestion = textOf(node.content)
    } else if (node.kind === 'assistant') {
      const text = textOf(node.blocks)
      if (text !== '') lastAnswer = text
    }
  }

  if (lastAnswer === '') {
    return { canSave: false, disabledReason: 'empty', title: '', body: '', summary: '', category: KNOWLEDGE_CATEGORY, tags: [employee.id] }
  }

  const title = firstQuestion !== '' ? truncate(firstQuestion, MAX_TITLE) : truncate(lastAnswer, MAX_TITLE)
  const summary = truncate(lastAnswer, MAX_SUMMARY)

  return {
    canSave: true,
    disabledReason: null,
    title,
    body: lastAnswer,
    summary,
    category: KNOWLEDGE_CATEGORY,
    tags: [employee.id],
  }
}
