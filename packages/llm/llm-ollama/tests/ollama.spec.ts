/**
 * Unit and integration tests for the Ollama adapter. The network boundary is
 * mocked with `vi.stubGlobal('fetch')`; no real Ollama is contacted. Coverage
 * targets per-file 100% for every `src/**` file in this package.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, {
  CallId,
  createMessage,
  type GenerateOptions,
  type Message,
  type StreamChunk,
  type ToolResultBlock,
} from '@deepseek-ai/dsh-llm'
import { OllamaAdapter, serializeRequest } from '../src/adapter.ts'
import { resolveOllamaConfig, type ResolvedOllamaConfig } from '../src/config.ts'
import { detectOllama, listOllamaModels, ollamaRootUrl } from '../src/health.ts'
import { name, inject, apply } from '../src/index.ts'
import { mapFinishReason, parseSse, translate } from '../src/sse.ts'

// --- harness message helpers -------------------------------------------------

function userMsg(text: string): Message {
  return createMessage({ role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } })
}
function systemMsg(text: string): Message {
  return createMessage({ role: 'system', content: [{ type: 'text', text }], source: { kind: 'user' } })
}
function assistantTextMsg(text: string): Message {
  return createMessage({
    role: 'assistant',
    content: [{ type: 'text', text }],
    source: { kind: 'model', provider: 'ollama', model: 'qwen3' },
  })
}
function assistantToolMsg(): Message {
  return createMessage({
    role: 'assistant',
    content: [
      { type: 'text', text: 'let me call' },
      { type: 'tool-call', id: CallId('call_1'), name: 'f', arguments: '{}' },
    ],
    source: { kind: 'model', provider: 'ollama', model: 'qwen3' },
  })
}
function userToolResultMsgOnly(): Message {
  const result: ToolResultBlock = {
    type: 'tool-result',
    toolCallId: CallId('call_1'),
    content: [{ type: 'text', text: 'r' }],
    isError: false,
  }
  return createMessage({
    role: 'user',
    content: [result],
    source: { kind: 'tool', callId: CallId('call_1') },
  })
}

// --- shared fixtures ---------------------------------------------------------

function makeConfig(overrides: Partial<ResolvedOllamaConfig> = {}): ResolvedOllamaConfig {
  return {
    baseURL: 'http://localhost:11434/v1',
    streamIdleTimeoutMs: 300_000,
    defaultContextWindow: 128_000,
    ...overrides,
  }
}

async function makeRuntime(adapter: OllamaAdapter): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  ctx.llm.registerAdapter(['ollama'], adapter)
  return ctx
}

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

function lastFinish(chunks: StreamChunk[]): { kind: string; code?: string; message?: string } {
  const finish = chunks[chunks.length - 1] as Extract<StreamChunk, { type: 'finish' }>
  const reason = finish.reason
  // Failure-carrying reasons nest the diagnosis; flatten it for assertions.
  return reason.kind === 'error' || reason.kind === 'aborted'
    ? { kind: reason.kind, code: reason.failure.code, message: reason.failure.message }
    : { kind: reason.kind }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// --- provider identity -------------------------------------------------------

describe('provider identity', () => {
  it('reports the ollama provider identity', async () => {
    const ctx = await makeRuntime(new OllamaAdapter({ options: () => makeConfig() }))
    const info = ctx.llm.listProviders().find(p => p.id === 'ollama')
    expect(info).toEqual({ id: 'ollama', name: 'Ollama' })
  })
})

// --- streaming (normal + contract) ------------------------------------------

describe('stream', () => {
  it('streams a normal Ollama SSE response into the chunk contract', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"role":"assistant","content":""}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":2}}\n\n',
      'data: [DONE]\n\n',
    ].join('')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(sse, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })))
    const ctx = await makeRuntime(new OllamaAdapter({ options: () => makeConfig() }))
    const chunks = await collect(ctx.llm.stream({
      provider: 'ollama',
      model: 'qwen3',
      messages: [userMsg('hi')],
    }))
    expect(chunks[0]).toEqual({ type: 'block-start', index: 0, blockType: 'text' })
    expect(chunks[1]).toEqual({ type: 'text-delta', index: 0, text: 'Hello' })
    expect(chunks[2]).toEqual({ type: 'text-delta', index: 0, text: ' world' })
    expect(chunks[3]).toEqual({ type: 'block-end', index: 0, block: { type: 'text', text: 'Hello world' } })
    expect(chunks[4]).toEqual({ type: 'usage', usage: { inputTokens: 5, outputTokens: 2 } })
    expect(chunks[5]).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
  })

  it('pulses the idle watchdog on SSE comment traffic', async () => {
    const sse = [
      ': keep-alive\n\n',
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ].join('')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(sse, { status: 200 })))
    const ctx = await makeRuntime(new OllamaAdapter({ options: () => makeConfig() }))
    const chunks = await collect(ctx.llm.stream({ provider: 'ollama', model: 'qwen3', messages: [userMsg('hi')] }))
    expect(chunks.some(c => c.type === 'text-delta')).toBe(true)
    expect(lastFinish(chunks).kind).toBe('stop')
  })

  it('sends attribution headers and no authorization on the chat request', async () => {
    let captured: RequestInit | undefined
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      captured = init
      return new Response('data: [DONE]\n\n', { status: 200 })
    }))
    const ctx = await makeRuntime(new OllamaAdapter({ options: () => makeConfig() }))
    await collect(ctx.llm.stream({ provider: 'ollama', model: 'qwen3', messages: [userMsg('hi')] }))
    const headers = captured!.headers as Record<string, string>
    expect(headers['authorization']).toBeUndefined()
    expect(headers['user-agent']).toMatch(/^deepseek-harness\//)
  })

  it('streams without any credential configuration', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      { status: 200 },
    )))
    const ctx = await makeRuntime(new OllamaAdapter({ options: () => makeConfig() }))
    const chunks = await collect(ctx.llm.stream({ provider: 'ollama', model: 'qwen3', messages: [userMsg('hi')] }))
    expect(chunks.some(c => c.type === 'text-delta' && (c as { text: string }).text === 'ok')).toBe(true)
    expect(lastFinish(chunks).kind).toBe('stop')
  })

  it('normalizes a connection failure into a TRANSPORT finish chunk', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
    const ctx = await makeRuntime(new OllamaAdapter({ options: () => makeConfig() }))
    const chunks = await collect(ctx.llm.stream({ provider: 'ollama', model: 'qwen3', messages: [userMsg('hi')] }))
    const finish = lastFinish(chunks)
    expect(finish.kind).toBe('error')
    expect(finish.code).toBe('TRANSPORT')
  })

  it('maps a non-2xx response to a SERVER finish chunk (provider message)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { message: 'boom' } }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )))
    const ctx = await makeRuntime(new OllamaAdapter({ options: () => makeConfig() }))
    const chunks = await collect(ctx.llm.stream({ provider: 'ollama', model: 'qwen3', messages: [userMsg('hi')] }))
    const finish = lastFinish(chunks)
    expect(finish.kind).toBe('error')
    expect(finish.code).toBe('SERVER')
    expect(finish.message).toContain('boom')
  })

  it('maps a non-2xx response with unparseable body to SERVER (HTTP diagnosis kept)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 500 })))
    const ctx = await makeRuntime(new OllamaAdapter({ options: () => makeConfig() }))
    const chunks = await collect(ctx.llm.stream({ provider: 'ollama', model: 'qwen3', messages: [userMsg('hi')] }))
    const finish = lastFinish(chunks)
    expect(finish.code).toBe('SERVER')
    expect(finish.message).toContain('HTTP 500')
  })

  it('keeps the HTTP diagnosis when the error body has no message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    const ctx = await makeRuntime(new OllamaAdapter({ options: () => makeConfig() }))
    const chunks = await collect(ctx.llm.stream({ provider: 'ollama', model: 'qwen3', messages: [userMsg('hi')] }))
    const finish = lastFinish(chunks)
    expect(finish.code).toBe('SERVER')
    expect(finish.message).toContain('HTTP 503')
  })

  it('reports EMPTY_RESPONSE when the provider returns no body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })))
    const ctx = await makeRuntime(new OllamaAdapter({ options: () => makeConfig() }))
    const chunks = await collect(ctx.llm.stream({ provider: 'ollama', model: 'qwen3', messages: [userMsg('hi')] }))
    const finish = lastFinish(chunks)
    expect(finish.code).toBe('EMPTY_RESPONSE')
  })

  it('aborts promptly when the caller signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('should not reach') }))
    const ctx = await makeRuntime(new OllamaAdapter({ options: () => makeConfig() }))
    const chunks = await collect(ctx.llm.stream({
      provider: 'ollama',
      model: 'qwen3',
      messages: [userMsg('hi')],
      signal: controller.signal,
    }))
    expect(lastFinish(chunks).kind).toBe('aborted')
  })

  it('reports TIMEOUT when the stream stalls past the idle budget', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          if (signal) {
            signal.addEventListener('abort', () => controller.error(new DOMException('idle timeout', 'AbortError')))
          }
        },
      })
      return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
    }))
    const ctx = await makeRuntime(new OllamaAdapter({ options: () => makeConfig({ streamIdleTimeoutMs: 30 }) }))
    const chunks = await collect(ctx.llm.stream({ provider: 'ollama', model: 'qwen3', messages: [userMsg('hi')] }))
    const finish = lastFinish(chunks)
    expect(finish.kind).toBe('error')
    expect(finish.code).toBe('TIMEOUT')
  })
})

// --- model catalog -----------------------------------------------------------

describe('model catalog', () => {
  it('lists locally installed Ollama models', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/tags')) {
        return new Response(JSON.stringify({ models: [{ name: 'qwen3' }, { name: 'qwen2.5-coder' }] }), { status: 200 })
      }
      return new Response('data: [DONE]\n\n', { status: 200 })
    }))
    const ctx = await makeRuntime(new OllamaAdapter({ options: () => makeConfig() }))
    const models = await ctx.llm.listModels('ollama')
    expect(models.map(m => m.id)).toEqual(['qwen3', 'qwen2.5-coder'])
    expect(models.every(m => m.provider === 'ollama' && m.inputModalities?.includes('text'))).toBe(true)
  })

  it('resolves an exact model with text modality and context window', async () => {
    const ctx = await makeRuntime(new OllamaAdapter({ options: () => makeConfig({ defaultContextWindow: 64000 }) }))
    const info = await ctx.llm.resolveModelInfo('ollama', 'qwen3')
    expect(info).toMatchObject({
      provider: 'ollama',
      id: 'qwen3',
      name: 'qwen3',
      inputModalities: ['text'],
      context: { contextWindow: 64000 },
    })
  })
})

// --- config ------------------------------------------------------------------

describe('resolveOllamaConfig', () => {
  it('resolves config with defaults and overrides', () => {
    expect(resolveOllamaConfig()).toEqual({
      baseURL: 'http://localhost:11434/v1',
      streamIdleTimeoutMs: 300_000,
      defaultContextWindow: 128_000,
    })
    expect(resolveOllamaConfig({ baseURL: 'http://x/v1', streamIdleTimeoutMs: 1000, defaultContextWindow: 4096 }))
      .toEqual({ baseURL: 'http://x/v1', streamIdleTimeoutMs: 1000, defaultContextWindow: 4096 })
  })
})

// --- health ------------------------------------------------------------------

describe('health', () => {
  it('detectOllama reports installed with models', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ models: [{ name: 'qwen3' }] }), { status: 200 },
    )))
    expect(await detectOllama('http://localhost:11434/v1')).toEqual({ installed: true, models: ['qwen3'] })
  })

  it('detectOllama reports installed with no models', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ models: [] }), { status: 200 })))
    expect(await detectOllama('http://localhost:11434')).toEqual({ installed: true, models: [] })
  })

  it('detectOllama reports not installed on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 500 })))
    expect(await detectOllama('http://localhost:11434/v1')).toEqual({ installed: false, models: [] })
  })

  it('detectOllama reports not installed on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('connection refused') }))
    expect(await detectOllama('http://localhost:11434/v1')).toEqual({ installed: false, models: [] })
  })

  it('listOllamaModels skips non-string or empty model names', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ models: [{ name: 'qwen3' }, { name: 123 }, { name: '' }] }), { status: 200 },
    )))
    expect(await listOllamaModels('http://localhost:11434')).toEqual(['qwen3'])
  })

  it('listOllamaModels treats a missing models key as no models', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })))
    expect(await listOllamaModels('http://localhost:11434')).toEqual([])
  })

  it('ollamaRootUrl strips the /v1 suffix', () => {
    expect(ollamaRootUrl('http://localhost:11434/v1')).toBe('http://localhost:11434')
    expect(ollamaRootUrl('http://localhost:11434/v1/')).toBe('http://localhost:11434')
    expect(ollamaRootUrl('http://host:11434')).toBe('http://host:11434')
  })
})

// --- plugin ------------------------------------------------------------------

describe('plugin', () => {
  it('registers as a cordis plugin under the llm service', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      { status: 200 },
    )))
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin({ name, inject, apply }, {})
    expect(ctx.llm.listProviders().some(p => p.id === 'ollama')).toBe(true)
    // Drive one request so the plugin-resolved config factory is exercised.
    const chunks = await collect(ctx.llm.stream({ provider: 'ollama', model: 'qwen3', messages: [userMsg('hi')] }))
    expect(lastFinish(chunks).kind).toBe('stop')
  })
})

// --- serialize ---------------------------------------------------------------

describe('serializeRequest', () => {
  it('serializes a full request with system, tools, sampling, and tool messages', () => {
    const options: GenerateOptions = {
      provider: 'ollama',
      model: 'qwen3',
      system: 'sys',
      messages: [systemMsg('sys-msg'), userMsg('hello'), assistantTextMsg('ok'), assistantToolMsg(), userToolResultMsgOnly()],
      tools: [{ name: 'f', description: 'd', parameters: { type: 'object' } }],
      temperature: 0.5,
      maxTokens: 100,
      stop: ['\n'],
    }
    const req = serializeRequest(options)
    expect(req.model).toBe('qwen3')
    expect(req.stream).toBe(true)
    expect(req.stream_options).toEqual({ include_usage: true })
    expect(req.messages[0]).toEqual({ role: 'system', content: 'sys' })
    expect(req.messages[1]).toEqual({ role: 'system', content: 'sys-msg' })
    expect(req.messages.some(m => m.role === 'assistant' && Array.isArray((m as { tool_calls?: unknown }).tool_calls))).toBe(true)
    expect(req.messages.some(m => m.role === 'tool')).toBe(true)
    expect(req.tools).toEqual([{ type: 'function', function: { name: 'f', description: 'd', parameters: { type: 'object' } } }])
    expect(req.temperature).toBe(0.5)
    expect(req.max_tokens).toBe(100)
    expect(req.stop).toEqual(['\n'])
  })

  it('serializes an empty tool result with placeholder content', () => {
    const empty: ToolResultBlock = {
      type: 'tool-result',
      toolCallId: CallId('call_9'),
      content: [],
      isError: false,
    }
    const message = createMessage({
      role: 'user',
      content: [empty],
      source: { kind: 'tool', callId: CallId('call_9') },
    })
    const req = serializeRequest({ provider: 'ollama', model: 'qwen3', messages: [message] })
    expect(req.messages).toEqual([{ role: 'tool', tool_call_id: 'call_9', content: '(no output)' }])
  })

  it('serializes a minimal request with no optional fields', () => {
    const req = serializeRequest({ provider: 'ollama', model: 'qwen3', messages: [userMsg('hi')] })
    expect(req.system).toBeUndefined()
    expect(req.tools).toBeUndefined()
    expect(req.temperature).toBeUndefined()
    expect(req.max_tokens).toBeUndefined()
    expect(req.stop).toBeUndefined()
    expect(req.messages).toEqual([{ role: 'user', content: 'hi' }])
  })
})

// --- parseSse ----------------------------------------------------------------

describe('parseSse', () => {
  async function readAll(text: string): Promise<string[]> {
    const out: string[] = []
    for await (const p of parseSse(new Response(text).body!, undefined)) out.push(p)
    return out
  }

  it('parses SSE data lines and terminates on [DONE]', async () => {
    expect(await readAll('data: {"a":1}\n\ndata: [DONE]\n\n')).toEqual(['{"a":1}', '[DONE]'])
  })

  it('handles CRLF, comments, and other fields', async () => {
    const out = await readAll(': keep-alive\r\ndata: {"x":1}\r\n\r\nid: 1\ndata:[DONE]\r\n')
    expect(out).toEqual(['{"x":1}', '[DONE]'])
  })

  it('re-assembles a payload split across reads', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"a":'))
        controller.enqueue(new TextEncoder().encode('1}\n\ndata: [DONE]\n\n'))
        controller.close()
      },
    })
    const out: string[] = []
    for await (const p of parseSse(stream, undefined)) out.push(p)
    expect(out).toEqual(['{"a":1}', '[DONE]'])
  })

  it('throws STREAM_CLOSED on truncation', async () => {
    await expect(async () => {
      for await (const _ of parseSse(new Response('').body!, undefined)) { /* drain */ }
    }).rejects.toMatchObject({ failure: { code: 'STREAM_CLOSED' } })
  })

  it('invokes onComment when no handler is supplied (no throw)', async () => {
    const out: string[] = []
    for await (const p of parseSse(new Response(': c\ndata: [DONE]\n\n').body!, undefined)) out.push(p)
    expect(out).toEqual(['[DONE]'])
  })
})

