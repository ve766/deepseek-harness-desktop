/**
 * React context carrying the registrant-injected explore face down to every
 * descendant. Keeping the face in context (rather than prop-drilling it) lets
 * child components call `useExplore()` without reaching `ctx.remote`.
 * @module @deepseek-ai/dsh-client-ui-explore/client/ExploreContext
 */

import { createContext } from 'react'
import type { ExploreInjected } from './slots.ts'

/** Carries the injected explore face; null only if a view escapes the provider. */
export const ExploreContext = createContext<ExploreInjected | null>(null)

/** Diagnostic thrown when a component uses `useExplore` outside the provider. */
export class ExploreContextMissingError extends Error {
  constructor() {
    super('useExplore() must be called within an explore provider')
    this.name = 'ExploreContextMissingError'
  }
}
