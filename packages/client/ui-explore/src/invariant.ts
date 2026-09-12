/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-explore`.
 * @module @deepseek-ai/dsh-client-ui-explore/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-explore'

/** Cordis companion plugin name. */
export const name = 'client-ui-explore-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the plugin owns two `knowledge.*` registrations
 * (workspace list + detail reader) released by the same effect disposers that
 * withdraw them, so no second authority exists to check at runtime.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
