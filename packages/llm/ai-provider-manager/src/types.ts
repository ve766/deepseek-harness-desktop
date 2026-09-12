/**
 * Provider identity and capability model for the AI Provider Manager.
 *
 * The Manager detects which providers are usable in the current environment and
 * recommends one for the Router. It never imports provider adapters, so adding
 * a provider needs no change to existing adapter packages (the design's
 * "existing adapters zero modification" guarantee).
 * @module @deepseek-ai/dsh-ai-provider-manager/types
 */

/** Concrete provider identities the Manager can detect. */
export type ProviderSource = 'deepseek' | 'ollama' | 'none'

/** Strategic tier a provider belongs to, matching the auto fallback chain. */
export type ProviderTier = 'cloud' | 'local' | 'offline'

/** What the Manager learned about one provider's availability. */
export interface ProviderCapability {
  /** The provider this capability describes. */
  source: ProviderSource
  /** Strategic tier: `cloud` = remote API, `local` = on-device, `offline` = nothing. */
  tier: ProviderTier
  /** Whether the provider can serve requests right now. */
  available: boolean
  /** Model ids the provider exposes (empty when unavailable). */
  models: string[]
  /** Why the provider is unavailable, when `available` is `false`. */
  reason?: string
}

/** Full environment detection outcome across every known provider. */
export interface DetectionReport {
  /** Capability per concrete provider. */
  providers: {
    deepseek: ProviderCapability
    ollama: ProviderCapability
    none: ProviderCapability
  }
  /** Convenience lookups by tier. */
  cloud: ProviderCapability
  local: ProviderCapability
  offline: ProviderCapability
  /** Whether at least one real provider is available. */
  anyAvailable: boolean
}

/** How a recommendation should be resolved. */
export type RecommendMode = 'auto' | ProviderSource

/** Tunables for {@link detect}; every field defaults to a safe value. */
export interface DetectOptions {
  /** Env var holding the DeepSeek API key. Default `DEEPSEEK_API_KEY`. */
  deepseekApiKeyEnv?: string
  /** Base URL probed for Ollama's model list. Default `http://localhost:11434/v1`. */
  ollamaBaseUrl?: string
  /** Aborts in-flight probes. */
  signal?: AbortSignal
  /** Override `fetch` (tests inject a stub). */
  fetchImpl?: typeof fetch
  /** Override `process.env` (tests inject a fixed snapshot). */
  env?: NodeJS.ProcessEnv
}
