/**
 * LLM Router: the decision layer for provider/model selection in the DeepSeek
 * Harness LLM seam. Routes `auto` requests through the cloud -> local -> offline
 * fallback chain and protects explicit provider choice, delegating all execution
 * to the LlmRuntime. Independent of any provider adapter.
 * @module @deepseek-ai/dsh-llm-router
 */

export { apply, inject, LlmRouter, name } from './service.ts'
export { EXPLICIT_PROVIDER_UNAVAILABLE, SOURCE_TO_PROVIDER } from './types.ts'
export type { FailoverCode } from './types.ts'
export type {
  ResolvedCall,
  RouterConfig,
  RouterInternals,
  RouterRequest,
} from './types.ts'
export {
  autoChainFrom,
  isFailoverError,
  resolveMode,
  sourceOf,
} from './resolve.ts'
export type { RouterMode } from './resolve.ts'
