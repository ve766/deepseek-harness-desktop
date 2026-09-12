/**
 * P2 — live employee status, derived from the global session list snapshot.
 *
 * Card-level scope only (Gate 3 verdict): the Desktop card reads the coarse
 * `SessionSummary` via `useSessions` and resolves three states —
 *   idle · working · success
 * `thinking` and `error` are intentionally NOT derivable here; they require the
 * per-session `ConversationSnapshot` (Workspace scope, later commit). This keeps
 * the card a calm, glanceable surface and the status system's 5-state model
 * intact for the Workspace to consume.
 *
 * No dsh core is touched: we only CONSUME the existing `useSessions` hook and
 * the prebuilt `SessionSummary` / `SessionListState` types.
 */
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import type { Employee, EmployeeStatus } from '../types.ts'
import { employeeBindings } from './employeeBindings.ts'
import type { EmployeeBinding, EmployeeBindingSessionId } from './employeeBindings.ts'

/**
 * Single, centralized place that maps our internal `EmployeeBindingSessionId`
 * (a plain `string`) into the live `SessionListState.byId` record, which is keyed
 * by the core `SessionId`. The cast lives ONLY here — callers and the registry
 * stay free of scattered casts.
 */
function summaryBySessionId(
  state: SessionListState,
  id: EmployeeBindingSessionId,
): SessionSummary | undefined {
  return (state.byId as Record<string, SessionSummary>)[id]
}

/** Coarse, card-level status derived from a session summary. */
export function deriveStatusFromSummary(summary: SessionSummary | undefined): EmployeeStatus {
  if (!summary || summary.blank) return 'idle'
  // Coarse "active": the agent is running, or it is parked waiting on the user.
  if (summary.running || summary.pendingInteraction) return 'working'
  // Settled, non-blank conversation: the employee finished its work.
  return 'success'
}

/**
 * Resolve the single most-relevant backing session for an employee, DERIVED from
 * the live session list — never stored. This is the core of the preset-based
 * identity binding (P2/Commit2): `Employee.preset` is the long-term identity key;
 * `sessionId` is only an optional override (test / pin / debug).
 *
 * When several sessions match the preset, pick by priority:
 *   running  >  pendingInteraction  >  most-recently-created (recency via `ids`).
 *
 * @param employee - needs `id` (override lookup key) and `preset` (identity key).
 * @param state - the global `SessionListState` snapshot.
 * @param override - optional entry from `employeeBindings` (highest precedence).
 */
export function resolveEmployeeSession(
  employee: Pick<Employee, 'id' | 'preset'>,
  state: SessionListState,
  override?: EmployeeBinding,
): SessionSummary | undefined {
  // 1) explicit sessionId pin (test / special binding / debug)
  if (override?.sessionId) {
    const pinned = summaryBySessionId(state, override.sessionId)
    if (pinned) return pinned
  }
  // 2) preset match — override.agentPreset wins, else the employee's own preset
  const matchPreset = override?.agentPreset ?? employee.preset
  if (matchPreset) {
    const matches = state.ids
      .map((id) => state.byId[id])
      .filter((s): s is SessionSummary => !!s && s.agentPreset === matchPreset)
    if (matches.length > 0) {
      const running = matches.find((s) => s.running)
      if (running) return running
      const pending = matches.find((s) => s.pendingInteraction)
      if (pending) return pending
      // recency proxy: `ids` is append-ordered, so the last match is newest
      return matches[matches.length - 1]
    }
  }
  return undefined
}

/**
 * Subscribe to the global session list and resolve one employee's live status.
 *
 * The employee's identity is its `preset` (long-term key); the live backing
 * session is resolved per render via {@link resolveEmployeeSession}. If no session
 * matches, returns `undefined` and the caller keeps the static mock status.
 *
 * @param employee - the employee record (needs `id` + `preset`).
 * @param useSessions - the `GlobalStandardProps.useSessions` hook, threaded from
 *   the root `app.view` slot into this card.
 */
export function useEmployeeStatus(
  employee: Employee,
  useSessions: SnapshotSelectorHook<SessionListState>,
): EmployeeStatus | undefined {
  const override = employeeBindings[employee.id]
  const summary = useSessions((s) => resolveEmployeeSession(employee, s, override))
  return deriveStatusFromSummary(summary)
}
