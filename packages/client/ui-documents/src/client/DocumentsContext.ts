/**
 * React context carrying the registrant-injected documents face down to every
 * descendant. Keeping the face in context (rather than prop-drilling it) lets
 * child components call `useDocuments()` without reaching `ctx.remote`.
 * @module @deepseek-ai/dsh-client-ui-documents/client/DocumentsContext
 */

import { createContext } from 'react'
import type { DocumentsInjected } from './slots.ts'

/** Carries the injected documents face; null only if a view escapes the provider. */
export const DocumentsContext = createContext<DocumentsInjected | null>(null)

/** Diagnostic thrown when a component uses `useDocuments` outside the provider. */
export class DocumentsContextMissingError extends Error {
  constructor() {
    super('useDocuments() must be called within a documents provider')
    this.name = 'DocumentsContextMissingError'
  }
}
