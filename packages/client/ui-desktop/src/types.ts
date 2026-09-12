/**
 * AI Employee OS — shared domain types for the Desktop shell (P1).
 */

/** Five-state lifecycle for an AI Employee, mapped onto ui-primitives StateDot in Commit 4. */
export type EmployeeStatus = 'idle' | 'working' | 'thinking' | 'success' | 'error'

/** Mascot identity key, aligned with Mascot Visual System v1.0. */
export type MascotId = 'assistant' | 'nox'

/** A quick action rendered on the employee card. */
export interface EmployeeAction {
  label: string
  /** Primary action is visually emphasized (Apple primary button). */
  primary?: boolean
}

/** A single AI Employee shown on the Desktop. P1 uses static mock data. */
export interface Employee {
  id: string
  name: string
  role: string
  mascot: MascotId
  /** Long-term identity key (e.g. 'employee.assistant-dog'); matches `SessionSummary.agentPreset`. Distinct from runtime capability-set presets (read/copy/...). */
  preset?: string
  status: EmployeeStatus
  currentTask?: string
  tags: string[]
  actions: EmployeeAction[]
}
