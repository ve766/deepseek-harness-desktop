import { Context } from '@deepseek-ai/cordis'
import { LlmError, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { LlmCallConfig, PreparedLlmCall } from '@deepseek-ai/dsh-llm'
import type {
  DetectionReport,
  ProviderCapability,
  ProviderSource,
} from '@deepseek-ai/dsh-ai-provider-manager'
import { describe, expect, it, vi } from 'vitest'
import { sourceOf } from '../src/resolve.ts'
import {
  apply,
  EXPLICIT_PROVIDER_UNAVAILABLE,
  LlmRouter,
} from '../src/index.ts'
import type { RouterRequest } from '../src/types.ts'

function makeReport(opts: {
  deepseek?: Partial<ProviderCapability>
  ollama?: Partial<ProviderCapability>
}): DetectionReport {
  const deepseek: ProviderCapability = {
    source: 'deepseek', tier: 'cloud', available: false, models: [], ...opts.deepseek,
  }
  const ollama: ProviderCapability = {
    source: 'ollama', tier: 'local', available: false, models: [], ...opts.ollama,
  }
  const none: ProviderCapability = {
    source: 'none', tier: 'offline', available: false, models: [], reason: 'no provider',
  }
  return {
    providers: { deepseek, ollama, none },
    cloud: deepseek,
    local: ollama,
    offline: none,
    anyAvailable: deepseek.available || ollama.available,
  }
}

interface FakeLlmOptions {
  registered: string[]
  models?: Record<string, string[]>
  failMap?: Record<string, unknown>
  prepareOverride?: (config: LlmCallConfig) => Promise<PreparedLlmCall>
}

function makeLlm(options: FakeLlmOptions) {
  const { registered, models = {}, failMap = {}, prepareOverride } = options
  const prepareCall = prepareOverride
    ?? (async (config: LlmCallConfig): Promise<PreparedLlmCall> => {
      const failure = failMap[config.provider]
      if (failure !== undefined) throw failure
      return { config } as unknown as PreparedLlmCall
    })
  return {
    listProviders: () => registered.map((id) => ({ id, name: id })),
    listModels: async (provider: string) =>
      (models[provider] ?? []).map((id) => ({ provider, id, name: id })),
    prepareCall: vi.fn(prepareCall),
  }
}

function dummyPrepared(provider: string, model: string): PreparedLlmCall {
  return { config: { provider, model } } as unknown as PreparedLlmCall
}

describe('LlmRouter — capability + resolve selection', () => {
  it('resolves auto to the cloud provider when DeepSeek is available', async () => {
    const report = makeReport({ deepseek: { available: true, models: ['deepseek-v4-flash'] } })
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      {
        detect: async () => report,
        llm: makeLlm({ registered: ['deepseek'], models: { deepseek: ['deepseek-v4-flash'] } }),
      },
    )

    const resolved = await router.resolve({})

    expect(resolved.provider).toBe('deepseek')
    expect(resolved.model).toBe('deepseek-v4-flash')
    expect(resolved.source).toBe('deepseek')
    expect(resolved.tier).toBe('cloud')
    expect(resolved.auto).toBe(true)
  })

  it('falls back cloud -> local when DeepSeek is unavailable (selection-time)', async () => {
    const report = makeReport({
      deepseek: { available: false },
      ollama: { available: true, models: ['llama3'] },
    })
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      {
        detect: async () => report,
        llm: makeLlm({ registered: ['ollama'], models: { ollama: ['llama3'] } }),
      },
    )

    const resolved = await router.resolve({})

    expect(resolved.provider).toBe('ollama')
    expect(resolved.model).toBe('llama3')
    expect(resolved.auto).toBe(true)
  })

  it('falls back cloud -> offline (throws NO_ADAPTER) when only Ollama is detected but not registered', async () => {
    const report = makeReport({
      deepseek: { available: false },
      ollama: { available: true, models: ['llama3'] },
    })
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      {
        detect: async () => report,
        llm: makeLlm({ registered: ['deepseek'] }), // ollama NOT registered
      },
    )

    await expect(router.resolve({})).rejects.toMatchObject({ code: 'NO_ADAPTER' })
  })

  it('honors an explicit provider that is available', async () => {
    const report = makeReport({ deepseek: { available: true, models: ['deepseek-v4-pro'] } })
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      {
        detect: async () => report,
        llm: makeLlm({ registered: ['deepseek'], models: { deepseek: ['deepseek-v4-pro'] } }),
      },
    )

    const resolved = await router.resolve({ provider: 'deepseek' })

    expect(resolved.provider).toBe('deepseek')
    expect(resolved.auto).toBe(false)
  })

  it('throws EXPLICIT_PROVIDER_UNAVAILABLE when the explicit provider is unavailable', async () => {
    const report = makeReport({ deepseek: { available: false } })
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      { detect: async () => report, llm: makeLlm({ registered: ['deepseek'] }) },
    )

    const error = await router.resolve({ provider: 'deepseek' }).catch((e) => e)
    expect(error).toBeInstanceOf(LlmError)
    expect((error as LlmError).code).toBe(EXPLICIT_PROVIDER_UNAVAILABLE)
  })

  it('throws EXPLICIT_PROVIDER_UNAVAILABLE for an explicit unknown/"none" provider', async () => {
    const report = makeReport({})
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      { detect: async () => report, llm: makeLlm({ registered: [] }) },
    )

    const error = await router.resolve({ provider: 'none' }).catch((e) => e)
    expect((error as LlmError).code).toBe(EXPLICIT_PROVIDER_UNAVAILABLE)
  })

  it('throws NO_ADAPTER when auto finds no provider at all', async () => {
    const report = makeReport({ deepseek: { available: false }, ollama: { available: false } })
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      { detect: async () => report, llm: makeLlm({ registered: [] }) },
    )

    await expect(router.resolve({})).rejects.toMatchObject({ code: 'NO_ADAPTER' })
  })
})

