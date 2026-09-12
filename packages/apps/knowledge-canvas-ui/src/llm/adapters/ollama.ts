// Ollama adapter — the only provider implementation in P2-4.3.3.
//
// Talks to the local Ollama daemon over POST /api/chat with stream:false
// (response shape verified by the Step-0 smoke: message.content, eval_count,
// prompt_eval_count, done_reason). Plain fetch, no new dependency. Streaming,
// retries and telemetry are out of scope by ruling.
//
// Only serves a LOCAL deployment: the factory re-verifies localness and the
// local-only guard stands between any candidate list and this adapter.

import type {
  CompletionRequest,
  CompletionResult,
  LlmCapability,
} from '../capability'

export interface OllamaCapabilityOptions {
  readonly baseURL: string
  readonly model: string
}

interface OllamaChatResponse {
  readonly message?: { readonly role?: string; readonly content?: string }
  readonly done_reason?: string
  readonly prompt_eval_count?: number
  readonly eval_count?: number
}

export function createOllamaCapability(options: OllamaCapabilityOptions): LlmCapability {
  // DEFAULT_OLLAMA_BASE_URL is the OpenAI-compatible base and ends in '/v1';
  // the native daemon API lives at the ROOT (/api/chat). Strip any trailing
  // '/v1' so 'http://host:11434/v1' and 'http://host:11434' both work.
  const root = options.baseURL.replace(/\/+$/, '').replace(/\/v1$/, '')
  const endpoint = `${root}/api/chat`
  return {
    model: options.model,
    // Factory overrides with the endpoint-verified value; the adapter itself
    // never claims localness.
    local: true,
    async complete(req: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult> {
      const startedAt = Date.now()
      const body = {
        model: options.model,
        stream: false,
        messages: [
          ...(req.system !== undefined ? [{ role: 'system', content: req.system }] : []),
          { role: 'user', content: req.prompt },
        ],
        options: {
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
          ...(req.maxTokens !== undefined ? { num_predict: req.maxTokens } : {}),
        },
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`ollama chat failed: HTTP ${res.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`)
      }
      const data = (await res.json()) as OllamaChatResponse
      return {
        text: data.message?.content ?? '',
        usage: {
          inputTokens: data.prompt_eval_count,
          outputTokens: data.eval_count,
          ms: Date.now() - startedAt,
        },
      }
    },
  }
}
