/**
 * AI Employee OS — Desktop shell client plugin (P1).
 * Registers the `desktop` app.view entry; the component is a placeholder until
 * Commit 3 adds the header and the employee grid.
 * @module @deepseek-ai/dsh-client-ui-desktop/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ImportRequest } from '@deepseek-ai/dsh-knowledge-indexer/types'
import { registerDesktop } from './slots.ts'
import { setSendMessage } from './sessionBridge.ts'
import { setSaveKnowledge } from './knowledgeBridge.ts'

/** Required services: the slot registry (app.view registration), the session
 *  service (opening a session + sending a follow-up), and the knowledge Remote
 *  (persisting a derived draft into the Personal Knowledge OS in Commit 7). */
export const inject = ['slots', 'sessions', 'remote']

/**
 * Client plugin body: contribute the AI Employee OS Desktop to the app-view ring.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  // Interaction Layer verb: send user text as a brand-new queued turn. Nothing
  // here retries or resumes a turn — the runtime exposes neither capability, so
  // the bridge offers only what genuinely exists (see workspaceInteraction.ts).
  setSendMessage(async (id, text) => {
    const session = ctx.sessions.binding(id)?.session
    if (session === undefined) return false
    const result = await session.prompt([{ type: 'text', text }], 'queue')
    return result.ok === true
  })

  // Memory & Knowledge Entry verb (Commit 7): persist a derived draft. The draft
  // is assembled into the markdown the Knowledge OS parser expects (frontmatter
  // carries title / category / tags / summary); only `import` is used (no update
  // / delete / search), and the verb is always-insert.
  setSaveKnowledge(async (draft) => {
    const raw = [
      '---',
      `title: ${JSON.stringify(draft.title)}`,
      `category: ${JSON.stringify(draft.category)}`,
      `tags: [${draft.tags.map((tag) => JSON.stringify(tag)).join(', ')}]`,
      `summary: ${JSON.stringify(draft.summary)}`,
      '---',
      '',
      draft.body,
    ].join('\n')
    const request: ImportRequest = { raw, kind: 'markdown' }
    return ctx.remote.knowledge.import(request)
  })

  registerDesktop(ctx)
}