describe('LlmRouter — explicit model and model selection', () => {
  it('respects an explicitly requested model', async () => {
    const report = makeReport({ deepseek: { available: true, models: ['deepseek-v4-flash'] } })
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      {
        detect: async () => report,
        llm: makeLlm({ registered: ['deepseek'], models: { deepseek: ['deepseek-v4-flash'] } }),
      },
    )

    const resolved = await router.resolve({ provider: 'deepseek', model: 'my-custom-model' })
    expect(resolved.model).toBe('my-custom-model')
  })

  it('uses the catalog default cloud model when present in the list', async () => {
    const report = makeReport({ deepseek: { available: true, models: ['other-model'] } })
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      { defaultCloudModel: 'deepseek-v4-flash' },
      {
        detect: async () => report,
        llm: makeLlm({ registered: ['deepseek'], models: { deepseek: ['other-model', 'deepseek-v4-flash'] } }),
      },
    )

    const resolved = await router.resolve({})
    expect(resolved.model).toBe('deepseek-v4-flash')
  })

  it('falls back to the first catalog model when the default is absent', async () => {
    const report = makeReport({ deepseek: { available: true, models: [] } })
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      { defaultCloudModel: 'deepseek-v4-flash' },
      {
        detect: async () => report,
        llm: makeLlm({ registered: ['deepseek'], models: { deepseek: ['available-model'] } }),
      },
    )

    const resolved = await router.resolve({})
    expect(resolved.model).toBe('available-model')
  })

  it('returns empty model when the cloud catalog is empty', async () => {
    const report = makeReport({ deepseek: { available: true, models: [] } })
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      { detect: async () => report, llm: makeLlm({ registered: ['deepseek'], models: { deepseek: [] } }) },
    )

    const resolved = await router.resolve({})
    expect(resolved.model).toBe('')
  })

  it('prefers the first installed local model when capability lists models', async () => {
    const report = makeReport({
      deepseek: { available: false },
      ollama: { available: true, models: ['llama3', 'mistral'] },
    })
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      {
        detect: async () => report,
        llm: makeLlm({ registered: ['ollama'], models: { ollama: ['llama3', 'mistral'] } }),
      },
    )

    const resolved = await router.resolve({})
    expect(resolved.model).toBe('llama3')
  })

  it('falls back to the catalog when the local capability lists no models', async () => {
    const report = makeReport({
      deepseek: { available: false },
      ollama: { available: true, models: [] },
    })
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      {
        detect: async () => report,
        llm: makeLlm({ registered: ['ollama'], models: { ollama: ['installed-x'] } }),
      },
    )

    const resolved = await router.resolve({})
    expect(resolved.model).toBe('installed-x')
  })
})

