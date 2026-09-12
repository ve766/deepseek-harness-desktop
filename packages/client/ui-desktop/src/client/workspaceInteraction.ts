/**
 * P2/Commit6 — Employee Interaction Layer (v0.1).
 *
 * Pure derivation layer: `ConversationSnapshot` → `InteractionView`.
 *
 * Discipline (no fabrication):
 *   - No runtime field added, no backend contract, no storage.
 *   - Only capabilities that actually exist in the runtime are modelled.
 *     **`retry` and `continue` are deliberately absent**: the runtime exposes no
 *     retry verb and no continue verb (`ModelRetryNode` / `TurnMaxTokensNode`
 *     are read-only notifications the client merely observes). The one outbound
 *     message verb available is a brand-new queued prompt, surfaced honestly as
 *     「继续对话」 — never as 「重试」 / 「恢复」 / 「继续生成」.
 *
 * Actions are NOT carried by this view: the panel binds them at render time
 * (see InteractionPanel.tsx) against the live `pending` carrier, so this module
 * stays pure data.
 *
 * @module @deepseek-ai/dsh-client-ui-desktop/client/workspaceInteraction
 */

import type { ConversationSnapshot, PendingInteraction } from '@deepseek-ai/dsh-client-runtime/client'
import type { AskUserQuestionItem, AskUserQuestionOption } from '@deepseek-ai/dsh-user-questions/types'

/**
 * Interaction kinds, in derivation priority order.
 * `retry` / `continue` are intentionally not members.
 */
export type InteractionKind = 'approve' | 'question' | 'error' | 'settled' | 'none'

/** A tool-call approval awaiting the user's verdict. */
export interface ApproveView {
  toolName: string
  reason: string | null
}

/** One selectable option of a question. */
export interface QuestionOptionView {
  label: string
  description: string | null
}

/** One question in a user-questions batch. */
export interface QuestionItemView {
  /** Echoed back to the host in the answer payload. */
  id: string
  header: string | null
  question: string
  /** For a plan-review this carries the plan markdown. */
  detail: string | null
  multiSelect: boolean
  options: QuestionOptionView[]
}

/** The whole question batch (a host ask() is answered as one batch). */
export interface QuestionView {
  items: QuestionItemView[]
  /**
   * Presentation hint only — `plan-review` is a narrowing of a plain question,
   * not a separate protocol kind. The answer encoding is identical either way.
   */
  planReview: boolean
}

/** The derived interaction state for one employee's session. */
export interface InteractionView {
  kind: InteractionKind
  /** Headline, null when the panel should render no header. */
  message: string | null
  /** Pending carrier key; the panel uses it to find the wait and respond. */
  key: string | null
  /** Total pending waits, so the UI can be honest when it renders only the first. */
  pendingCount: number
  approve?: ApproveView | undefined
  question?: QuestionView | undefined
}

/** Read an optional string field, normalising blanks to null. */
function optText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** Project an approval wait's payload into display data. */
function readApprove(wait: Extract<PendingInteraction, { kind: 'approval' }>): ApproveView {
  const payload = wait.payload
  return {
    toolName: optText(payload.toolName) ?? '工具调用',
    reason: optText(payload.reason),
  }
}

/** Project a question wait's payload into display data. */
function readQuestion(wait: Extract<PendingInteraction, { kind: 'question' }>): QuestionView {
  const questions = wait.payload.questions
  const items: QuestionItemView[] = questions.map((item: AskUserQuestionItem) => ({
    id: item.id,
    header: optText(item.header),
    question: item.question,
    detail: optText(item.detail),
    multiSelect: item.multiSelect === true,
    options: (item.options ?? []).map((option: AskUserQuestionOption) => ({
      label: option.label,
      description: optText(option.description),
    })),
  }))

  // plan-review narrowing: exactly one question, tagged with the intent,
  // carrying the plan body, single-select, and at most two named options —
  // one of which is the intent's approve label.
  const first = questions[0]
  const options = first?.options ?? []
  const intent = first?.intent
  const planReview =
    questions.length === 1 &&
    first !== undefined &&
    intent !== undefined &&
    intent.kind === 'plan-review' &&
    optText(first.detail) !== null &&
    first.multiSelect !== true &&
    options.length <= 2 &&
    options.some((option: AskUserQuestionOption) => option.label === intent.approve)

  return { items, planReview }
}

/**
 * Derive the interaction state for one employee session.
 *
 * Priority (highest first) — a pending wait outranks an error because it is an
 * action the user can take to unblock progress, whereas an error is only
 * informational:
 *   1. pending approval   → 'approve'
 *   2. pending question   → 'question'   (plan-review is a presentation tag)
 *   3. lastAgentError / openState === 'error' → 'error'
 *   4. running            → 'none'  (nothing for the user to do)
 *   5. settled            → 'settled'
 *   6. otherwise          → 'none'
 *
 * @param snap - live conversation snapshot.
 * @returns the assembled {@link InteractionView}.
 */
export function deriveInteractionView(snap: ConversationSnapshot): InteractionView {
  const pendingCount = snap.pending.length
  const wait = snap.pending[0]

  if (wait !== undefined) {
    if (wait.kind === 'approval') {
      return {
        kind: 'approve',
        message: '需要你确认',
        key: wait.key,
        pendingCount,
        approve: readApprove(wait),
      }
    }
    const question = readQuestion(wait)
    return {
      kind: 'question',
      message: question.planReview ? '计划待确认' : '需要你选择',
      key: wait.key,
      pendingCount,
      question,
    }
  }

  // Informational only: the runtime exposes no retry verb, so the panel offers
  // no retry button — a follow-up is a brand-new queued prompt, not a re-run.
  if (snap.lastAgentError !== null || snap.openState === 'error') {
    return {
      kind: 'error',
      message: snap.lastAgentError ?? '会话打开失败',
      key: null,
      pendingCount,
    }
  }

  if (snap.running) {
    return { kind: 'none', message: null, key: null, pendingCount }
  }

  if (!snap.blank && snap.openState === 'open') {
    return { kind: 'settled', message: '已完成', key: null, pendingCount }
  }

  return { kind: 'none', message: null, key: null, pendingCount }
}
