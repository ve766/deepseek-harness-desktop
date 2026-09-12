import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { Employee } from '../types.ts'
import { DesktopRoot } from './components/DesktopRoot.tsx'
import { EmployeeWorkspace } from './components/EmployeeWorkspace.tsx'
import { setOpenSession } from './sessionBridge.ts'

/** The app.view cell id for the AI Employee OS Desktop. */
const VIEW_ID = 'desktop'
/**
 * Display order among app.view entries, ascending: the switcher contributes
 * the chat row itself and always places it first, so 0 puts the Desktop ahead
 * of every other registrant. Knowledge is the only other one today, at 100.
 */
const VIEW_ORDER = 0
/** Sidebar switcher label. */
const VIEW_LABEL = 'AI Employee OS'

/** Session-scope child slot rendered when an employee workspace is opened. */
const WORKSPACE_SLOT = 'desktop.workspace'

/**
 * `desktop.workspace` is a `single` + `session` slot: the framework injects
 * `useSession` (the current session's ConversationSnapshot) and `sessionId`, and
 * the owner (DesktopRoot) passes the bound `employee` as an owner prop. The
 * Workspace component never reaches into runtime internals — only the public
 * `useSession` hook and the `deriveWorkspaceStatus` pure function.
 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'desktop.workspace': { kind: 'single'; scope: 'session'; owner: { employee: Employee } }
  }
}

/**
 * Register the `desktop` app.view entry (AI Employee OS Desktop shell) plus its
 * `desktop.workspace` session-scope child slot.
 *
 * - The `desktop` entry declares `children: { 'desktop.workspace': ... }` so its
 *   component receives `renderSlot` and can mount the Workspace bound to the
 *   current session (selected via `ctx.sessions.open`).
 * - `desktop.workspace` is a `single` + `session` slot: the framework injects
 *   `useSession` + `sessionId`; DesktopRoot passes the bound `employee`.
 *
 * Registration is deferred through `ctx.slots.inject` so it fires only once
 * ui-layout has declared `app.view`. No business face yet — the employee roster
 * arrives with the card surface in Commit 3.
 * @param ctx - client root context.
 */
export function registerDesktop(ctx: ClientContext): void {
  // Wire the session-open bridge: the root slot has no direct `sessions` access,
  // but opening a session is required to bind the Workspace to the right
  // conversation. (See sessionBridge.ts for why this indirection exists.)
  setOpenSession((id) => ctx.sessions.open(id))

  // 1) the session-scoped Workspace component (this plugin is the sole registrant)
  ctx.slots.inject(WORKSPACE_SLOT, () =>
    ctx.slots.register({ name: WORKSPACE_SLOT }, EmployeeWorkspace),
  )

  // 2) the Desktop app.view entry, declaring the Workspace as a child
  ctx.slots.inject('app.view', () => ctx.slots.register({
    name: 'app.view',
    id: VIEW_ID,
    order: VIEW_ORDER,
    label: VIEW_LABEL,
    children: {
      [WORKSPACE_SLOT]: { kind: 'single', scope: 'session' },
    },
  }, DesktopRoot))
}
