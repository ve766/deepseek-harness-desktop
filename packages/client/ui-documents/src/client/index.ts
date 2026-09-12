/**
 * Knowledge documents surface plugin, browser half: registers the `documents`
 * entry into ui-knowledge's `knowledge.workspace` slot (the list) and its
 * `knowledge.detail` slot (the reader). Both entries share the id `documents`
 * — the shell's `only: active` filter renders the matching pair when the
 * `文档` navigation row is active, and leaves the detail column empty
 * otherwise. The component never touches `ctx.remote` — every knowledge call
 * flows through the `useDocuments` hook reading the injected face.
 * @module @deepseek-ai/dsh-client-ui-documents/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the `knowledge.workspace` / `knowledge.detail` SlotMap merge
// (declared by ui-knowledge) into the program so the register options type-check.
// Registration is deferred until that declaration lands.
import type {} from '@deepseek-ai/dsh-client-ui-knowledge/client'
import { DocumentsWorkspace } from './DocumentsWorkspace.tsx'
import { DocumentsDetail } from './DocumentsDetail.tsx'
import type { DocumentsInjected } from './slots.ts'

/** The knowledge entry id, shared by the workspace list and the detail reader. */
const ENTRY_ID = 'documents'
/** Display order among knowledge.workspace entries (after Dashboard and import). */
const ENTRY_ORDER = 20
/** Sidebar label. Localisation is deferred to the unified i18n phase. */
const ENTRY_LABEL = '文档'

/** Required services: the slot registry and the typed knowledge Remote. */
export const inject = ['slots', 'remote']

/**
 * Client plugin body: contribute the documents surface to the knowledge
 * workspace ring and to the knowledge detail ring. Registration is deferred
 * through `ctx.slots.inject` so it fires only once ui-knowledge has declared
 * both slots.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const buildFace = (): DocumentsInjected => ({
    search: query => ctx.remote.knowledge.search(query),
    get: id => ctx.remote.knowledge.get({ id }),
  })
  ctx.slots.inject('knowledge.workspace', () => ctx.slots.register({
    name: 'knowledge.workspace',
    id: ENTRY_ID,
    order: ENTRY_ORDER,
    label: ENTRY_LABEL,
    inject: buildFace,
  }, DocumentsWorkspace))
  ctx.slots.inject('knowledge.detail', () => ctx.slots.register({
    name: 'knowledge.detail',
    id: ENTRY_ID,
    order: ENTRY_ORDER,
    label: ENTRY_LABEL,
    inject: buildFace,
  }, DocumentsDetail))
}

export { DocumentsWorkspace } from './DocumentsWorkspace.tsx'
export { DocumentsDetail } from './DocumentsDetail.tsx'
export { useDocuments, DocumentsRemoteError } from './useDocuments.ts'
export { DocumentsContext, DocumentsContextMissingError } from './DocumentsContext.ts'
export type { DocumentsInjected } from './slots.ts'
