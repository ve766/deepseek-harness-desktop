/**
 * EmployeeWorkspace — the per-employee work surface (P2/Commit3 status,
 * P2/Commit4 workbench).
 *
 * Rendered inside the `desktop.workspace` session-scope child slot: the framework
 * injects `useSession` (bound to the current session's ConversationSnapshot) and
 * `sessionId`, and DesktopRoot passes the bound `employee` as an owner prop.
 *
 * Six layers, top to bottom:
 *   1. Employee Header    — identity, fine-grained status, back affordance
 *   2. Current Task       — derived task label, stage, tool / pending detail
 *   3. Execution Timeline — what the employee actually did (not a transcript)
 *   4. Result / Output    — latest produced summary
 *   5. Interaction Panel  — what the employee needs from the user right now
 *   6. Knowledge Entry    — persist the employee's work into the Personal Knowledge OS
 *
 * Everything below is derived from the public `ConversationSnapshot`; no runtime
 * internals are touched and EmployeeStatusDot / MascotAvatar are reused as-is.
 * @module @deepseek-ai/dsh-client-ui-desktop/client/EmployeeWorkspace
 */

import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `app.view` SlotMap merge (declared by ui-layout) so the
// `desktop.workspace` augmentation (in slots.ts) resolves on this slot key.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { MASCOT_AVATARS } from '../../assets/mascots/avatars.ts'
import { MascotAvatar } from './MascotAvatar.tsx'
import { EmployeeStatusDot } from './EmployeeStatusDot.tsx'
import { WorkspaceTimeline } from './WorkspaceTimeline.tsx'
import { STATUS_LABEL } from '../../status.ts'
import { deriveWorkspaceStatus, deriveTaskLabel } from '../workspaceStatus.ts'
import { deriveExecutionTimeline } from '../workspaceTimeline.ts'
import { deriveResultView } from '../workspaceResult.ts'
import { deriveInteractionView } from '../workspaceInteraction.ts'
import { deriveKnowledgeDraft } from '../workspaceKnowledge.ts'
import { ResultPanel } from './ResultPanel.tsx'
import { InteractionPanel } from './InteractionPanel.tsx'
import { KnowledgeEntryPanel } from './KnowledgeEntryPanel.tsx'
import css from './EmployeeWorkspace.module.css'

/** Props: owner share (employee) + session standard kit (useSession / sessionId). */
export type EmployeeWorkspaceProps = PropsRuntime<'desktop.workspace'>

/**
 * Render the work surface for the bound employee's session.
 * @param props.employee - the employee whose workspace this is.
 * @param props.useSession - framework hook bound to the current session snapshot.
 * @returns the workspace surface.
 */
export function EmployeeWorkspace({ employee, useSession }: EmployeeWorkspaceProps) {
  const snap = useSession((s: ConversationSnapshot) => s)
  const view = deriveWorkspaceStatus(snap)
  const timeline = deriveExecutionTimeline(snap)
  const resultView = deriveResultView(snap)
  const interaction = deriveInteractionView(snap)
  const knowledge = deriveKnowledgeDraft(snap, employee)
  const taskLabel = deriveTaskLabel(snap)
  const detail = view.currentTask?.detail ?? null
  const avatarSrc = MASCOT_AVATARS[employee.mascot]

  return (
    <section className={css.root} data-status={view.status}>
      <header className={css.head}>
        <MascotAvatar src={avatarSrc} name={employee.name} mascot={employee.mascot} status={view.status} size={72} />
        <div className={css.nameBlock}>
          <h2 className={css.name}>{employee.name}</h2>
          <div className={css.role}>{employee.role}</div>
          <div className={css.statusRow}>
            <EmployeeStatusDot status={view.status} />
            <span className={css.statusLabel}>{STATUS_LABEL[view.status]}</span>
          </div>
        </div>
      </header>

      <div className={css.body}>
        {view.error ? (
          <div className={css.errorBox}>
            <div className={css.blockLabel}>需要协助</div>
            <div className={css.blockText}>{view.error.message}</div>
          </div>
        ) : view.currentTask ? (
          <div className={css.taskBox}>
            <div className={css.blockLabel}>当前任务</div>
            {taskLabel !== null && <div className={css.taskName}>{taskLabel}</div>}
            <div className={css.blockText}>{view.currentTask.label}</div>
            {detail !== null && <div className={css.taskDetail}>{detail}</div>}
          </div>
        ) : (
          <div className={css.idleBox}>
            <div className={css.blockLabel}>状态</div>
            {taskLabel !== null && <div className={css.taskName}>{taskLabel}</div>}
            <div className={css.blockText}>{STATUS_LABEL[view.status]}</div>
          </div>
        )}

        <WorkspaceTimeline timeline={timeline} />

        <ResultPanel result={resultView} />

        <InteractionPanel
          view={interaction}
          pending={snap.pending}
          sessionId={snap.sessionId}
        />

        <KnowledgeEntryPanel draft={knowledge} />

        {view.sessionId !== undefined && (
          <div className={css.meta}>session · {String(view.sessionId)}</div>
        )}
      </div>
    </section>
  )
}
