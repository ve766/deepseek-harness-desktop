/**
 * Knowledge search surface plugin, browser half: registers the `search` entry
 * into ui-knowledge's `knowledge.workspace` slot (the query-driven retriever)
 * and its `knowledge.detail` slot (the reader sharing the selection). Both
 * entries share the id `search` — the shell's `only: active` filter renders the
 * matching pair when the `检索` navigation row is active and leaves the detail
 * column empty otherwise. The component never touches `ctx.remote` — every
 * knowledge call flows through the `useSearch` hook reading the injected face.
 * @module @deepseek-ai/dsh-client-ui-search/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the `knowledge.workspace` / `knowledge.detail` SlotMap merge
// (declared by ui-knowledge) into the program so the register options type-check.
// Registration is deferred until that declaration lands.
import type {} from '@deepseek-ai/dsh-client-ui-knowledge/client'
import { SearchWorkspace } from './SearchWorkspace.tsx'
import { SearchDetail } from './SearchDetail.tsx'
import type { SearchInjected } from './slots.ts'

/** The knowledge entry id, shared by the workspace list and the detail reader. */
const ENTRY_ID = 'search'
/** Display order among knowledge.workspace entries (after explore). */
const ENTRY_ORDER = 22
/** Sidebar label. Localisation is deferred to the unified i18n phase. */
const ENTRY_LABEL = '检索'

/** Required services: the slot registry and the typed knowledge Remote. */
export const inject = ['slots', 'remote']

/**
 * Client plugin body: contribute the search surface to the knowledge workspace
 * ring and to the knowledge detail ring. Registration is deferred through
 * `ctx.slots.inject` so it fires only once ui-knowledge has declared both slots.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const buildFace = (): SearchInjected => ({
    search: query => ctx.remote.knowledge.search(query),
    get: id => ctx.remote.knowledge.get({ id }),
  })
  ctx.slots.inject('knowledge.workspace', () => ctx.slots.register({
    name: 'knowledge.workspace',
    id: ENTRY_ID,
    order: ENTRY_ORDER,
    label: ENTRY_LABEL,
    inject: buildFace,
  }, SearchWorkspace))
  ctx.slots.inject('knowledge.detail', () => ctx.slots.register({
    name: 'knowledge.detail',
    id: ENTRY_ID,
    order: ENTRY_ORDER,
    label: ENTRY_LABEL,
    inject: buildFace,
  }, SearchDetail))
}

export { SearchWorkspace } from './SearchWorkspace.tsx'
export { SearchDetail } from './SearchDetail.tsx'
export { useSearch } from './useSearch.ts'
export { SearchRemoteError } from '../invariant.ts'
export { SearchContext, SearchContextMissingError } from './SearchContext.ts'
export type { SearchInjected } from './slots.ts'
