/**
 * P2/Commit4 — Execution Timeline projection.
 *
 * Pure derivation: `ConversationSnapshot` -> `ExecutionTimelineView`.
 *
 * This is an *execution* projection, not a chat transcript: only nodes that
 * represent work the employee actually performed are kept. User messages,
 * context injections, compactions and commands are deliberately excluded.
 *
 * Timing rule inherited from the platform (ui-trajectory documents "In-flight
 * Time stays blank"): a duration is produced only when both endpoints are real.
 * In-flight and unknown-span entries carry `duration: null`, and the renderer
 * draws a start marker rather than inventing a span.
 *
 * No runtime contract is touched and no state field is invented — everything
 * below is derived from the public `ConversationSnapshot`.
 * @module @deepseek-ai/dsh-client-ui-desktop/client/workspaceTimeline
 */

import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'

/** What kind of work one row represents. */
export type TimelineEntryKind =
  | 'tool'
  | 'assistant'
  | 'error'
  | 'retry'
  | 'running-tool'
  | 'running-assistant'

/** Settlement of one row. */
export type TimelineEntryStatus = 'ok' | 'error' | 'running'

/** One row of the execution timeline. */
export interface TimelineEntry {
  /** Stable React key, unique inside one session. */
  key: string
  kind: TimelineEntryKind
  label: string
  /** Epoch ms, or null when the real start is unknown (never back-filled). */
  start: number | null
  /** Epoch ms, or null while in flight. */
  end: number | null
  /** Derived ms; null when unknown or in flight. */
  duration: number | null
  status: TimelineEntryStatus
}

/** One turn group, carrying its own window and ordered rows. */
export interface TimelineTurn {
  turn: number
  start: number | null
  end: number | null
  /** Derived ms; null while the turn is still open. */
  duration: number | null
  entries: readonly TimelineEntry[]
}

/** The assembled projection for one session. */
export interface ExecutionTimelineView {
  turns: readonly TimelineTurn[]
  /** Loaded-window domain, or null when nothing can be positioned. */
  domain: { start: number; end: number } | null
  totalCount: number
  /** Older history exists but is not loaded; rendered as a neutral ellipsis. */
  hasEarlier: boolean
}

const MAX_LABEL = 40

/**
 * Condense one free-text label to a single clamped line.
 * @param text - source text.
 * @returns the first line, trimmed and clamped.
 */
function clampLabel(text: string): string {
  const first = text.trim().split('\n')[0] ?? ''
  return first.length > MAX_LABEL ? `${first.slice(0, MAX_LABEL)}…` : first
}

interface TurnWindow {
  turn: number
  start: number
  end: number | null
}

/**
 * Collect the known turn windows in ascending turn order.
 * @param snap - live conversation snapshot.
 * @returns one window per recorded turn.
 */
function turnWindows(snap: ConversationSnapshot): TurnWindow[] {
  const windows: TurnWindow[] = []
  for (const [turn, timing] of snap.turnTimings) {
    windows.push({ turn, start: timing.startTime, end: timing.endTime ?? null })
  }
  windows.sort((a, b) => a.turn - b.turn)
  return windows
}

/**
 * Resolve the turn owning one timestamp: the latest turn that started at or
 * before it and has not ended before it. Falls back to the earliest turn so a
 * node logged before the first `turn/start` still has a home.
 * @param windows - known turn windows, ascending.
 * @param time - epoch ms to place.
 * @returns the owning turn number, or null when no turn is known.
 */
function owningTurn(windows: readonly TurnWindow[], time: number): number | null {
  let best: number | null = null
  let bestStart = Number.NEGATIVE_INFINITY
  for (const window of windows) {
    if (window.start > time) continue
    if (window.end !== null && time > window.end) continue
    if (window.start < bestStart) continue
    bestStart = window.start
    best = window.turn
  }
  if (best !== null) return best
  const first = windows[0]
  return first === undefined ? null : first.turn
}

/**
 * Order rows chronologically, pushing unpositioned rows (no known start) last.
 * @param entries - rows of one turn.
 * @returns a new ordered array.
 */
function sortEntries(entries: readonly TimelineEntry[]): readonly TimelineEntry[] {
  return [...entries].sort((a, b) => {
    if (a.start === null && b.start === null) return 0
    if (a.start === null) return 1
    if (b.start === null) return -1
    return a.start - b.start
  })
}

/**
 * Project a live `ConversationSnapshot` onto the Employee Workspace timeline.
 *
 * @param snap - the live conversation snapshot for the bound session.
 * @returns the execution timeline view-model.
 */
