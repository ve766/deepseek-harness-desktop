/**
 * Knowledge explore surface plugin, browser half: registers the `explore`
 * entry into ui-knowledge's `knowledge.workspace` slot (the faceted browser)
 * and its `knowledge.detail` slot (the reader sharing the selection). Both
 * entries share the id `explore` — the shell's `only: active` filter renders
 * the matching pair when the `探索` navigation row is active and leaves the
 * detail column empty otherwise. The component never touches `ctx.remote` —
 * every knowledge call flows through the `useExplore` hook reading the
 * injected face.
 * @module @deepseek-ai/dsh-client-ui-explore/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the `knowledge.workspace` / `knowledge.detail` SlotMap merge
// (declared by ui-knowledge) into the program so the register options type-check.
// Registration is deferred until that declaration lands.
import type {} from '@deepseek-ai/dsh-client-ui-knowledge/client'
import { ExploreWorkspace } from './ExploreWorkspace.tsx'
import { ExploreDetail } from './ExploreDetail.tsx'
import type { ExploreInjected } from './slots.ts'

/** The knowledge entry id, shared by the workspace list and the detail reader. */
const ENTRY_ID = 'explore'
/** Display order among knowledge.workspace entries (after documents). */
const ENTRY_ORDER = 21
/** Sidebar label. Localisation is deferred to the unified i18n phase. */
const ENTRY_LABEL = '探索'

/** Required services: the slot registry and the typed knowledge Remote. */
export const inject = ['slots', 'remote']

/**
 * Client plugin body: contribute the explore surface to the knowledge
 * workspace ring and to the knowledge detail ring. Registration is deferred
 * through `ctx.slots.inject` so it fires only once ui-knowledge has declared
 * both slots.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const buildFace = (): ExploreInjected => ({
    search: query => ctx.remote.knowledge.search(query),
    get: id => ctx.remote.knowledge.get({ id }),
  })
  ctx.slots.inject('knowledge.workspace', () => ctx.slots.register({
    name: 'knowledge.workspace',
    id: ENTRY_ID,
    order: ENTRY_ORDER,
    label: ENTRY_LABEL,
    inject: buildFace,
  }, ExploreWorkspace))
  ctx.slots.inject('knowledge.detail', () => ctx.slots.register({
    name: 'knowledge.detail',
    id: ENTRY_ID,
    order: ENTRY_ORDER,
    label: ENTRY_LABEL,
    inject: buildFace,
  }, ExploreDetail))
}

export { ExploreWorkspace } from './ExploreWorkspace.tsx'
export { ExploreDetail } from './ExploreDetail.tsx'
export { useExplore, ExploreRemoteError } from './useExplore.ts'
export { ExploreContext, ExploreContextMissingError } from './ExploreContext.ts'
export type { ExploreInjected } from './slots.ts'
