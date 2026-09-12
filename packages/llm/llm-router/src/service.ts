/**
 * LLM Router service — the decision layer between the Agent and the LlmRuntime.
 *
 * Responsibilities (and only these):
 *  - detect the environment via `ai-provider-manager` (zero adapter coupling);
 *  - resolve `auto` to the cloud -> local -> offline chain, or honor an explicit
 *    provider without ever silently switching;
 *  - apply bounded auto failover at prepareCall time for the allowed error codes;
 *  - cache detection + resolution so repeated calls are cheap.
 *
 * It does NOT own adapters, streaming, retries, or credential handling — those
 * remain the LlmRuntime's and the adapters'. See
 * ARCHITECTURE-LLM-ROUTER-IMPLEMENTATION.md.
 * @module @deepseek-ai/dsh-llm-router/service
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { LlmError } from '@deepseek-ai/dsh-llm'
import type {
  LlmCallConfig,
  LlmModelInfo,
  LlmProviderInfo,
  LlmRuntime,
  PreparedLlmCall,
} from '@deepseek-ai/dsh-llm'
import {
  detect as defaultDetect,
  recommend as defaultRecommend,
} from '@deepseek-ai/dsh-ai-provider-manager'
import type {
  DetectionReport,
  DetectOptions,
  ProviderCapability,
  ProviderSource,
  RecommendMode,
} from '@deepseek-ai/dsh-ai-provider-manager'
import {
  EXPLICIT_PROVIDER_UNAVAILABLE,
  SOURCE_TO_PROVIDER,
} from './types.ts'
import type {
  ResolvedCall,
  RouterConfig,
  RouterInternals,
  RouterRequest,
} from './types.ts'
import {
  autoChainFrom,
  isFailoverError,
  resolveMode,
  sourceOf,
} from './resolve.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    llmRouter: LlmRouter
  }
}

interface CapabilityCacheEntry {
  at: number
  report: DetectionReport
}

interface ResolveCacheEntry {
  at: number
  result: ResolvedCall
}

const DEFAULT_CLOUD_MODEL = 'deepseek-v4-flash'

/**
 * Resolves provider/model selection and prepares LLM calls, enforcing the
 * explicit-provider protection and auto fallback policies. Registered on the
 * cordis context as `ctx.llmRouter`.
 */
export class LlmRouter extends Service {
  private readonly capabilityTtl: number
  private readonly resolveTtl: number
  private readonly defaultCloudModel: string
  private readonly detectImpl: (options?: DetectOptions) => Promise<DetectionReport>
  private readonly recommendImpl: (report: DetectionReport, mode?: RecommendMode) => ProviderSource
  private readonly llm: Pick<LlmRuntime, 'listProviders' | 'listModels' | 'prepareCall'>
  private readonly nowImpl: () => number
  private capabilityCache: CapabilityCacheEntry | null = null
  private readonly resolveCache = new Map<string, ResolveCacheEntry>()

  constructor(ctx: Context, config: RouterConfig = {}, internals: RouterInternals = {}) {
    super(ctx, 'llmRouter')
    this.capabilityTtl = config.capabilityCacheTtlMs ?? 60_000
    this.resolveTtl = config.resolveCacheTtlMs ?? 30_000
    this.defaultCloudModel = config.defaultCloudModel ?? DEFAULT_CLOUD_MODEL
    this.detectImpl = internals.detect ?? defaultDetect
    this.recommendImpl = internals.recommend ?? defaultRecommend
    this.llm = internals.llm ?? ctx.llm
    this.nowImpl = internals.now ?? Date.now
  }

  /** Drop all caches so the next resolve re-detects the environment. */
  invalidate(): void {
    this.capabilityCache = null
    this.resolveCache.clear()
  }

  private async detectWithCache(): Promise<DetectionReport> {
    const now = this.nowImpl()
    if (this.capabilityCache !== null && now - this.capabilityCache.at < this.capabilityTtl) {
      return this.capabilityCache.report
    }
    const report = await this.detectImpl()
    this.capabilityCache = { at: now, report }
    return report
  }

  /** Resolve a request to a concrete provider + model (selection-time; no call). */
  async resolve(request: RouterRequest): Promise<ResolvedCall> {
    const key = this.cacheKey(request)
    const now = this.nowImpl()
    const cached = this.resolveCache.get(key)
    if (cached !== undefined && now - cached.at < this.resolveTtl) {
      return cached.result
    }
    const result = await this.resolveUncached(request)
    this.resolveCache.set(key, { at: now, result })
    return result
  }

