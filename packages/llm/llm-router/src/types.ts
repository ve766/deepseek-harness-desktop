/**
 * Routing contracts for the LLM Router — the decision layer between the Agent
 * and the LlmRuntime. It decides *which* provider and model a request should
 * hit (auto fallback cloud -> local -> offline, or honoring an explicit choice)
 * without touching execution, retries, or any provider adapter.
 * @module @deepseek-ai/dsh-llm-router/types
 */

import type { LlmCallConfig, LlmRuntime } from '@deepseek-ai/dsh-llm'
import type {
  DetectOptions,
  DetectionReport,
  ProviderCapability,
  ProviderSource,
  RecommendMode,
} from '@deepseek-ai/dsh-ai-provider-manager'

/** Provider ids registered with `ctx.llm` for each detectable source. */
export const SOURCE_TO_PROVIDER: Readonly<Record<ProviderSource, string>> = {
  deepseek: 'deepseek',
  ollama: 'ollama',
  none: '',
}

/** Error code raised when an explicitly-requested provider cannot serve. */
export const EXPLICIT_PROVIDER_UNAVAILABLE = 'EXPLICIT_PROVIDER_UNAVAILABLE'

/**
 * LlmError codes that permit an auto-mode fallback to the next tier. Auth and
 * credential errors are deliberately excluded so a misconfiguration is never
 * silently hidden behind a provider switch.
 */
export const ALLOWED_FAILOVER_CODES = [
  'NO_ADAPTER',
  'TRANSPORT',
  'TIMEOUT',
  'SERVER',
  'QUOTA',
] as const

export type FailoverCode = (typeof ALLOWED_FAILOVER_CODES)[number]

/** A request for the Router to resolve and prepare an LLM call. */
export interface RouterRequest {
  /** Explicit provider id (`'deepseek'` | `'ollama'`), or `'auto'`/omitted. */
  provider?: string
  /** Explicit model id; when omitted the Router selects one per capability. */
  model?: string
  reasoningEffort?: LlmCallConfig['reasoningEffort']
  temperature?: number
  maxTokens?: number
  stop?: string[]
}

/** The resolved provider + model the Router selected. */
export interface ResolvedCall {
  provider: string
  model: string
  source: ProviderSource
  tier: ProviderCapability['tier']
  auto: boolean
}

/** Tunables for the Router service. */
export interface RouterConfig {
  /** TTL for the environment detection cache (ms). Default 60000. */
  capabilityCacheTtlMs?: number
  /** TTL for the resolve-result cache (ms). Default 30000. */
  resolveCacheTtlMs?: number
  /** Cloud model used when auto and no model is requested. Default 'deepseek-v4-flash'. */
  defaultCloudModel?: string
  /** Local model used when auto and no model is requested (falls back to installed). */
  defaultLocalModel?: string
  /** Runtime failover policy. MVP default 'none' (selection-time only). */
  fallbackPolicy?: 'none' | 'auto'
}

/** Non-serializable seams for deterministic tests. */
export interface RouterInternals {
  detect?: (options?: DetectOptions) => Promise<DetectionReport>
  recommend?: (report: DetectionReport, mode?: RecommendMode) => ProviderSource
  llm?: Pick<LlmRuntime, 'listProviders' | 'listModels' | 'prepareCall'>
  now?: () => number
}
