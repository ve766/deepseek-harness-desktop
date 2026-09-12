/**
 * P2/Commit3 — fine-grained employee status derived from the per-session
 * `ConversationSnapshot` (Workspace scope).
 *
 * This module complements (and does NOT replace) `statusController.ts`:
 *   - statusController.deriveStatusFromSummary  → card-level coarse status (idle / working / success)
 *   - deriveWorkspaceStatus                     → Workspace-level fine status (adds thinking / error)
 *
 * The five-state model lives in `types.ts`. This module owns the
 * ConversationSnapshot → five-state mapping only; it never reaches into runtime
 * internals beyond the public `ConversationSnapshot` type.
 */

import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { EmployeeStatus } from '../types.ts'

/** Which layer produced the status signal (debug / display). */
export type StatusSource = 'summary' | 'conversation'

/** Upper bound for the derived task label. */
const MAX_LINE = 40

/** The current task the employee is engaged in, surfaced in the Workspace. */
export interface CurrentTaskView {
  /** Drives icon / emphasis. */
  kind: 'tool' | 'partial' | 'pending'
  /** Human label, e.g. "调用 search_web", "生成报告中", "等待审批". */
  label: string
  /**
   * Task name derived from the most recent user message.
   *
   * Display-only: it introduces no runtime field and no "task entity" concept.
   * Null when the session has no user message yet, in which case the Workspace
   * shows the stage alone.
   */
  taskLabel: string | null
  /** Right-aligned detail, e.g. the pending interaction kind. */
  detail: string | null
}

/**
 * Read the first non-empty text block out of one message's content.
 *
 * Written defensively against `unknown` so this module needs no dependency on
 * the LLM content-block types.
 * @param content - raw content blocks.
 * @returns the first text found, or '' when the message carries none.
 */
function textOf(content: readonly unknown[]): string {
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    if (!('text' in block)) continue
    const text = (block as { text?: unknown }).text
    if (typeof text === 'string' && text.trim() !== '') return text
  }
  return ''
}

/**
 * Condense a raw message into a single clamped display line.
 * @param text - source text.
 * @returns first line, trimmed and clamped.
 */
function clampLine(text: string): string {
  const first = text.trim().split('\n')[0] ?? ''
  return first.length > MAX_LINE ? `${first.slice(0, MAX_LINE)}…` : first
}

/**
 * Derive the task label from the most recent user message.
 *
 * Priority: the latest turn's user message; failing that, the nearest earlier
 * turn that carries one. Steering messages are excluded — a mid-turn
 * interjection is not the task.
 * @param snap - live conversation snapshot.
 * @returns the label, or null when no user message exists yet.
 */
export function deriveTaskLabel(snap: ConversationSnapshot): string | null {
  for (let index = snap.nodes.length - 1; index >= 0; index--) {
    const node = snap.nodes[index]
    if (node === undefined || node.kind !== 'user') continue
    const text = textOf(node.content)
    if (text !== '') return clampLine(text)
  }
  return null
}

/**
 * Read the first real text block out of one assistant message, skipping
 * reasoning and tool-call blocks.
 * @param blocks - classified assistant blocks.
 * @returns the first text found, or '' when the message carries none.
 */
function assistantText(blocks: readonly unknown[]): string {
  for (const block of blocks) {
    if (block === null || typeof block !== 'object') continue
    if (!('kind' in block)) continue
    const candidate = block as { kind?: unknown; text?: unknown }
    if (candidate.kind !== 'text') continue
    if (typeof candidate.text === 'string' && candidate.text.trim() !== '') return candidate.text
  }
  return ''
}

/**
 * Derive the Result layer: the employee's most recent assistant output.
 *
 * Display-only summary; introduces no runtime field.
 * @param snap - live conversation snapshot.
 * @returns the clamped summary, or null when nothing has been produced yet.
 */