  private async resolveUncached(request: RouterRequest): Promise<ResolvedCall> {
    const mode = resolveMode(request)
    const report = await this.detectWithCache()
    const candidates = mode === 'explicit'
      ? [sourceOf(request.provider)]
      : autoChainFrom(this.recommendImpl(report, 'auto'))
    for (const source of candidates) {
      if (source === 'none') break
      const providerId = SOURCE_TO_PROVIDER[source]
      const capability = report.providers[source]
      if (!capability.available || !this.isRegistered(providerId)) {
        if (mode === 'explicit') {
          throw new LlmError(
            `requested provider "${request.provider}" is not available`,
            EXPLICIT_PROVIDER_UNAVAILABLE,
          )
        }
        continue
      }
      const model = await this.selectModel(source, providerId, capability, request.model)
      return { provider: providerId, model, source, tier: capability.tier, auto: mode === 'auto' }
    }
    if (mode === 'explicit') {
      throw new LlmError(
        `requested provider "${request.provider}" is not available`,
        EXPLICIT_PROVIDER_UNAVAILABLE,
      )
    }
    throw new LlmError('no usable provider found in the environment', 'NO_ADAPTER')
  }

  /** Resolve and prepare an LLM call, applying auto-mode runtime failover. */
  async prepareCall(request: RouterRequest, signal?: AbortSignal): Promise<PreparedLlmCall> {
    const mode = resolveMode(request)
    const report = await this.detectWithCache()
    const candidates = mode === 'explicit'
      ? [sourceOf(request.provider)]
      : autoChainFrom(this.recommendImpl(report, 'auto'))
    let lastError: unknown
    for (let i = 0; i < candidates.length; i++) {
      const source = candidates[i]!
      if (source === 'none') break
      const providerId = SOURCE_TO_PROVIDER[source]
      const capability = report.providers[source]
      if (!capability.available || !this.isRegistered(providerId)) continue
      const model = await this.selectModel(source, providerId, capability, request.model)
      const isLast = i === candidates.length - 1
      try {
        return await this.llm.prepareCall(this.buildCallConfig(providerId, model, request), signal)
      } catch (error: unknown) {
        if (mode !== 'auto') throw error
        if (!isFailoverError(error) || isLast) throw error
        lastError = error
      }
    }
    if (mode === 'explicit') {
      throw new LlmError(
        `requested provider "${request.provider}" is not available`,
        EXPLICIT_PROVIDER_UNAVAILABLE,
      )
    }
    // At least one real (non-none) provider was attempted and every attempt
    // failed with an allowed failover code: surface the final tier's error
    // rather than the generic NO_ADAPTER (e.g. cloud+local both TRANSPORT).
    if (lastError !== undefined) throw lastError
    throw new LlmError('no usable provider found in the environment', 'NO_ADAPTER')
  }

  private isRegistered(providerId: string): boolean {
    return this.llm.listProviders().some((provider: LlmProviderInfo) => provider.id === providerId)
  }

  private buildCallConfig(
    provider: string,
    model: string,
    request: RouterRequest,
  ): LlmCallConfig {
    // exactOptionalPropertyTypes: only assign optional fields when present.
    const config: LlmCallConfig = { provider, model }
    if (request.reasoningEffort !== undefined) config.reasoningEffort = request.reasoningEffort
    if (request.temperature !== undefined) config.temperature = request.temperature
    if (request.maxTokens !== undefined) config.maxTokens = request.maxTokens
    if (request.stop !== undefined) config.stop = request.stop
    return config
  }

  private async selectModel(
    source: Exclude<ProviderSource, 'none'>,
    providerId: string,
    capability: ProviderCapability,
    requestedModel: string | undefined,
  ): Promise<string> {
    if (requestedModel !== undefined) return requestedModel
    if (source === 'deepseek') {
      const models = await this.llm.listModels(providerId)
      if (
        this.defaultCloudModel !== undefined
        && models.some((model: LlmModelInfo) => model.id === this.defaultCloudModel)
      ) {
        return this.defaultCloudModel
      }
      return models[0]?.id ?? ''
    }
    // source === 'ollama': prefer the first installed model, else the catalog.
    const installed = capability.models[0]
    if (installed !== undefined) return installed
    const models = await this.llm.listModels(providerId)
    return models[0]?.id ?? ''
  }

  private cacheKey(request: RouterRequest): string {
    return `${request.provider ?? 'auto'}|${request.model ?? ''}`
  }
}

export const name = 'llm-router'
export const inject = ['llm']

/**
 * Install the Router as `ctx.llmRouter`. `internals` is a test-only seam; the
 * host passes only `config`. Router depends on `ctx.llm` (declared via
 * {@link inject}), which the LlmRuntime provides.
 *
 * The Service is instantiated on the received `ctx` (the context the host
 * applied this plugin to) so the resulting `ctx.llmRouter` is reachable from
 * that context and its ancestors — a nested `ctx.plugin` fork would register it
 * on an inner scope and leave it unreachable.
 */
export function apply(ctx: Context, config: RouterConfig = {}, internals: RouterInternals = {}): void {
  new LlmRouter(ctx, config, internals)
}
