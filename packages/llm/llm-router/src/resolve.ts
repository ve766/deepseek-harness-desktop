/**
 * Pure routing helpers for the LLM Router. No I/O, no state — every function is
 * a deterministic transform the {@link LlmRouter} service composes with detected
 * capability and the LlmRuntime. Keeping them side-effect free makes the policy
 * trivially unit-testable.
 * @module @deepseek-ai/dsh-llm-router/resolve
 */

import type { ProviderSource } from '@deepseek-ai/dsh-ai-provider-manager'
import { LlmError } from '@deepseek-ai/dsh-llm'
import { ALLOWED_FAILOVER_CODES } from './types.ts'
import type { RouterRequest } from './types.ts'

/** Whether a request names a specific provider or wants auto resolution. */
export type RouterMode = 'auto' | 'explicit'

/** Classify a request as explicit-provider or auto. */
export function resolveMode(request: RouterRequest): RouterMode {
  return request.provider !== undefined && request.provider !== 'auto' ? 'explicit' : 'auto'
}

/** Map a provider id string to its detection source (unknown -> none). */
export function sourceOf(provider: string | undefined): ProviderSource {
  if (provider === 'deepseek') return 'deepseek'
  if (provider === 'ollama') return 'ollama'
  return 'none'
}

/**
 * Ordered auto fallback chain, descending cloud -> local -> offline from the
 * recommended tier. `recommended` is one of the three tiers; the returned slice
 * starts there.
 */
export function autoChainFrom(recommended: ProviderSource): ProviderSource[] {
  const order: ProviderSource[] = ['deepseek', 'ollama', 'none']
  return order.slice(order.indexOf(recommended))
}

/** Whether an error permits an auto-mode fallback to the next tier. */
export function isFailoverError(error: unknown): boolean {
  if (!(error instanceof LlmError)) return false
  return (ALLOWED_FAILOVER_CODES as readonly string[]).includes(error.code)
}
