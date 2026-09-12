/**
 * The registered `knowledge.workspace` entry component.
 *
 * Kept out of `index.ts` because the shared client bundle preset treats
 * `src/client/index.ts` as a TypeScript (non-JSX) entry; this module owns the
 * only JSX in the registration path — publishing the injected face through
 * context so descendants reach it via `useImport()`.
 * @module @deepseek-ai/dsh-client-ui-import/client/ImportWorkspace
 */

import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { ImportContext } from './ImportContext.tsx'
import { ImportView } from './ImportView.tsx'
import type { ImportInjected } from './slots.ts'

/** Composed props: runtime share plus the registrant-injected import face. */
export type ImportWorkspaceProps = PropsRuntime<'knowledge.workspace'> & InjectFace<ImportInjected>

/**
 * Render the import surface inside its inject-face provider.
 * @param props - composed slot props (runtime share + injected face).
 * @returns the import surface.
 */
export function ImportWorkspace(props: ImportWorkspaceProps) {
  return (
    <ImportContext.Provider value={{ importDoc: props.importDoc }}>
      <ImportView {...props} />
    </ImportContext.Provider>
  )
}

export default ImportWorkspace
