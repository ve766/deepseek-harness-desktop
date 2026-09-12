/**
 * Personal Knowledge OS surface, browser half: registers the `knowledge`
 * app.view entry (the Knowledge Center shell with its Dashboard) and wires it
 * to the knowledge Host Remote through an inject face. The component never
 * touches `ctx.remote` — every knowledge call flows through the
 * {@link useKnowledge} hook reading the injected face.
 * @module @deepseek-ai/dsh-client-ui-knowledge/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `app.view` SlotMap merge (declared by ui-layout) into
// the program so the register options and component props type-check.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { KnowledgeRoot } from './KnowledgeRoot.tsx'
import type { KnowledgeInjected } from './slots.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * Workspace seats inside the Knowledge Center: one list entry per surface.
     * Declared and owned by ui-knowledge; child packages register into it with
     * a fresh id (the import surface ships one) and this package renders the
     * entry matching the active navigation row.
     */
    'knowledge.workspace': { kind: 'list'; scope: 'root' }
    /**
     * Detail reader seats inside the Knowledge Center: one entry per surface,
     * rendered in the shell's third column. Owned by ui-knowledge so later
     * surfaces (Explorer / Search / Assistant / Graph) can reuse it without
     * privatising the detail area to any single plugin.
     */
    'knowledge.detail': { kind: 'list'; scope: 'root' }
  }
}

/** Runtime props of a `knowledge.workspace` entry, for child packages to reuse. */
export type KnowledgeWorkspaceEntryProps = PropsRuntime<'knowledge.workspace'>

/** The app.view cell id for the Knowledge Center. */
const VIEW_ID = 'knowledge'
/** Display order among app.view entries (after chat's built-in row). */
const VIEW_ORDER = 100
/** Sidebar switcher label. */
const VIEW_LABEL = 'Knowledge'

/** Required services: the slot registry and the typed knowledge Remote. */
export const inject = ['slots', 'remote']

/**
 * Client plugin body: contribute the Knowledge Center to the app-view ring.
 * Registration is deferred through `ctx.slots.inject` so it fires only once
 * ui-layout has declared `app.view`.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('app.view', () => ctx.slots.register({
    name: 'app.view',
    id: VIEW_ID,
    order: VIEW_ORDER,
    label: VIEW_LABEL,
    // Workspace seats this shell renders. Declaring them here is what lets
    // child packages register through ctx.slots.inject('knowledge.workspace').
    children: {
      'knowledge.workspace': { kind: 'list', scope: 'root' },
      'knowledge.detail': { kind: 'list', scope: 'root' },
    },
    // The business face closes over ctx.remote.knowledge; the component reads
    // it through useKnowledge and never reaches ctx.remote itself.
    inject: (): KnowledgeInjected => ({
      search: query => ctx.remote.knowledge.search(query),
      get: id => ctx.remote.knowledge.get({ id }),
      query: (question, limit) =>
        ctx.remote.knowledge.query(limit === undefined ? { question } : { question, limit }),
      importDoc: request => ctx.remote.knowledge.import(request),
      save: draft => ctx.remote.knowledge.save(draft),
    }),
  }, KnowledgeRoot))
}

// Public surface for workspace children (ui-import and later surfaces): the
// shared remote error type so they never define a competing error taxonomy.
export { KnowledgeRemoteError } from './useKnowledge.ts'
export type { KnowledgeApi } from './useKnowledge.ts'
export { KnowledgeContext, KnowledgeContextMissingError } from './KnowledgeContext.ts'
export type { KnowledgeInjected } from './slots.ts'
export { useKnowledge } from './useKnowledge.ts'
