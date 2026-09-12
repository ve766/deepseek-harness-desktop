/**
 * `OllamaAdapter`: fetch + SSE against a local Ollama (OpenAI-compatible)
 * chat-completions endpoint, emitting harness `StreamChunk`s. Transport-only:
 * no credential is required or sent (a local Ollama server is unauthenticated),
 * but every request carries {@link attributionHeaders}. Idle timeouts reuse the
 * shared `@deepseek-ai/dsh-timeout` watchdog; failures surface as `LlmError`
 * with a stable code — never a bare `Error`.
 * @module @deepseek-ai/dsh-llm-ollama/adapter
 */

import {
  attributionHeaders,
  LlmAdapter,
  LlmError,
  type ContentBlock,
  type GenerateOptions,
  type LlmModelInfo,
  type LlmProviderInfo,
  type LlmResolvedModelInfo,
  type Message,
  type StreamChunk,
  type ToolCallBlock,
  type ToolResultBlock,
} from '@deepseek-ai/dsh-llm'
import { idleWatchdog, timeoutOf } from '@deepseek-ai/dsh-timeout'
import type { ResolvedOllamaConfig } from './config.ts'
import { listOllamaModels, ollamaRootUrl } from './health.ts'
import { parseSse, translate } from './sse.ts'

/** One resolution's complete request facts, re-read per operation. */
export interface OllamaAdapterOptions {
  /** Current validated connection facts; called once per operation. */
  options: () => ResolvedOllamaConfig
}

const STREAM_IDLE_TIMEOUT_CODE = 'OLLAMA_STREAM_IDLE_TIMEOUT'

// --- Wire request shape (OpenAI-compatible) ---

interface WireToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

interface WireTool {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

interface WireMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string
  tool_calls?: WireToolCall[]
  tool_call_id?: string
}

interface WireRequest {
  model: string
  messages: WireMessage[]
  stream: true
  stream_options: { include_usage: true }
  tools?: WireTool[]
  temperature?: number
  max_tokens?: number
  stop?: string[]
}

/** Join the text blocks of a message (used for user/tool-result/system content). */
function flattenText(blocks: readonly ContentBlock[]): string {
  let text = ''
  for (const block of blocks) {
    if (block.type === 'text') text += block.text
  }
  return text
}

/**
 * Serialize one harness message into zero or more OpenAI wire messages. User
 * `tool-result` blocks expand into separate `role: 'tool'` messages; assistant
 * `tool-call` blocks become `tool_calls`. Text blocks are flattened; image or
 * other non-text modalities are dropped (Ollama's chat route is text-first).
 */
function serializeMessage(message: Message): WireMessage[] {
  const wire: WireMessage[] = []
  if (message.role === 'system') {
    wire.push({ role: 'system', content: flattenText(message.content) })
    return wire
  }
  if (message.role === 'assistant') {
    const text = flattenText(message.content)
    const toolCalls = message.content
      .filter((block): block is ToolCallBlock => block.type === 'tool-call')
      .map(block => ({
        id: block.id,
        type: 'function' as const,
        function: { name: block.name, arguments: block.arguments },
      }))
    wire.push({
      role: 'assistant',
      content: text,
      ...toolCalls.length > 0 ? { tool_calls: toolCalls } : {},
    })
    return wire
  }
  // user role: tool results ride in user messages in the harness vocabulary,
  // but OpenAI wants them as role:'tool' messages.
  const toolResults = message.content.filter((block): block is ToolResultBlock => block.type === 'tool-result')
  const text = flattenText(message.content)
  if (text.length > 0 || toolResults.length === 0) {
    wire.push({ role: 'user', content: text })
  }
  for (const result of toolResults) {
    wire.push({
      role: 'tool',
      tool_call_id: result.toolCallId,
      // An empty tool output still needs SOME content on the wire.
      content: flattenText(result.content) || '(no output)',
    })
  }
  return wire
}

/**
 * Build the full OpenAI-compatible wire request. Always streaming
 * (`stream: true`, usage reporting on); optional fields are omitted rather than
 * sent as null so Ollama applies its own defaults.
 * @param options - the harness request (model, history, system, tools, sampling).
 * @returns the chat-completions request body.
 */
