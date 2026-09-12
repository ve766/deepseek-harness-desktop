/**
 * P2 — employee → backing-session OVERRIDE registry (local to ui-desktop).
 *
 * Positioning (P2/Commit2): this is an OPTIONAL override table, NOT the primary
 * identity source. The primary, long-term employee identity key is `Employee.preset`
 * (e.g. 'employee.assistant-dog'), resolved live from the session list — see
 * `statusController.resolveEmployeeSession`. This registry exists only for:
 *   - test bindings
 *   - special session pins (force a specific sessionId)
 *   - debugging
 *
 * Nothing here is written into the dsh core — Agent Core / the sessions service
 * stay untouched. No persistence (no localStorage / store / DB) is used.
 *
 * When present, an entry overrides the preset-derived match, highest precedence first:
 *   1. `sessionId`  — explicit pin
 *   2. `agentPreset` — force a specific preset (normally taken from `Employee.preset`)
 *
 * Ships empty: every card keeps its mock status until an override is added.
 */
/**
 * Internal session-id alias for employee→session bindings.
 *
 * We deliberately do NOT import the dsh `SessionId` branded type here: doing so
 * would couple ui-desktop to core internals (and the `@deepseek-ai/dsh-api-remotes`
 * package is not a declared dependency of this plugin). `string` is a safe,
 * future-compatible stand-in — when the Workspace slice later needs the precise
 * core type, it can widen this alias in one place without reshaping the registry.
 */
export type EmployeeBindingSessionId = string

/** One employee's backing-session match keys. */
export interface EmployeeBinding {
  /** Explicit session binding — the fallback identity key. */
  sessionId?: EmployeeBindingSessionId
  /** Auxiliary match by agent preset; not an employee-identity key. */
  agentPreset?: string
}

/** Roster-key → backing-session match. Local to ui-desktop; no core writes. */
export const employeeBindings: Record<string, EmployeeBinding> = {
  // 'emp-assistant': { sessionId: '...' },  // bind once a session exists
}