// --- translate ---------------------------------------------------------------

describe('translate', () => {
  async function* payloads(items: string[]): AsyncIterable<string> {
    for (const item of items) yield item
  }
  async function translateAll(items: string[]): Promise<StreamChunk[]> {
    const out: StreamChunk[] = []
    for await (const c of translate(payloads(items))) out.push(c)
    return out
  }

  it('translates a full text+tool stream with usage', async () => {
    const chunks = await translateAll([
      '{"choices":[{"delta":{"content":""}}]}',
      '{"choices":[{"delta":{"content":"Hi"}}]}',
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"f","arguments":""}}]}}]}',
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"a:1}"}}]}}]}',
      '{"choices":[{"delta":{"tool_calls":[{"index":1,"function":{}}]}}]}',
      '{"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":7,"completion_tokens":3}}',
      '[DONE]',
    ])
    expect(chunks.some(c => c.type === 'text-delta' && (c as { text: string }).text === 'Hi')).toBe(true)
    expect(chunks.some(c => c.type === 'tool-call-delta' && (c as { name?: string }).name === 'f')).toBe(true)
    expect(chunks.some(c => c.type === 'tool-call-delta' && (c as { name?: string }).name === undefined)).toBe(true)
    expect(chunks.some(c => c.type === 'usage' && (c as { usage: { inputTokens: number } }).usage.inputTokens === 7)).toBe(true)
    expect(chunks[chunks.length - 1]).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
  })

  it('emits a stop finish without a usage chunk when none is reported', async () => {
    const chunks = await translateAll(['{"choices":[{"delta":{"content":"x"}}]}', '[DONE]'])
    expect(chunks.some(c => c.type === 'usage')).toBe(false)
    expect(chunks[chunks.length - 1]).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
  })

  it('maps finish_reason length to max-tokens', async () => {
    const chunks = await translateAll(['{"choices":[{"delta":{"content":"x"},"finish_reason":"length"}]}', '[DONE]'])
    expect(chunks[chunks.length - 1]).toMatchObject({ type: 'finish', reason: { kind: 'max-tokens' } })
  })

  it('maps unknown finish_reason to an error finish', async () => {
    const chunks = await translateAll(['{"choices":[{"delta":{"content":"x"},"finish_reason":"content_filter"}]}', '[DONE]'])
    expect(chunks[chunks.length - 1]).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: { code: 'CONTENT_FILTER' } } })
  })

  it('reports EMPTY_RESPONSE for a completed stream with no content', async () => {
    const chunks = await translateAll(['[DONE]'])
    expect(chunks).toEqual([{
      type: 'finish',
      reason: { kind: 'error', failure: { message: 'model returned a completed response with no content', code: 'EMPTY_RESPONSE' } },
    }])
  })

  it('handles a usage-only chunk that omits choices', async () => {
    const chunks = await translateAll([
      '{"choices":[{"delta":{"content":"x"}}]}',
      '{"usage":{"prompt_tokens":1,"completion_tokens":1}}',
      '[DONE]',
    ])
    expect(chunks.some(c => c.type === 'usage' && (c as { usage: { inputTokens: number } }).usage.inputTokens === 1)).toBe(true)
    expect(chunks[chunks.length - 1]).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
  })

  it('defaults absent usage counts to zero', async () => {
    const chunks = await translateAll([
      '{"choices":[{"delta":{"content":"x"}}]}',
      '{"usage":{}}',
      '[DONE]',
    ])
    const usage = chunks.find(c => c.type === 'usage') as Extract<StreamChunk, { type: 'usage' }> | undefined
    expect(usage?.usage).toEqual({ inputTokens: 0, outputTokens: 0 })
  })

  it('throws MALFORMED_RESPONSE on invalid JSON payload', async () => {
    await expect(async () => {
      for await (const _ of translate(payloads(['not json']))) { /* drain */ }
    }).rejects.toMatchObject({ failure: { code: 'MALFORMED_RESPONSE' } })
  })

  it('throws STREAM_CLOSED when the payload stream ends without [DONE]', async () => {
    await expect(async () => {
      for await (const _ of translate(payloads(['{"choices":[{"delta":{"content":"x"}}]}']))) { /* drain */ }
    }).rejects.toMatchObject({ failure: { code: 'STREAM_CLOSED' } })
  })
})

// --- mapFinishReason ---------------------------------------------------------

describe('mapFinishReason', () => {
  it('maps the standard finish reasons', () => {
    expect(mapFinishReason('stop')).toEqual({ kind: 'stop' })
    expect(mapFinishReason('tool_calls')).toEqual({ kind: 'tool-calls' })
    expect(mapFinishReason('length')).toEqual({ kind: 'max-tokens' })
    expect(mapFinishReason('weird')).toEqual({ kind: 'error', failure: { message: 'model stopped: weird', code: 'WEIRD' } })
  })
})