export function serializeRequest(options: GenerateOptions): WireRequest {
  const messages: WireMessage[] = []
  if (options.system !== undefined) {
    messages.push({ role: 'system', content: options.system })
  }
  for (const message of options.messages) {
    messages.push(...serializeMessage(message))
  }
  const tools: WireTool[] | undefined = options.tools?.map(tool => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }))
  return {
    model: options.model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    ...tools !== undefined && tools.length > 0 ? { tools } : {},
    ...options.temperature !== undefined ? { temperature: options.temperature } : {},
    ...options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {},
    ...options.stop !== undefined ? { stop: options.stop } : {},
  }
}

/**
 * The local Ollama adapter. One instance serves every model name it is
 * registered under (the harness model name IS the wire model name).
 */
export class OllamaAdapter extends LlmAdapter {
  constructor(private readonly config: OllamaAdapterOptions) {
    super()
  }

  override providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: 'Ollama' }
  }

  override listModels(provider: string, _signal?: AbortSignal): Promise<readonly LlmModelInfo[]> {
    const root = ollamaRootUrl(this.config.options().baseURL)
    return listOllamaModels(root).then(models => models.map(id => ({
      provider,
      id,
      name: id,
      inputModalities: ['text' as const],
    })))
  }

  override resolveModel(
    provider: string,
    model: string,
    _signal?: AbortSignal,
  ): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({
      provider,
      id: model,
      name: model,
      inputModalities: ['text' as const],
      context: { contextWindow: this.config.options().defaultContextWindow },
    })
  }

  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const connection = this.config.options()
    const consumer = new AbortController()
    const upstream = options.signal === undefined
      ? consumer.signal
      : AbortSignal.any([options.signal, consumer.signal])
    using watchdog = idleWatchdog(upstream, connection.streamIdleTimeoutMs, STREAM_IDLE_TIMEOUT_CODE)
    const iterator = this.request(options, watchdog.signal, connection, () => watchdog.pulse())[Symbol.asyncIterator]()
    let exhausted = false
    try {
      while (true) {
        const result = await watchdog.next(iterator)
        if (result.done) {
          exhausted = true
          return
        }
        yield result.value
      }
    } catch (error: unknown) {
      if (timeoutOf(watchdog.signal, STREAM_IDLE_TIMEOUT_CODE) !== undefined) {
        throw new LlmError(
          `Ollama stream idle timeout after ${connection.streamIdleTimeoutMs}ms`,
          'TIMEOUT',
          { cause: error },
        )
      }
      if (options.signal?.aborted) {
        throw new LlmError('Ollama request aborted by caller', 'ABORTED', { cause: error })
      }
      // Non-LlmError here is only possible from the watchdog iterator plumbing;
      // every adapter-internal failure is already an LlmError, handled above.
      /* v8 ignore next 3 -- only unreachable watchdog plumbing reaches the fallback */
      throw error instanceof LlmError
        ? error
        : new LlmError(`Ollama API stream from ${connection.baseURL} failed`, 'TRANSPORT', { cause: error })
    } finally {
      consumer.abort('Ollama stream consumer stopped')
      if (!exhausted) {
        try {
          await iterator.return(undefined)
        } catch {
          // best-effort teardown; a return-time throw cannot add a second outcome
        }
      }
    }
  }

  private async * request(
    options: GenerateOptions,
    signal: AbortSignal,
    connection: ResolvedOllamaConfig,
    onComment: () => void,
  ): AsyncGenerator<StreamChunk> {
    const body = JSON.stringify(serializeRequest(options))
    const headers = {
      'content-type': 'application/json',
      'accept': 'text/event-stream',
      ...attributionHeaders(),
    }
    let response: Response
    try {
      response = await fetch(`${connection.baseURL}/chat/completions`, {
        method: 'POST',
        headers,
        body,
        signal,
      })
    } catch (error: unknown) {
      if (signal.aborted) throw error
      throw new LlmError(`Ollama API request to ${connection.baseURL} failed`, 'TRANSPORT', { cause: error })
    }

    if (!response.ok) {
      let message = `Ollama API error (HTTP ${response.status})`
      try {
        const parsed = await response.json() as { error?: { message?: string } }
        if (parsed.error?.message) message = parsed.error.message
      } catch {
        // malformed error body: keep the HTTP-status diagnosis
      }
      throw new LlmError(message, 'SERVER', { status: response.status })
    }
    if (!response.body) {
      throw new LlmError('Ollama API returned no response body', 'EMPTY_RESPONSE')
    }

    yield* translate(parseSse(response.body, onComment))
  }
}
