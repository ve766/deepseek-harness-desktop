/**
 * Knowledge import surface plugin, browser half: registers the `import` entry
 * into ui-knowledge's `knowledge.workspace` slot and wires it to the knowledge
 * Host Remote through an inject face. The component never touches
 * `ctx.remote` — every knowledge call flows through the `useImport` hook
 * reading the injected face.
 * @module @deepseek-ai/dsh-client-ui-import/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the `knowledge.workspace` SlotMap merge (declared by
// ui-knowledge) into the program so the register options type-check.
// Registration is deferred until that declaration lands.
import type {} from '@deepseek-ai/dsh-client-ui-knowledge/client'
import { ImportWorkspace } from './ImportWorkspace.tsx'
import type { ImportInjected } from './slots.ts'

/** The knowledge.workspace cell id. */
const ENTRY_ID = 'import'
/** Display order among knowledge.workspace entries (after the built-in Dashboard). */
const ENTRY_ORDER = 10
/** Sidebar label. Localisation is deferred to the unified i18n phase. */
const ENTRY_LABEL = '导入'

/** Required services: the slot registry and the typed knowledge Remote. */
export const inject = ['slots', 'remote']

/**
 * Client plugin body: contribute the import surface to the knowledge workspace
 * ring. Registration is deferred through `ctx.slots.inject` so it fires only
 * once ui-knowledge has declared `knowledge.workspace`.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('knowledge.workspace', () => ctx.slots.register({
    name: 'knowledge.workspace',
    id: ENTRY_ID,
    order: ENTRY_ORDER,
    label: ENTRY_LABEL,
    // The business face closes over ctx.remote.knowledge; the component reads
    // it through useImport and never reaches ctx.remote itself.
    inject: (): ImportInjected => ({
      importDoc: request => ctx.remote.knowledge.import(request),
    }),
  }, ImportWorkspace))
}

export { ImportWorkspace } from './ImportWorkspace.tsx'
export { ImportView, composeRaw } from './ImportView.tsx'
export { useImport, ImportRemoteError } from './useImport.ts'
export { ImportContext, ImportContextMissingError } from './ImportContext.tsx'
export type { ImportWorkspaceProps } from './ImportWorkspace.tsx'
export type { ImportInjected, ImportKind, KnowledgeWorkspaceEntryProps } from './slots.ts'
export type { ImportStatus, ImportController } from './useImport.ts'
export type { ImportMetadata } from './components/MetadataForm.tsx'
export type { SourcePayload } from './components/SourcePicker.tsx'
