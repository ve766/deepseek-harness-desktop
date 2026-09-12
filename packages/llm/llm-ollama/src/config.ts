/**
 * Configuration for the Ollama (OpenAI-compatible) adapter. Resolved once per
 * construction and re-read per operation, so a changed base URL reaches the next
 * request without re-registration.
 * @module @deepseek-ai/dsh-llm-ollama/config
 */

import { clampTimeout, MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'

/** Default Ollama OpenAI-compatible chat base URL. */
export const DEFAULT_BASE_URL = 'http://localhost:11434/v1'
/** Default maximum idle interval while one stream read is outstanding (5 min). */
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000
/** Default combined request/response context capacity for Ollama models. */
export const DEFAULT_CONTEXT_WINDOW = 128_000

/** Raw plugin/config shape; every field optional with a documented default. */
export interface OllamaConfig {
  /** Ollama OpenAI-compatible base URL; `/chat/completions` is appended. */
  baseURL?: string
  /** Maximum provider idle time while one stream read is outstanding. */
  streamIdleTimeoutMs?: number
  /** Positive context capacity used when an exact model discloses none. */
  defaultContextWindow?: number
}

/** Validated, detachable connection facts the adapter reads per operation. */
export interface ResolvedOllamaConfig {
  baseURL: string
  streamIdleTimeoutMs: number
  defaultContextWindow: number
}

/**
 * Resolve raw config to validated connection facts. Mirrors the other adapters'
 * one-resolve-step contract so programmatic construction cannot skip a default.
 * @param config - raw plugin config; `undefined` falls back to every default.
 * @returns detached, validated connection facts.
 */
export function resolveOllamaConfig(config: OllamaConfig = {}): ResolvedOllamaConfig {
  return {
    baseURL: config.baseURL ?? DEFAULT_BASE_URL,
    streamIdleTimeoutMs: clampTimeout(
      config.streamIdleTimeoutMs,
      DEFAULT_STREAM_IDLE_TIMEOUT_MS,
      MAX_TIMER_DELAY_MS,
      'streamIdleTimeoutMs',
    ),
    defaultContextWindow: config.defaultContextWindow ?? DEFAULT_CONTEXT_WINDOW,
  }
}
