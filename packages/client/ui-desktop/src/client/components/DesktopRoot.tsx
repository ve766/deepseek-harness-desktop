/**
 * The `desktop` app.view winner (P1): the AI Employee OS Desktop shell.
 * Hosts the header and the employee grid; P2/Commit3 adds a Workspace panel
 * (session-scope child slot) entered by clicking an employee card.
 * @module @deepseek-ai/dsh-client-ui-desktop/client/DesktopRoot
 */
import { useState } from 'react'
import type { PropsRuntime, PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `app.view` SlotMap merge (declared by ui-layout) into
// the program so PropsRuntime / PropsRenderSlots resolve.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { Employee } from '../../types.ts'
import type { SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import { DesktopHeader } from './DesktopHeader.tsx'
import { EmployeeGrid } from './EmployeeGrid.tsx'
import { openSession } from '../sessionBridge.ts'
import { mockEmployees } from '../../mockEmployees.ts'
import css from './DesktopRoot.module.css'

/** Full component props: the app.view runtime share + the desktop.workspace render seat. */
export type DesktopRootProps =
  & PropsRuntime<'app.view'>
  & PropsRenderSlots<'desktop.workspace'>

/** Local navigation between the roster grid and one employee's Workspace. */
type PanelState = { kind: 'grid' } | { kind: 'workspace'; employee: Employee }

/**
 * Render the AI Employee OS Desktop.
 * @param props - composed slot props (app.view runtime share + child render seat).
 * @returns the Desktop shell (header + employee grid, or an opened Workspace).
 */
export function DesktopRoot(props: DesktopRootProps) {
  const { useSessions } = props
  const [panel, setPanel] = useState<PanelState>({ kind: 'grid' })

  const handleOpen = (employee: Employee, sessionId: SessionSummary['id'] | undefined) => {
    // Open the backing session so the Workspace's `useSession` binds to it.
    // Side effect accepted in Commit3: opening a session sets it current app-wide.
    if (sessionId !== undefined) openSession(sessionId)
    setPanel({ kind: 'workspace', employee })
  }

  if (panel.kind === 'workspace') {
    return (
      <div className={css.root}>
        <button className={css.back} type="button" onClick={() => setPanel({ kind: 'grid' })}>
          ← 返回
        </button>
        <DesktopHeader employees={mockEmployees} />
        {props.renderSlot('desktop.workspace', { employee: panel.employee }, { fallback: null })}
      </div>
    )
  }

  return (
    <div className={css.root}>
      <DesktopHeader employees={mockEmployees} />
      <EmployeeGrid employees={mockEmployees} useSessions={useSessions} onOpen={handleOpen} />
    </div>
  )
}
