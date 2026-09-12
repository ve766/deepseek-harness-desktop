// LlmCapability — the ability abstraction between the agent executor and the
// provider adapters (P2-4.3.3).
//
// Rulings baked in:
//   - Minimal: complete(request, signal) ONLY. No stream, no retry, no
//     telemetry, no memory, no agent logic (user ruling on Q1).
//   - The executor holds a capability instance and never sees a provider kind,
//     a model id or an endpoint; the factory binds the CHOSEN profile.
//   - Cloud adapters are deliberately NOT built in P2-4.3.3 (cloud profiles stay
//     unconfigured); unknown kinds fail honestly with NO_ADAPTER at call time.
//
// Dependency direction: capability -> ./providerConfig + ./routing (same layer);
// adapters -> capability types only. Forbidden: store/knowledge/mock/demo/
// components/react/agent. routing does NOT import capability (no cycle).

import {
  DEFAULT_OLLAMA_BASE_URL,
  defaultModelForKind,
  type LlmProviderProfile,
} from './providerConfig'
import { isLocalEndpoint } from './routing'
import { createOllamaCapability } from './adapters/ollama'

export interface CompletionRequest {
  readonly system?: string
  readonly prompt: string
  readonly temperature?: number
  readonly maxTokens?: number
}

export interface CompletionUsage {
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly ms: number
}

export interface CompletionResult {
  readonly text: string
  readonly usage?: CompletionUsage
}

export interface LlmCapability {
  /** Resolved model id — informational; the executor does not branch on it. */
  readonly model: string
  /** Endpoint-verified fact (re-verified, never the declared kind). */
  readonly local: boolean
  /** One structured-capable completion. Rejects on transport/model failure. */
  complete(req: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult>
}

/**
 * Bind a capability instance to the CHOSEN profile from the routing decision.
 * The ollama adapter is the only implementation in P2-4.3.3; other kinds fail
 * honestly at call time (NO_ADAPTER) instead of pretending.
 */
export function createLlmCapability(profile: LlmProviderProfile): LlmCapability {
  if (profile.providerKind === 'ollama') {
    const baseURL = profile.baseURL ?? DEFAULT_OLLAMA_BASE_URL
    const model = profile.model ?? defaultModelForKind('ollama') ?? 'qwen3:8b'
    // The adapter is endpoint-bound; `local` is re-verified here as a fact.
    return { ...createOllamaCapability({ baseURL, model }), local: isLocalEndpoint(profile) }
  }
  const model = profile.model ?? defaultModelForKind(profile.providerKind) ?? '(unimplemented)'
  return {
    model,
    local: isLocalEndpoint(profile),
    async complete() {
      throw new Error('NO_ADAPTER: no capability adapter for this provider kind yet')
    },
  }
}