export function deriveResultSummary(snap: ConversationSnapshot): string | null {
  for (let index = snap.nodes.length - 1; index >= 0; index--) {
    const node = snap.nodes[index]
    if (node === undefined || node.kind !== 'assistant') continue
    const text = assistantText(node.blocks)
    if (text !== '') return clampLine(text)
  }
  return null
}

/** Structured error detail, present when status === 'error'. */
export interface StatusErrorView {
  message: string
}

/**
 * The Workspace view-model: everything the Employee Workspace surface needs to
 * render one employee's live, fine-grained state. Pure data — the component owns
 * presentation (EmployeeStatusDot / MascotAvatar stay untouched).
 */
export interface EmployeeStatusView {
  status: EmployeeStatus
  /** Which layer produced the status. */
  source: StatusSource
  sessionId?: string
  openState?: ConversationSnapshot['openState']
  currentTask?: CurrentTaskView
  error?: StatusErrorView
}

/**
 * Derive the fine-grained employee status from a live `ConversationSnapshot`.
 *
 * Mapping (corrected from the original proposal — `ConversationSnapshot` has no
 * `completed`; that field belongs to `SessionSummary` on the card layer):
 *   error     lastAgentError !== null || openState === 'error'   (highest priority)
 *   thinking  running && runningCalls.length === 0 && partial !== null
 *   working   running && not thinking (incl. the running-but-not-yet-visible case)
 *   success   settled, non-blank, open, no error
 *   idle      everything else (blank / cold / loading / removed / pending)
 *
 * Edge case (the only genuinely ambiguous branch, hence commented):
 *   running && runningCalls.length === 0 && partial === null
 *     → treated as `working` (the agent is active but has not yet emitted a
 *     token or dispatched a tool). The card layer keeps `SessionSummary.completed`
 *     as an independent green "done" hint, so the two layers do not conflict.
 *
 * @param snap - the live conversation snapshot for the bound session.
 * @returns the assembled {@link EmployeeStatusView}.
 */
export function deriveWorkspaceStatus(snap: ConversationSnapshot): EmployeeStatusView {
  const sessionId = snap.sessionId
  const openState = snap.openState
  const taskLabel = deriveTaskLabel(snap)
  const task = (
    kind: CurrentTaskView['kind'],
    label: string,
    detail: string | null = null,
  ): CurrentTaskView => ({ kind, label, taskLabel, detail })

  // 1) error — highest priority
  if (snap.lastAgentError !== null || openState === 'error') {
    return {
      status: 'error',
      source: 'conversation',
      sessionId,
      openState,
      error: { message: snap.lastAgentError ?? '会话打开失败' },
    }
  }

  // 2) thinking — token stream present, no tool call yet
  if (snap.running && snap.runningCalls.length === 0 && snap.partial !== null) {
    return {
      status: 'thinking',
      source: 'conversation',
      sessionId,
      openState,
      currentTask: task('partial', '推理 / 生成中'),
    }
  }

  // 3) working — agent is running (covers the running-but-no-token-yet case)
  if (snap.running) {
    const call = snap.runningCalls[0]
    return {
      status: 'working',
      source: 'conversation',
      sessionId,
      openState,
      currentTask: call
        ? task('tool', `调用 ${call.name}`)
        : task('partial', '工作中'),
    }
  }

  // 4) success — settled, non-blank, open, no error
  if (!snap.blank && openState === 'open') {
    return {
      status: 'success',
      source: 'conversation',
      sessionId,
      openState,
    }
  }

  // 5) idle — everything else (blank / cold / loading / removed). A pending
  // interaction (plan-review / approval / question) still surfaces as a hint
  // while the employee sits idle.
  if (snap.pending.length > 0) {
    const wait = snap.pending[0]
    return {
      status: 'idle',
      source: 'conversation',
      sessionId,
      openState,
      currentTask: task('pending', '等待用户确认', wait === undefined ? null : wait.kind),
    }
  }

  return {
    status: 'idle',
    source: 'conversation',
    sessionId,
    openState,
  }
}
