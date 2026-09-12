/**
 * Register an {@link OllamaAdapter} for the `ollama` provider route on `ctx.llm`.
 * The adapter needs no credentials (a local Ollama server is unauthenticated) and
 * only reads its base URL per operation, so a changed endpoint reaches the next
 * request without re-registration.
 * @module @deepseek-ai/dsh-llm-ollama
 */

import type { Context } from '@deepseek-ai/cordis'
import { OllamaAdapter } from './adapter.ts'
import { resolveOllamaConfig, type OllamaConfig } from './config.ts'

export { OllamaAdapter } from './adapter.ts'
export { serializeRequest } from './adapter.ts'
export {
  DEFAULT_BASE_URL,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  resolveOllamaConfig,
} from './config.ts'
export type { OllamaConfig, ResolvedOllamaConfig } from './config.ts'
export { detectOllama, listOllamaModels, ollamaRootUrl } from './health.ts'
export type { OllamaHealth } from './health.ts'
export { mapFinishReason } from './sse.ts'

/** Plugin identity; cordis activates this module as a plugin. */
export const name = 'llm-ollama'
/** Depends on the `llm` service being mounted before this plugin activates. */
export const inject = ['llm']

/**
 * Plugin entry point: resolve config once and register the adapter under the
 * `ollama` provider route.
 * @param ctx - the cordis context hosting the `llm` service.
 * @param config - raw plugin config; unspecified fields use adapter defaults.
 */
export function apply(ctx: Context, config: OllamaConfig): void {
  const adapter = new OllamaAdapter({ options: () => resolveOllamaConfig(config) })
  ctx.llm.registerAdapter(['ollama'], adapter)
}
