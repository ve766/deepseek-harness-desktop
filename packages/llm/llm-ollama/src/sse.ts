/**
 * Minimal SSE framing and OpenAI-compatible wire translation for Ollama's
 * `/v1/chat/completions` endpoint. The wire format is identical to DeepSeek's,
 * so this is a self-contained reimplementation (no cross-package value import):
 * framing (UTF-8/CRLF/comment handling, `[DONE]` sentinel) plus a wire-to-harness
 * chunk translator. The harness `StreamChunk` contract is emitted exactly:
 * `block-start` → `text-delta`* → `block-end` → `usage` → `finish`.
 * @module @deepseek-ai/dsh-llm-ollama/sse
 */

import { CallId, LlmError, type FinishReason, type StreamChunk, type TokenUsage } from '@deepseek-ai/dsh-llm'

/** The terminal payload every OpenAI-compatible stream sends after the last chunk. */
export const DONE = '[DONE]'

/**
 * Reduce one SSE line to its `data` payload, or `null` for non-data lines.
 * Blank lines (event separators), comments (`:`-prefixed), and other fields
 * (`event:`, `id:`) are ignored.
 */
function handleLine(line: string, onComment?: (comment: string) => void): string | null {
  if (line.length === 0) return null
  if (line.startsWith(':')) {
    onComment?.(line.slice(1).trim())
    return null
  }
  if (line.startsWith('data:')) {
    return line.slice(5).replace(/^[ \t]+/, '')
  }
  return null
}

/**
 * Decode an SSE byte stream into event `data` payloads. Yields `[DONE]` as the
 * final value and returns; throws `LlmError('STREAM_CLOSED')` when the stream
 * ends without it (truncated response — the model call cannot be trusted).
 * @param stream - raw SSE bytes; reads may split anywhere, including mid-UTF-8.
 * @param onComment - optional transport-activity callback for comments.
 * @returns each event's data payload in arrival order, `[DONE]` last.
 */
export async function* parseSse(
  stream: ReadableStream<BufferSource>,
  onComment?: (comment: string) => void,
): AsyncGenerator<string> {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += value
    let nl = buffer.indexOf('\n')
    while (nl !== -1) {
      const line = buffer.slice(0, nl).replace(/\r$/, '')
      buffer = buffer.slice(nl + 1)
      const payload = handleLine(line, onComment)
      if (payload !== null) {
        if (payload === DONE) {
          yield DONE
          return
        }
        yield payload
      }
      nl = buffer.indexOf('\n')
    }
  }
  throw new LlmError('SSE stream ended without [DONE]', 'STREAM_CLOSED')
}

// --- Wire shape (subset of the OpenAI chat-completions streaming contract) ---

interface WireToolCall {
  index: number
  id?: string
  function?: { name?: string; arguments?: string }
}

interface WireChoice {
  delta?: {
    content?: string
    tool_calls?: WireToolCall[]
  }
  finish_reason?: string | null
}

interface WireChunk {
  choices?: WireChoice[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

/** Map the wire `finish_reason` vocabulary to the harness {@link FinishReason}. */
export function mapFinishReason(reason: string): FinishReason {
  switch (reason) {
    case 'stop': return { kind: 'stop' }
    case 'tool_calls': return { kind: 'tool-calls' }
    case 'length': return { kind: 'max-tokens' }
    default:
      return {
        kind: 'error',
        failure: { message: `model stopped: ${reason}`, code: reason.toUpperCase() },
      }
  }
}

/** Map wire usage fields to disjoint harness counts. */
function mapUsage(usage: NonNullable<WireChunk['usage']>): TokenUsage {
  return {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
  }
}

interface OpenBlock {
  index: number
  kind: 'text' | 'tool-call'
  text: string
  callId: string
  name: string
}

/**
 * Translate OpenAI-compatible SSE payloads (ending with `[DONE]`) into harness
 * `StreamChunk`s. An empty initial content delta does not open a block; finish
 * reason and usage are deferred to `[DONE]`, ensuring no chunk follows `finish`.
 * Malformed JSON aborts the stream with `MALFORMED_RESPONSE`.
 * @param payloads - SSE data payloads from {@link parseSse}, `[DONE]`-terminated.
 * @returns deltas as they arrive; `block-end`s, `usage`, and `finish` are deferred to `[DONE]`.
 */
export async function* translate(payloads: AsyncIterable<string>): AsyncGenerator<StreamChunk> {
  let nextIndex = 0
  let textBlock: OpenBlock | undefined
  const toolBlocks = new Map<number, OpenBlock>()
  const order: OpenBlock[] = []
  let pendingFinish: FinishReason | undefined
  let pendingUsage: TokenUsage | undefined

  const openText = (): OpenBlock => {
    const block: OpenBlock = { index: nextIndex++, kind: 'text', text: '', callId: '', name: '' }
    order.push(block)
    return block
  }
  const openTool = (index: number): OpenBlock => {
    const block: OpenBlock = { index: nextIndex++, kind: 'tool-call', text: '', callId: '', name: '' }
    toolBlocks.set(index, block)
    order.push(block)
    return block
  }

  for await (const payload of payloads) {
    if (payload === DONE) {
      for (const block of order) {
        if (block.kind === 'text') {
          yield { type: 'block-end', index: block.index, block: { type: 'text', text: block.text } }
        } else {
          yield {
            type: 'block-end',
            index: block.index,
            block: { type: 'tool-call', id: CallId(block.callId), name: block.name, arguments: block.text },
          }
        }
      }
      if (pendingUsage) yield { type: 'usage', usage: pendingUsage }
      const reason = pendingFinish ?? { kind: 'stop' as const }
      yield {
        type: 'finish',
        reason: reason.kind === 'stop' && order.length === 0
          ? { kind: 'error', failure: { message: 'model returned a completed response with no content', code: 'EMPTY_RESPONSE' } }
          : reason,
      }
      return
    }

    let chunk: WireChunk
    try {
      chunk = JSON.parse(payload) as WireChunk
    } catch {
      throw new LlmError(`malformed SSE payload: ${payload.slice(0, 120)}`, 'MALFORMED_RESPONSE')
    }

    for (const choice of chunk.choices ?? []) {
      const delta = choice.delta
      const content = delta?.content
      if (typeof content === 'string' && content.length > 0) {
        if (!textBlock) {
          textBlock = openText()
          yield { type: 'block-start', index: textBlock.index, blockType: 'text' }
        }
        textBlock.text += content
        yield { type: 'text-delta', index: textBlock.index, text: content }
      }

      for (const call of delta?.tool_calls ?? []) {
        let block = toolBlocks.get(call.index)
        if (block === undefined) {
          block = openTool(call.index)
          yield { type: 'block-start', index: block.index, blockType: 'tool-call' }
        }
        if (call.id !== undefined) block.callId = call.id
        if (call.function?.name !== undefined) block.name = call.function.name
        const fragment = call.function?.arguments ?? ''
        block.text += fragment
        yield {
          type: 'tool-call-delta',
          index: block.index,
          id: CallId(block.callId),
          ...block.name !== undefined && block.name.length > 0 ? { name: block.name } : {},
          argumentsDelta: fragment,
        }
      }

      if (typeof choice.finish_reason === 'string') {
        pendingFinish = mapFinishReason(choice.finish_reason)
      }
    }

    if (chunk.usage) pendingUsage = mapUsage(chunk.usage)
  }

  throw new LlmError('SSE payload stream ended without [DONE]', 'STREAM_CLOSED')
}
