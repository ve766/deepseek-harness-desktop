/**
 * AI Provider Manager: detection and recommendation tests.
 *
 * Every scenario the design requires is covered: Ollama present / absent,
 * DeepSeek key present / absent, no provider at all, and the auto recommend
 * order. Branches (HTTP failure, parse filtering, credential presence, default
 * options, signal propagation) are exercised so the package meets the repo's
 * 100% per-file coverage gate.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_DEEPSEEK_API_KEY_ENV,
  detect,
  detectDeepSeek,
  detectOllama,
  recommend,
} from '../src/index.ts'
import type { DetectionReport } from '../src/index.ts'

/** Build a `fetch` stub returning a fixed status/body. */
function fetchStatus(status: number, body: unknown): typeof fetch {
  return (async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch
}

/** Build a `fetch` stub that always rejects, to exercise the catch path. */
function fetchThrowing(message: string): typeof fetch {
  return (async () => {
    throw new Error(message)
  }) as unknown as typeof fetch
}

/** Minimal report builder for recommendation tests. */
function reportWith(cloud: boolean, local: boolean): DetectionReport {
  return {
    providers: {
      deepseek: { source: 'deepseek', tier: 'cloud', available: cloud, models: [] },
      ollama: { source: 'ollama', tier: 'local', available: local, models: [] },
      none: { source: 'none', tier: 'offline', available: false, models: [] },
    },
    cloud: { source: 'deepseek', tier: 'cloud', available: cloud, models: [] },
    local: { source: 'ollama', tier: 'local', available: local, models: [] },
    offline: { source: 'none', tier: 'offline', available: false, models: [] },
    anyAvailable: cloud || local,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('detectDeepSeek (credential check)', () => {
  it('reports available when the key is present and non-empty', () => {
    const cap = detectDeepSeek('DEEPSEEK_API_KEY', { DEEPSEEK_API_KEY: ' sk-abc ' })
    expect(cap.available).toBe(true)
    expect(cap.tier).toBe('cloud')
    expect(cap.models).toEqual([])
    expect(cap.reason).toBeUndefined()
  })

  it('reports unavailable with a reason when the key is an empty string', () => {
    const cap = detectDeepSeek('DEEPSEEK_API_KEY', { DEEPSEEK_API_KEY: '' })
    expect(cap.available).toBe(false)
    expect(cap.reason).toBe('missing DEEPSEEK_API_KEY credential')
  })

  it('reports unavailable when the key env var is absent', () => {
    const cap = detectDeepSeek('DEEPSEEK_API_KEY', {})
    expect(cap.available).toBe(false)
    expect(cap.reason).toBe('missing DEEPSEEK_API_KEY credential')
  })
})

describe('detectOllama (endpoint probe + listModels)', () => {
  it('reports available with installed models on a 200', async () => {
    const cap = await detectOllama(
      'http://localhost:11434/v1',
      undefined,
      fetchStatus(200, { models: [{ name: 'llama3' }, { name: 'nomic-embed' }] }),
    )
    expect(cap.available).toBe(true)
    expect(cap.models).toEqual(['llama3', 'nomic-embed'])
    expect(cap.reason).toBeUndefined()
  })

  it('filters out models with empty or non-string names', async () => {
    const cap = await detectOllama(
      'http://localhost:11434/v1',
      undefined,
      fetchStatus(200, { models: [{ name: 'keep' }, { name: '' }, { name: 7 }] }),
    )
    expect(cap.models).toEqual(['keep'])
  })

  it('treats a missing models key as no models', async () => {
    const cap = await detectOllama('http://localhost:11434/v1', undefined, fetchStatus(200, {}))
    expect(cap.available).toBe(true)
    expect(cap.models).toEqual([])
  })

  it('reports unavailable with an HTTP diagnosis on a non-2xx response', async () => {
    const cap = await detectOllama('http://localhost:11434/v1', undefined, fetchStatus(503, {}))
    expect(cap.available).toBe(false)
    expect(cap.reason).toContain('HTTP 503')
  })

  it('reports unavailable when the probe throws', async () => {
    const cap = await detectOllama('http://localhost:11434/v1', undefined, fetchThrowing('down'))
    expect(cap.available).toBe(false)
    expect(cap.reason).toBe('down')
  })

  it('reports the generic reason when the probe throws a non-Error value', async () => {
    const fetchImpl = (async () => {
      throw 'string boom'
    }) as unknown as typeof fetch
    const cap = await detectOllama('http://localhost:11434/v1', undefined, fetchImpl)
    expect(cap.available).toBe(false)
    expect(cap.reason).toBe('Ollama probe failed')
  })

  it('passes the caller signal through to fetch', async () => {
    const controller = new AbortController()
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ models: [{ name: 'a' }] }),
    })) as unknown as typeof fetch
    await detectOllama('http://localhost:11434/v1', controller.signal, fetchImpl)
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      expect.objectContaining({ signal: controller.signal }),
    )
  })

  it('strips a /v1 suffix from the chat base URL', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ models: [] }),
    })) as unknown as typeof fetch
    await detectOllama('http://host:11434/v1', undefined, fetchImpl)
    expect(fetchImpl).toHaveBeenCalledWith('http://host:11434/api/tags', expect.anything())
  })
})

