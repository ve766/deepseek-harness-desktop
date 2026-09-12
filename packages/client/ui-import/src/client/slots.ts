/**
 * Registrant-injected business face for the `import` knowledge.workspace entry.
 *
 * The face closes over the plugin's `ctx.remote.knowledge` (filled in
 * `apply`); the component never touches `ctx.remote` directly — it reads these
 * methods through the `useImport` hook. Every method returns the raw
 * `RemoteResult` the carrier folds failures into, so the hook (not the
 * component) owns the unwrap decision — identical to ui-knowledge's
 * {@link KnowledgeInjected} contract.
 * @module @deepseek-ai/dsh-client-ui-import/client/slots
 */

import type { KnowledgeItem } from '@deepseek-ai/dsh-knowledge-storage/types'
import type { ImportRequest, KnowledgeSourceKind } from '@deepseek-ai/dsh-knowledge-indexer/types'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { KnowledgeWorkspaceEntryProps } from '@deepseek-ai/dsh-client-ui-knowledge/client'

/** Re-exported so sibling modules need not reach into ui-knowledge directly. */
export type { KnowledgeWorkspaceEntryProps }

/** How the backend should interpret the submitted raw text. */
export type ImportKind = KnowledgeSourceKind

/** The business face handed to the `import` knowledge.workspace component. */
export interface ImportInjected {
  /** Import a raw document into the knowledge store. */
  importDoc: (request: ImportRequest) => Promise<RemoteResult<KnowledgeItem>>
}
