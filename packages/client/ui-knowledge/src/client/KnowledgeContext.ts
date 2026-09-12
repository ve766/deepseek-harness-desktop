/**
 * React context carrying the registrant-injected knowledge face down to every
 * descendant view. Keeping the face in context (rather than prop-drilling it)
 * lets child views call `useKnowledge()` without reaching `ctx.remote`.
 * @module @deepseek-ai/dsh-client-ui-knowledge/client/KnowledgeContext
 */

import { createContext } from 'react'
import type { KnowledgeInjected } from './slots.ts'

/** Carries the injected knowledge face; null only if a view escapes the provider. */
export const KnowledgeContext = createContext<KnowledgeInjected | null>(null)

/** Diagnostic thrown when a view uses `useKnowledge` outside the provider. */
export class KnowledgeContextMissingError extends Error {
  constructor() {
    super('useKnowledge() must be called within the knowledge app.view provider')
    this.name = 'KnowledgeContextMissingError'
  }
}