describe('LlmRouter — prepareCall with auto runtime failover', () => {
  it('delegates to ctx.llm.prepareCall for a normal cloud call', async () => {
    const report = makeReport({ deepseek: { available: true, models: ['deepseek-v4-flash'] } })
    const llm = makeLlm({ registered: ['deepseek'], models: { deepseek: ['deepseek-v4-flash'] } })
    const ctx = new Context()
    const router = new LlmRouter(ctx, {}, { detect: async () => report, llm })

    const result = await router.prepareCall({})

    expect(result.config.provider).toBe('deepseek')
    expect(llm.prepareCall).toHaveBeenCalledTimes(1)
    expect(llm.prepareCall).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'deepseek', model: 'deepseek-v4-flash' }),
      undefined,
    )
  })

  it('falls back cloud -> local at prepareCall time on an allowed error code', async () => {
    const report = makeReport({
      deepseek: { available: true, models: ['deepseek-v4-flash'] },
      ollama: { available: true, models: ['llama3'] },
    })
    const llm = makeLlm({
      registered: ['deepseek', 'ollama'],
      models: { deepseek: ['deepseek-v4-flash'], ollama: ['llama3'] },
      failMap: { deepseek: new LlmError('down', 'NO_ADAPTER') },
    })
    const ctx = new Context()
    const router = new LlmRouter(ctx, {}, { detect: async () => report, llm })

    const result = await router.prepareCall({})

    expect(result.config.provider).toBe('ollama')
    expect(llm.prepareCall).toHaveBeenCalledTimes(2)
  })

  it('does NOT fall back on AUTH / INVALID_CREDENTIAL in auto mode', async () => {
    const report = makeReport({ deepseek: { available: true, models: ['deepseek-v4-flash'] } })
    const llm = makeLlm({
      registered: ['deepseek', 'ollama'],
      models: { deepseek: ['deepseek-v4-flash'], ollama: ['llama3'] },
      failMap: { deepseek: new LlmError('bad key', 'INVALID_CREDENTIAL') },
    })
    const ctx = new Context()
    const router = new LlmRouter(ctx, {}, { detect: async () => report, llm })

    await expect(router.prepareCall({})).rejects.toMatchObject({ code: 'INVALID_CREDENTIAL' })
  })

  it('does NOT fall back for a non-LlmError throw', async () => {
    const report = makeReport({ deepseek: { available: true, models: ['deepseek-v4-flash'] } })
    const llm = makeLlm({
      registered: ['deepseek', 'ollama'],
      models: { deepseek: ['deepseek-v4-flash'], ollama: ['llama3'] },
      failMap: { deepseek: new Error('boom') },
    })
    const ctx = new Context()
    const router = new LlmRouter(ctx, {}, { detect: async () => report, llm })

    await expect(router.prepareCall({})).rejects.toThrow('boom')
  })

  it('throws the last allowed error when the final tier also fails', async () => {
    const report = makeReport({
      deepseek: { available: false },
      ollama: { available: true, models: ['llama3'] },
    })
    const llm = makeLlm({
      registered: ['ollama'],
      models: { ollama: ['llama3'] },
      failMap: { ollama: new LlmError('down', 'TRANSPORT') },
    })
    const ctx = new Context()
    const router = new LlmRouter(ctx, {}, { detect: async () => report, llm })

    await expect(router.prepareCall({})).rejects.toMatchObject({ code: 'TRANSPORT' })
  })

  it('never falls back for an explicit provider failure (rethrows original)', async () => {
    const report = makeReport({ deepseek: { available: true, models: ['deepseek-v4-flash'] } })
    const llm = makeLlm({
      registered: ['deepseek'],
      models: { deepseek: ['deepseek-v4-flash'] },
      failMap: { deepseek: new LlmError('denied', 'AUTH') },
    })
    const ctx = new Context()
    const router = new LlmRouter(ctx, {}, { detect: async () => report, llm })

    const error = await router.prepareCall({ provider: 'deepseek' }).catch((e) => e)
    expect((error as LlmError).code).toBe('AUTH')
    expect(llm.prepareCall).toHaveBeenCalledTimes(1)
  })

  it('throws EXPLICIT_PROVIDER_UNAVAILABLE when the explicit provider is unavailable (prepareCall)', async () => {
    const report = makeReport({ deepseek: { available: false } })
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      { detect: async () => report, llm: makeLlm({ registered: ['deepseek'] }) },
    )

    const error = await router.prepareCall({ provider: 'deepseek' }).catch((e) => e)
    expect((error as LlmError).code).toBe(EXPLICIT_PROVIDER_UNAVAILABLE)
  })
})

