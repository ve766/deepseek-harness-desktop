/**
 * Search-specific remote error. Mirrors the DocumentsRemoteError / ExploreRemoteError
 * contract: the hook throws this (rather than returning a failure object) so the
 * carrier's error branch never leaks into component trees. Per the Phase 6-B-4
 * shared-components decision, no common Error base is extracted yet — each
 * surface owns its own until a second Remote caller proves the need.
 * @module @deepseek-ai/dsh-client-ui-search/invariant
 */

import type { RemoteFailure } from '@deepseek-ai/dsh-typert-protocol'

/** Thrown when a Remote call returns its error branch. */
export class SearchRemoteError extends Error {
  /** The carrier-reported failure. */
  readonly failure: RemoteFailure
  constructor(failure: RemoteFailure) {
    super(failure.message)
    this.name = 'SearchRemoteError'
    this.failure = failure
  }
}
