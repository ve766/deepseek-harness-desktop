/**
 * EmployeeGrid — the responsive grid of employee cards on the Desktop.
 * @module @deepseek-ai/dsh-client-ui-desktop/client/EmployeeGrid
 */

import type { Employee } from '../../types.ts'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import { MASCOT_AVATARS } from '../../assets/mascots/avatars.ts'
import { EmployeeCard } from './EmployeeCard.tsx'
import css from './EmployeeGrid.module.css'

export interface EmployeeGridProps {
  employees: Employee[]
  /** The `GlobalStandardProps.useSessions` hook, threaded from the root `app.view` slot. */
  useSessions: SnapshotSelectorHook<SessionListState>
  /** Enter an employee's Workspace (card click). */
  onOpen?: (employee: Employee, sessionId: SessionSummary['id'] | undefined) => void
}

/**
 * Render the employee grid.
 * @param props.employees - the roster to display.
 * @returns the grid of employee cards.
 */
export function EmployeeGrid({ employees, useSessions, onOpen }: EmployeeGridProps) {
  return (
    <section className={css.grid} aria-label="我的 AI 员工">
      {employees.map((employee) => (
        <EmployeeCard
          key={employee.id}
          employee={employee}
          avatarSrc={MASCOT_AVATARS[employee.mascot]}
          useSessions={useSessions}
          onOpen={onOpen}
        />
      ))}
    </section>
  )
}