describe('detect (integration)', () => {
  it('Ollama present, no DeepSeek key: local available', async () => {
    const report = await detect({
      fetchImpl: fetchStatus(200, { models: [{ name: 'llama3' }] }),
      env: {},
    })
    expect(report.local.available).toBe(true)
    expect(report.cloud.available).toBe(false)
    expect(report.anyAvailable).toBe(true)
  })

  it('Ollama absent, no key: nothing available', async () => {
    const report = await detect({
      fetchImpl: fetchStatus(404, {}),
      env: {},
    })
    expect(report.local.available).toBe(false)
    expect(report.cloud.available).toBe(false)
    expect(report.anyAvailable).toBe(false)
    expect(report.offline.available).toBe(false)
  })

  it('DeepSeek key present, Ollama present: both available', async () => {
    const report = await detect({
      fetchImpl: fetchStatus(200, { models: [{ name: 'llama3' }] }),
      env: { DEEPSEEK_API_KEY: 'x' },
    })
    expect(report.cloud.available).toBe(true)
    expect(report.local.available).toBe(true)
    expect(report.anyAvailable).toBe(true)
  })

  it('DeepSeek key present, Ollama absent: cloud available', async () => {
    const report = await detect({
      fetchImpl: fetchStatus(503, {}),
      env: { DEEPSEEK_API_KEY: 'x' },
    })
    expect(report.cloud.available).toBe(true)
    expect(report.local.available).toBe(false)
    expect(report.anyAvailable).toBe(true)
  })

  it('applies default options (env var name, base URL, fetch, process.env)', async () => {
    // Default fetch = global fetch (stubbed); default env = real process.env.
    vi.stubGlobal('fetch', fetchStatus(404, {}))
    process.env[DEFAULT_DEEPSEEK_API_KEY_ENV] = ''
    const report = await detect()
    expect(report.local.available).toBe(false)
    expect(report.cloud.available).toBe(false)
    expect(report.anyAvailable).toBe(false)
  })
})

describe('recommend (auto order + explicit passthrough)', () => {
  it('auto prefers cloud over local, then offline', () => {
    expect(recommend(reportWith(true, true), 'auto')).toBe('deepseek')
    expect(recommend(reportWith(false, true), 'auto')).toBe('ollama')
    expect(recommend(reportWith(false, false), 'auto')).toBe('none')
  })

  it('returns an explicit provider unchanged (Router enforces no-fallback)', () => {
    expect(recommend(reportWith(false, false), 'deepseek')).toBe('deepseek')
    expect(recommend(reportWith(true, true), 'ollama')).toBe('ollama')
    expect(recommend(reportWith(true, true), 'none')).toBe('none')
  })

  it('defaults to auto when no mode is supplied', () => {
    expect(recommend(reportWith(false, true))).toBe('ollama')
  })
})
