/**
 * EmployeeCard — one AI Employee's working unit on the Desktop.
 *
 * Structure (Employee Card & Desktop Experience Design v1.0 §2.2, forced fields):
 * avatar + name/role + live status → current task block → capability tags →
 * three quick actions (one primary). Purely presentational; no runtime wiring.
 * P2/Commit3: clicking the card opens the employee's Workspace, resolving the
 * backing session id from the live session list.
 * @module @deepseek-ai/dsh-client-ui-desktop/client/EmployeeCard
 */

import type { Employee } from '../../types.ts'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import { MascotAvatar } from './MascotAvatar.tsx'
import { EmployeeStatusDot } from './EmployeeStatusDot.tsx'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEmployeeStatus, resolveEmployeeSession } from '../statusController.ts'
import { employeeBindings } from '../employeeBindings.ts'
import css from './EmployeeCard.module.css'

export interface EmployeeCardProps {
  employee: Employee
  /** Resolved avatar image source for {@link Employee.mascot}. */
  avatarSrc: string
  /** The `GlobalStandardProps.useSessions` hook, threaded from the root `app.view` slot. */
  useSessions: SnapshotSelectorHook<SessionListState>
  /** Enter this employee's Workspace (card click). */
  onOpen?: ((employee: Employee, sessionId: SessionSummary['id'] | undefined) => void) | undefined
}

/**
 * Render a single employee card.
 * @param props.employee - the employee record.
 * @param props.avatarSrc - the avatar image to show.
 * @param props.onOpen - invoked with the resolved session id when the card is clicked.
 * @returns the employee card element.
 */
export function EmployeeCard({ employee, avatarSrc, useSessions, onOpen }: EmployeeCardProps) {
  const liveStatus = useEmployeeStatus(employee, useSessions)
  const status = liveStatus ?? employee.status
  // Resolve the live backing session id (preset → agentPreset → best match) so the
  // Workspace can bind to it. `undefined` when no session matches yet.
  const sessionId = useSessions(
    (s) => resolveEmployeeSession(employee, s, employeeBindings[employee.id])?.id,
  )

  return (
    <article
      className={css.card}
      data-mascot={employee.mascot}
      data-status={status}
      onClick={onOpen ? () => onOpen(employee, sessionId) : undefined}
    >
      <div className={css.accent} aria-hidden="true" />
      <header className={css.head}>
        <MascotAvatar
          src={avatarSrc}
          name={employee.name}
          mascot={employee.mascot}
          status={status}
          size={88}
        />
        <div className={css.nameBlock}>
          <h3 className={css.name}>{employee.name}</h3>
          <div className={css.role}>{employee.role}</div>
          <EmployeeStatusDot status={status} />
        </div>
      </header>

      {employee.currentTask && (
        <div className={css.task}>
          <div className={css.taskLabel}>当前任务</div>
          <div className={css.taskText}>{employee.currentTask}</div>
        </div>
      )}

      {employee.tags.length > 0 && (
        <div className={css.tags}>
          {employee.tags.map((tag) => (
            <span key={tag} className={css.tag}>{tag}</span>
          ))}
        </div>
      )}

      <div className={css.actions} onClick={(e) => e.stopPropagation()}>
        {employee.actions.map((action) => (
          <Button
            key={action.label}
            variant={action.primary ? 'primary' : 'ghost'}
            size="sm"
            className={css.action}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </article>
  )
}