describe('LlmRouter — caching + invalidate', () => {
  it('serves a second resolve from cache without re-detecting', async () => {
    const report = makeReport({ deepseek: { available: true, models: ['deepseek-v4-flash'] } })
    const detect = vi.fn(async () => report)
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      {
        detect,
        llm: makeLlm({ registered: ['deepseek'], models: { deepseek: ['deepseek-v4-flash'] } }),
        now: () => 0,
      },
    )

    await router.resolve({})
    await router.resolve({})

    expect(detect).toHaveBeenCalledTimes(1)
  })

  it('re-detects after invalidate()', async () => {
    const report = makeReport({ deepseek: { available: true, models: ['deepseek-v4-flash'] } })
    const detect = vi.fn(async () => report)
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      {
        detect,
        llm: makeLlm({ registered: ['deepseek'], models: { deepseek: ['deepseek-v4-flash'] } }),
        now: () => 0,
      },
    )

    await router.resolve({})
    router.invalidate()
    await router.resolve({})

    expect(detect).toHaveBeenCalledTimes(2)
  })

  it('re-detects when the capability cache TTL elapses', async () => {
    const report = makeReport({ deepseek: { available: true, models: ['deepseek-v4-flash'] } })
    const detect = vi.fn(async () => report)
    let now = 0
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      { capabilityCacheTtlMs: 1000, resolveCacheTtlMs: 1000 },
      {
        detect,
        llm: makeLlm({ registered: ['deepseek'], models: { deepseek: ['deepseek-v4-flash'] } }),
        now: () => now,
      },
    )

    await router.resolve({})
    now = 5000 // past TTL
    await router.resolve({})

    expect(detect).toHaveBeenCalledTimes(2)
  })
})

describe('LlmRouter — pure helpers (via public surface)', () => {
  it('maps an unknown provider string to the none source through resolve', async () => {
    const report = makeReport({})
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      { detect: async () => report, llm: makeLlm({ registered: [] }) },
    )

    const error = await router.resolve({ provider: 'bogus' }).catch((e) => e)
    expect((error as LlmError).code).toBe(EXPLICIT_PROVIDER_UNAVAILABLE)
  })

  it('treats provider "auto" as auto mode', async () => {
    const report = makeReport({
      deepseek: { available: false },
      ollama: { available: true, models: ['llama3'] },
    })
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      {
        detect: async () => report,
        llm: makeLlm({ registered: ['ollama'], models: { ollama: ['llama3'] } }),
      },
    )

    const resolved = await router.resolve({ provider: 'auto' })
    expect(resolved.provider).toBe('ollama')
    expect(resolved.auto).toBe(true)
  })
})