export function deriveExecutionTimeline(snap: ConversationSnapshot): ExecutionTimelineView {
  const windows = turnWindows(snap)
  const first = windows[0]
  const fallbackTurn = first === undefined ? 0 : first.turn
  const last = windows[windows.length - 1]
  const runningTurn = last === undefined ? 0 : last.turn
  const byTurn = new Map<number, TimelineEntry[]>()

  const push = (turn: number | null, entry: TimelineEntry): void => {
    const key = turn ?? fallbackTurn
    const list = byTurn.get(key)
    if (list === undefined) byTurn.set(key, [entry])
    else list.push(entry)
  }

  for (const node of snap.nodes) {
    switch (node.kind) {
      case 'tool-result': {
        // `callTime` is null when a window cut left the paired tool/call
        // outside; the row then keeps the result time as its only anchor and
        // reports no duration.
        const start = node.callTime ?? node.time
        push(owningTurn(windows, start), {
          key: `tool-result:${node.callId}`,
          kind: 'tool',
          label: node.call?.name ?? node.callId,
          start,
          end: node.time,
          duration: node.callTime === null ? null : node.time - node.callTime,
          status: node.isError ? 'error' : 'ok',
        })
        break
      }
      case 'assistant': {
        const timing = node.timing
        const stepStart = timing?.stepStartTime ?? null
        const completed = timing?.completedTime ?? null
        push(owningTurn(windows, stepStart ?? node.time), {
          key: `assistant:${node.seq}`,
          kind: 'assistant',
          label: '思考 · 生成',
          start: stepStart ?? node.time,
          end: completed ?? node.time,
          duration: stepStart === null || completed === null ? null : completed - stepStart,
          status: 'ok',
        })
        break
      }
      case 'turn-error': {
        push(owningTurn(windows, node.time), {
          key: `turn-error:${node.seq}`,
          kind: 'error',
          label: clampLabel(node.message),
          start: node.time,
          end: node.time,
          duration: 0,
          status: 'error',
        })
        break
      }
      case 'turn-max-tokens': {
        push(owningTurn(windows, node.time), {
          key: `turn-max-tokens:${node.seq}`,
          kind: 'error',
          label: '达到输出上限',
          start: node.time,
          end: node.time,
          duration: 0,
          status: 'error',
        })
        break
      }
      case 'model-retry': {
        push(owningTurn(windows, node.time), {
          key: `model-retry:${node.seq}`,
          kind: 'retry',
          label: '模型重试',
          start: node.time,
          end: null,
          duration: null,
          status: node.retryState === 'scheduled' ? 'running' : 'ok',
        })
        break
      }
      default:
        break
    }
  }

  for (const call of snap.runningCalls) {
    push(owningTurn(windows, call.time), {
      key: `running-tool:${call.callId}`,
      kind: 'running-tool',
      label: call.name,
      start: call.time,
      end: null,
      duration: null,
      status: 'running',
    })
  }

  // `partial` carries no timestamp anywhere in the contract, so it is emitted
  // as an unpositioned row rather than being given a fabricated start.
  if (snap.partial !== null) {
    push(runningTurn, {
      key: 'running-assistant:partial',
      kind: 'running-assistant',
      label: '生成中',
      start: null,
      end: null,
      duration: null,
      status: 'running',
    })
  }

  const turnKeys = new Set<number>(windows.map((window) => window.turn))
  for (const key of byTurn.keys()) turnKeys.add(key)
  const windowByTurn = new Map<number, TurnWindow>()
  for (const window of windows) windowByTurn.set(window.turn, window)

  const turns: TimelineTurn[] = [...turnKeys].sort((a, b) => a - b).map((turn) => {
    const window = windowByTurn.get(turn)
    const start = window?.start ?? null
    const end = window?.end ?? null
    return {
      turn,
      start,
      end,
      duration: start === null || end === null ? null : end - start,
      entries: sortEntries(byTurn.get(turn) ?? []),
    }
  })

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let totalCount = 0
  for (const group of turns) {
    for (const entry of group.entries) {
      totalCount++
      if (entry.start !== null) min = Math.min(min, entry.start)
      if (entry.end !== null) max = Math.max(max, entry.end)
      else if (entry.start !== null) max = Math.max(max, entry.start)
    }
  }

  const domain = Number.isFinite(min) && Number.isFinite(max) ? { start: min, end: max } : null

  return { turns, domain, totalCount, hasEarlier: snap.hasMore }
}
