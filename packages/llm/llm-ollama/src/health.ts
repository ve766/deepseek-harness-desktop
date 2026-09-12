/**
 * Local Ollama detection. `GET /api/tags` reports installed models; the chat
 * endpoint lives under `/v1` while the tags endpoint lives at the server root,
 * so the configured base URL's `/v1` suffix is stripped to derive the root.
 *
 * These helpers carry no credentials: a local Ollama server is unauthenticated.
 * Every request still sends {@link attributionHeaders} per the harness contract.
 * @module @deepseek-ai/dsh-llm-ollama/health
 */

import { attributionHeaders, LlmError } from '@deepseek-ai/dsh-llm'

/** Derive the Ollama server root URL from a `/v1`-suffixed chat base URL. */
export function ollamaRootUrl(baseURL: string): string {
  return baseURL.replace(/\/v1\/?$/, '')
}

/** Result of probing the local Ollama server. */
export interface OllamaHealth {
  /** Whether a server answered at all (HTTP reachability). */
  installed: boolean
  /** Locally installed model ids, when reachable. */
  models: string[]
}

/**
 * Fetch the locally installed Ollama model names via `GET /api/tags`.
 * @param rootUrl - Ollama server root (no `/v1` suffix).
 * @param signal - optional caller cancellation.
 * @returns the installed model ids.
 * @throws LlmError with code `TRANSPORT` on an unreachable server or non-2xx response.
 */
export async function listOllamaModels(rootUrl: string, signal?: AbortSignal): Promise<string[]> {
  const response = await fetch(`${rootUrl}/api/tags`, {
    headers: { ...attributionHeaders() },
    signal: signal ?? null,
  })
  if (!response.ok) {
    throw new LlmError(`Ollama GET /api/tags returned HTTP ${response.status}`, 'TRANSPORT', { status: response.status })
  }
  const json = await response.json() as { models?: Array<{ name?: unknown }> }
  const names: string[] = []
  for (const model of json.models ?? []) {
    if (typeof model.name === 'string' && model.name.length > 0) {
      names.push(model.name)
    }
  }
  return names
}

/**
 * Probe the local Ollama server for reachability and installed models. Never
 * throws — an unreachable or erroring server is a supported "not installed"
 * outcome the caller surfaces without crashing.
 * @param baseURL - the configured chat base URL (its `/v1` suffix is stripped).
 * @param signal - optional caller cancellation.
 * @returns reachability plus the installed model ids.
 */
export async function detectOllama(baseURL: string, signal?: AbortSignal): Promise<OllamaHealth> {
  try {
    const models = await listOllamaModels(ollamaRootUrl(baseURL), signal)
    return { installed: true, models }
  } catch {
    return { installed: false, models: [] }
  }
}