describe('LlmRouter — pure routing helpers', () => {
  it('sourceOf maps known provider ids and falls back to none', () => {
    expect(sourceOf('deepseek')).toBe('deepseek')
    expect(sourceOf('ollama')).toBe('ollama')
    expect(sourceOf('bogus')).toBe('none')
    expect(sourceOf(undefined)).toBe('none')
  })
})

describe('LlmRouter — capability cache (detectWithCache hit)', () => {
  it('reuses a cached detection across a second *different* resolve key', async () => {
    const report = makeReport({ deepseek: { available: true, models: ['deepseek-v4-flash'] } })
    const detect = vi.fn(async () => report)
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      {
        detect,
        llm: makeLlm({ registered: ['deepseek'], models: { deepseek: ['deepseek-v4-flash'] } }),
        now: () => 0,
      },
    )

    await router.resolve({})
    await router.resolve({ model: 'other' }) // different key -> re-runs selection, hits capability cache

    expect(detect).toHaveBeenCalledTimes(1)
  })
})

describe('LlmRouter — prepareCall edge cases', () => {
  it('throws NO_ADAPTER when no real provider is available or registered (auto)', async () => {
    const report = makeReport({ deepseek: { available: false }, ollama: { available: false } })
    const llm = makeLlm({ registered: [] })
    const ctx = new Context()
    const router = new LlmRouter(ctx, {}, { detect: async () => report, llm })

    await expect(router.prepareCall({})).rejects.toMatchObject({ code: 'NO_ADAPTER' })
  })

  it('forwards every optional call-config field to prepareCall', async () => {
    const report = makeReport({ deepseek: { available: true, models: ['deepseek-v4-flash'] } })
    const llm = makeLlm({ registered: ['deepseek'], models: { deepseek: ['deepseek-v4-flash'] } })
    const ctx = new Context()
    const router = new LlmRouter(ctx, {}, { detect: async () => report, llm })
    const request: RouterRequest = {
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      reasoningEffort: ReasoningEffortId('high'),
      temperature: 0.7,
      maxTokens: 256,
      stop: ['\n'],
    }

    await router.prepareCall(request)

    expect(llm.prepareCall).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        reasoningEffort: ReasoningEffortId('high'),
        temperature: 0.7,
        maxTokens: 256,
        stop: ['\n'],
      }),
      undefined,
    )
  })
})

describe('LlmRouter — default internals fallback (constructor)', () => {
  it('falls back to default detect/recommend/llm/now when internals are omitted', () => {
    const ctx = new Context()
    const router = new LlmRouter(ctx, {}, {})
    expect(router).toBeInstanceOf(LlmRouter)
  })
})

describe('LlmRouter — plugin wiring via apply()', () => {
  it('installs the router as ctx.llmRouter and resolves through it', async () => {
    const report = makeReport({ deepseek: { available: true, models: ['deepseek-v4-flash'] } })
    const detect = vi.fn(async () => report)
    const ctx = new Context()
    apply(ctx, {}, {
      detect,
      llm: makeLlm({ registered: ['deepseek'], models: { deepseek: ['deepseek-v4-flash'] } }),
    })

    const resolved = await ctx.llmRouter.resolve({})
    expect(resolved.provider).toBe('deepseek')
    expect(detect).toHaveBeenCalled()
  })

  it('tolerates omitted config and internals arguments (defaults)', () => {
    const ctx = new Context()
    expect(() => apply(ctx)).not.toThrow()
  })
})

describe('LlmRouter — local model selection when catalog is empty', () => {
  it('returns an empty model when the local catalog is also empty', async () => {
    const report = makeReport({
      deepseek: { available: false },
      ollama: { available: true, models: [] },
    })
    const ctx = new Context()
    const router = new LlmRouter(
      ctx,
      {},
      {
        detect: async () => report,
        llm: makeLlm({ registered: ['ollama'], models: { ollama: [] } }),
      },
    )

    const resolved = await router.resolve({})
    expect(resolved.provider).toBe('ollama')
    expect(resolved.model).toBe('')
  })
})
