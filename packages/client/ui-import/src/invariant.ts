/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-import`.
 * @module @deepseek-ai/dsh-client-ui-import/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-import'

/** Cordis companion plugin name. */
export const name = 'client-ui-import-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the plugin owns one `knowledge.workspace` registration
 * released by the same effect disposer that withdraws it, so no second
 * authority exists to check at runtime.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
