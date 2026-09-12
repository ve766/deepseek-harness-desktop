/**
 * React context carrying the registrant-injected import face down to every
 * descendant. Keeping the face in context (rather than prop-drilling it) lets
 * child components call `useImport()` without reaching `ctx.remote`.
 * @module @deepseek-ai/dsh-client-ui-import/client/ImportContext
 */

import { createContext } from 'react'
import type { ImportInjected } from './slots.ts'

/** Carries the injected import face; null only if a view escapes the provider. */
export const ImportContext = createContext<ImportInjected | null>(null)

/** Diagnostic thrown when a component uses `useImport` outside the provider. */
export class ImportContextMissingError extends Error {
  constructor() {
    super('useImport() must be called within the knowledge.workspace import provider')
    this.name = 'ImportContextMissingError'
  }
}
