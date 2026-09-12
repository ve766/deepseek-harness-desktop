/**
 * P2/Commit3 — minimal bridge wiring `ctx.sessions.open` into the Desktop.
 * P2/Commit6 — adds the Interaction Layer's only outbound verb, `sendMessage`.
 *
 * The root `app.view` slot only receives `useSessions` + `useWorkspaces`; it does
 * NOT receive `ctx.sessions.open`. Opening a session (to bind the Workspace to the
 * current conversation) therefore requires `ctx.sessions.open`, which lives on the
 * client context. We capture it once at registration time (see `slots.ts`) and
 * expose a safe no-op-until-wired call, so the component layer never touches
 * `ctx` directly and stays within the public `ISessions` face.
 */

import type { SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'

/** The session-open function, typed against the core `SessionId` (via SessionSummary). */
type OpenSessionFn = (id: SessionSummary['id']) => void

/**
 * The outbound message verb: sends user-authored text as a **new queued turn**.
 * Returns whether the host accepted it.
 */
type SendMessageFn = (id: SessionSummary['id'], text: string) => Promise<boolean>

let impl: OpenSessionFn | null = null
let sendImpl: SendMessageFn | null = null

/** Wire the real `ctx.sessions.open` (called once at plugin registration). */
export function setOpenSession(fn: OpenSessionFn): void {
  impl = fn
}

/** Open the given session. No-op until wired. Safe to call from event handlers. */
export function openSession(id: SessionSummary['id']): void {
  impl?.(id)
}

/**
 * Wire the real outbound message verb (see `index.ts`).
 *
 * The Desktop deliberately exposes only this narrow shape: the component layer
 * never touches `SessionFace` or `PromptContentPart`, which keeps the bundle
 * purity surface at zero and makes the semantics explicit — this always starts a
 * NEW queued turn. It never retries a failed turn and never resumes a truncated
 * one, because the runtime exposes neither capability.
 */
export function setSendMessage(fn: SendMessageFn): void {
  sendImpl = fn
}

/**
 * Send a user-authored message as a new queued turn.
 * @param id - target session.
 * @param text - the message body, exactly as the user typed it.
 * @returns false when unwired, or when the host refused / the session is gone.
 */
export async function sendMessage(
  id: SessionSummary['id'],
  text: string,
): Promise<boolean> {
  if (sendImpl === null) return false
  return sendImpl(id, text)
}
