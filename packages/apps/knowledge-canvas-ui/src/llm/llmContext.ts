// S13-A host seam, extended by S14 P0 S2: read-only LLM wiring for the
// Knowledge OS prototype, now selecting its provider from a profile.
//
// Architectural ruling (S13-A, extended by S14 P0):
//   - The real LLM inference path is the `LlmClient` abstraction. The browser
//     prototype has NO Node runtime, so it uses a documented degradation stub.
//   - The cordis host (LlmRuntime + ONE provider adapter) is RETAINED here but
//     only ACTIVATED in a Node environment (`typeof process !== 'undefined'`).
//   - We do NOT shim `node:module` / `process` into the browser bundle, and we do
//     NOT statically import any `@deepseek-ai/*` Node package at module top level.
//     Every Node-only value is obtained via a Node-gated dynamic `import()` with a
//     string specifier + `@vite-ignore`, so Vite never bundles it and tsc never
//     requires it. The browser prototype can never reach that code path.
//   - The structural types below describe (a subset of) the Node packages' public
//     surface locally, so the Node-only code stays type-checked without importing
//     the packages. No `any` is used.
//
// S14 P0 S2 — provider selection (router-free):
//   - `llm-router` is deliberately NOT part of this host. It is a design-stage /
//     unbuildable package in this repository (see the S0 preflight findings), and
//     Stage 14 must not depend on it. The seam therefore calls
//     `ctx.llm.prepareCall({ provider })` DIRECTLY. Re-introducing the router is
//     explicitly out of scope.
//   - Which provider/route to target comes from `./providerConfig` (inert config):
//     `providerKind`, optional `providerRoute`, `credentialRef`, `baseURL`, `model`.
//   - `ctx.llm.listProviders()` is used for ROUTE DISCOVERY ONLY, so the seam never
//     hardcodes a route id. Discovery is informational + selects among the routes
//     the mounted adapter actually registered.
//   - No credential value is ever read here. A profile carries only the NAME of an
//     environment variable (`credentialRef` -> the adapter's `apiKeyEnv`), which
//     the Node host resolves itself. Nothing secret can reach the browser bundle.
//
// Scope (OA/OB/OC, unchanged):
//   - Read-only inference only. No Agent Runtime / Workflow / Tool.
//   - No write to the knowledge graph.
//   - LLM available != Knowledge connected (MockBackend stays unsupported).
//
// The UI depends ONLY on the `LlmClient` abstraction below — never on cordis,
// dsh-llm, a provider adapter, or the provider profile shape.

import {
  resolveLlmProviderProfile,
  DEFAULT_LLM_PROVIDER_KIND,
  type LlmProviderProfile,
} from './providerConfig'

// ---------------------------------------------------------------------------
// LlmClient abstraction — the ONLY surface the Nox research UI depends on.
// Pure local types; zero dependency on any `@deepseek-ai/*` package.
// ---------------------------------------------------------------------------

/** Default model served by the local Ollama (per workspace convention). */
export const DEFAULT_OLLAMA_MODEL = 'qwen3:8b'
/** Documented default Ollama base URL (mirrors dsh-llm-ollama DEFAULT_BASE_URL). */
export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434/v1'

/** A knowledge node surfaced as retrieval context for the LLM. */
export interface LlmContextNode {
  nodeId: string
  title: string
  snippet: string
  score: number
  reason: string
}

/** A research request to the LLM, optionally grounded in retrieved knowledge. */
export interface LlmResearchRequest {
  query: string
  contextNodes?: LlmContextNode[]
  model?: string
  employeeId?: string
}

/** One streamed chunk of a research answer. */
export interface LlmStreamChunk {
  type: 'text' | 'thinking' | 'error' | 'done'
  text?: string
  error?: string
}

/**
 * The seam the UI consumes. `available` lets the UI proactively show a degraded
 * state; `research()` streams the answer (or an error chunk on failure).
 */
export interface LlmClient {
  readonly available: boolean
  readonly unavailableReason?: string
  research(req: LlmResearchRequest, signal?: AbortSignal): Promise<AsyncIterable<LlmStreamChunk>>
}

/** Carries the reason a stub client is unavailable (for UI messaging). */
export class LlmClientUnavailableError extends Error {
  constructor(
    message: string,
    public readonly reason: string,
  ) {
    super(message)
    this.name = 'LlmClientUnavailableError'
  }
}

/**
 * Why the Node host could not be mounted. Diagnostics only: recording this never
 * changes the fallback decision (a failed load still degrades to the browser
 * stub exactly as before) and never alters the provider chain.
 */
export interface LlmHostLoadFailure {
  /** Human-readable reason, naming the module that failed when one did. */
  message: string
  /** Error code when the underlying failure carried one. */
  code?: string
}

/**
 * Informational provider status. Deliberately holds NO credential material: only
 * the provider kind, the route ids the runtime registered, and the target model.
 */
export interface LlmProviderStatus {
  providerKind: LlmProviderProfile['providerKind']
  /** Route ids discovered from the runtime (`listProviders()`). */
  routeIds: string[]
  /** Route the seam will actually target, when one was resolved. */
  targetRoute?: string
  model?: string
  baseURL?: string
  /** Present only when the Node host failed to mount (so it can be localized). */
  hostLoadFailure?: LlmHostLoadFailure
}

// ---------------------------------------------------------------------------
// Browser degradation stub (the active implementation in this prototype).
// ---------------------------------------------------------------------------

/**
 * Documented degradation: the knowledge app runs as a pure browser prototype with
 * no Node runtime, so real LLM inference is unavailable. The UI shows this state
 * honestly (no fake answers).
 */
export function createBrowserStubClient(): LlmClient {
  return {
    available: false,
    unavailableReason: 'browser-runtime-no-node',
    research() {
      return Promise.resolve(
        errorStream(
          'llm-unavailable',
          'LLM inference requires a Node host. The knowledge app is a browser prototype.',
        ),
      )
    },
  }
}

/** Single-shot error stream used by both the stub and Node error paths. */
function errorStream(error: string, text: string): AsyncIterable<LlmStreamChunk> {
  let emitted = false
  return {
    async *[Symbol.asyncIterator]() {
      await Promise.resolve()
      if (emitted) return
      emitted = true
      yield { type: 'error', error, text }
    },
  }
}

// ---------------------------------------------------------------------------
// Node-only cordis host (RETAINED; activated only under `typeof process`).
// ---------------------------------------------------------------------------

/** Minimal structural host type. Real types come from @deepseek-ai/cordis (Node only). */
interface LlmHost {
  ctx: unknown
  ready: Promise<void>
}

/** Node-only adapter config (structural subset of the real adapter configs). */
export interface OllamaNodeConfig {
  baseURL?: string
  model?: string
  apiKey?: string
  [key: string]: unknown
}

// Structural descriptions of the Node packages' public surface we consume.
// Kept local so the Node-only path stays type-checked without importing them.
interface CordisContext {
  plugin(plugin: unknown, config?: unknown): Promise<unknown>
}
interface CordisModule {
  Context: new () => CordisContext
}
interface LlmModule {
  LlmRuntime: unknown
}
/** A cordis plugin module (adapter): identity + apply, exactly what `plugin()` needs. */
interface AdapterModule {
  name: string
  inject: unknown[]
  apply: (ctx: CordisContext, config: unknown) => unknown
}
/** One registered provider route as reported by the runtime. */
interface LlmProviderInfo {
  id: string
}
interface PreparedCall {
  /** Detached, deep-frozen config resolved together with the adapter registration. */
  config: unknown
  /**
   * Dispatch this call once. The runtime compares the options against the config
   * captured at prepare time and rejects a mismatch with `INVALID_PREPARED_CALL`,
   * so callers must pass back exactly `prepared.config`.
   */
  stream(opts: unknown): AsyncIterable<unknown>
}
/** The LlmRuntime service surface this seam consumes (no router involved). */
interface LlmRuntimeService {
  prepareCall(req: unknown, signal?: AbortSignal): Promise<PreparedCall>
  listProviders(): LlmProviderInfo[]
}

const NODE_PACKAGES = {
  cordis: '@deepseek-ai/cordis',
  dshLlm: '@deepseek-ai/dsh-llm',
  ollama: '@deepseek-ai/dsh-llm-ollama',
  piAi: '@deepseek-ai/dsh-llm-pi-ai',
} as const

/** Host handle returned by {@link loadNodeHost}: ctx + what the runtime registered. */
interface NodeHost extends LlmHost {
  profile: LlmProviderProfile
  routeIds: string[]
}

/**
 * Build the adapter mount plan for a profile.
 *
 * `ollama` uses its native adapter (the zero-config path). The cloud kinds mount
 * `llm-pi-ai`, whose provider key IS the registered route id — naming it
 * `deepseek` keeps a future router migration compatible without any rename here.
 */
function mountPlanFor(profile: LlmProviderProfile): { spec: string; config: unknown } {
  if (profile.providerKind === 'ollama') {
    return {
      spec: NODE_PACKAGES.ollama,
      config: { baseURL: profile.baseURL ?? DEFAULT_OLLAMA_BASE_URL },
    }
  }
  const routeKey = profile.providerRoute ?? 'deepseek'
  const providerProfile: Record<string, unknown> = {}
  // Only the NAME of the credential variable is forwarded — never a secret.
  if (profile.credentialRef !== undefined) providerProfile.apiKeyEnv = profile.credentialRef
  if (profile.baseURL !== undefined) providerProfile.baseURL = profile.baseURL
  if (profile.displayName !== undefined) providerProfile.displayName = profile.displayName
  return { spec: NODE_PACKAGES.piAi, config: { providers: { [routeKey]: providerProfile } } }
}

/**
 * Import one Node-only host module, rethrowing with the package specifier named.
 *
 * S3-A diagnostics: without this, a failed dynamic import surfaces as a bare
 * "Cannot find module" against an anonymous call site, so a load failure could
 * not be attributed to a specific package. The specifier stays a non-literal
 * parameter so Vite never bundles it.
 */
async function importNodeModule(spec: string): Promise<unknown> {
  try {
    return await import(/* @vite-ignore */ spec)
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    throw new Error(`cannot load Node host module "${spec}": ${detail}`)
  }
}

/** Normalize any thrown value into the recorded load-failure shape. */
function describeLoadFailure(e: unknown): LlmHostLoadFailure {
  const message = e instanceof Error ? e.message : String(e)
  const code = (e as { code?: unknown } | null)?.code
  return typeof code === 'string' && code.length > 0 ? { message, code } : { message }
}

/**
 * Mount the read-only LLM host in a Node environment for one provider profile.
 *
 * Never called in the browser: the dynamic imports below use a non-literal string
 * specifier + `@vite-ignore`, so Vite leaves them as runtime imports (never
 * bundled) and tsc types them as `unknown` (never required). At runtime this
 * executes only under a Node host where the packages are installed. The browser
 * short-circuits on the `process` gate in `getLlmClient` before reaching here.
 */
async function loadNodeHost(profile: LlmProviderProfile): Promise<NodeHost> {
  const cordis = (await importNodeModule(NODE_PACKAGES.cordis)) as CordisModule
  const dshLlm = (await importNodeModule(NODE_PACKAGES.dshLlm)) as LlmModule

  const plan = mountPlanFor(profile)
  const adapter = (await importNodeModule(plan.spec)) as AdapterModule

  const ctx = new cordis.Context()
  await ctx.plugin(dshLlm.LlmRuntime)
  await ctx.plugin({ name: adapter.name, inject: adapter.inject, apply: adapter.apply }, plan.config)

  // Route discovery only — the seam must not hardcode a provider route id.
  const routeIds = discoverRouteIds(ctx)
  return { ctx, ready: Promise.resolve(), profile, routeIds }
}

/** Read the route ids the runtime registered; never throws (discovery is optional). */
function discoverRouteIds(ctx: CordisContext): string[] {
  try {
    const svc = ctx as unknown as { llm?: LlmRuntimeService }
    const providers = svc.llm?.listProviders() ?? []
    return providers.map(p => p.id).filter(id => id.length > 0)
  } catch {
    return []
  }
}

/**
 * Pick the route to target: an explicit `providerRoute` wins, otherwise the first
 * route the runtime actually registered. Returns `undefined` when nothing was
 * discovered, which the caller reports as a clear error instead of guessing.
 */
function resolveTargetRoute(host: NodeHost): string | undefined {
  if (host.profile.providerRoute !== undefined && host.profile.providerRoute.length > 0) {
    return host.profile.providerRoute
  }
  return host.routeIds[0]
}

/** Node-backed client. `research()` performs real inference through the host. */
class NodeLlmClient implements LlmClient {
  readonly available = true
  readonly unavailableReason = undefined
  constructor(private readonly host: NodeHost) {}

  async research(req: LlmResearchRequest, signal?: AbortSignal): Promise<AsyncIterable<LlmStreamChunk>> {
    // Fully guarded so any API drift yields a clear error chunk instead of crashing.
    try {
      const route = resolveTargetRoute(this.host)
      if (route === undefined) {
        return errorStream(
          'no-provider-route',
          'No LLM provider route was registered by the mounted adapter.',
        )
      }
      const ctx = this.host.ctx as { llm: LlmRuntimeService }
      const model = req.model ?? this.host.profile.model
      // S3-C: the harness message contract is `content: ContentBlock[]`, not a
      // bare string. A string reaches the adapter's `serializeMessage`, which
      // calls `message.content.filter(...)` and throws a TypeError that the
      // adapter's last-resort branch reports as a MISLEADING `TRANSPORT` code
      // (the transport is fine). The text block is the correct shape.
      const messages = [{ role: 'user', content: [{ type: 'text', text: req.query }] }]
      const call: Record<string, unknown> = { provider: route, messages }
      if (model !== undefined) call.model = model
      const prepared = await ctx.llm.prepareCall(call, signal)
      // `stream()` re-checks the request config against the one resolved during
      // prepare, so the prepared config is handed straight back (passing a fresh
      // object such as `{ messages }` fails with INVALID_PREPARED_CALL).
      return mapNodeStream(prepared.stream(prepared.config))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return errorStream('node-inference-failed', msg)
    }
  }
}

/**
 * The adapter stream protocol (`dsh-llm` StreamChunk) as far as this seam reads
 * it: content arrives as `text-delta`/`reasoning-delta`, and the single terminal
 * `finish` carries `reason.kind` — `error`/`aborted` also carry a `failure`.
 * There is NO `type: 'error'` chunk, so a failure that is not read here would be
 * silently reported as success.
 */
interface NodeStreamChunk {
  type?: string
  text?: string
  reason?: { kind?: string; failure?: { message?: string; code?: string } }
}

/**
 * Map the `dsh-llm` adapter stream into the local `LlmStreamChunk` shape.
 *
 * Failures must surface: the runtime normalizes an adapter throw into a terminal
 * `finish` with `reason.kind === 'error'`, and dropping it would fake a successful
 * empty answer. An `aborted` finish is a caller-side abort, which is deliberately
 * neither an error nor a `done`.
 */
async function* mapNodeStream(stream: AsyncIterable<unknown>): AsyncIterable<LlmStreamChunk> {
  try {
    for await (const chunk of stream) {
      const c = chunk as NodeStreamChunk
      if (c.type === 'text-delta' || c.type === 'text') {
        if (c.text) yield { type: 'text', text: c.text }
        continue
      }
      if (c.type === 'reasoning-delta' || c.type === 'reasoning') {
        if (c.text) yield { type: 'thinking', text: c.text }
        continue
      }
      if (c.type === 'finish') {
        const kind = c.reason?.kind
        if (kind === 'aborted') return
        if (kind === 'error') {
          const failure = c.reason?.failure
          yield {
            type: 'error',
            error: failure?.code ?? 'llm-error',
            text: failure?.message ?? 'LLM adapter failed',
          }
          return
        }
      }
    }
    yield { type: 'done' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    yield { type: 'error', error: 'stream-failed', text: msg }
  }
}

// ---------------------------------------------------------------------------
// Shared client singleton (lazy).
// ---------------------------------------------------------------------------

let _client: LlmClient | null = null
/** The mounted Node host, when one loaded — makes route discovery observable. */
let _host: NodeHost | null = null
/** Why the last host mount failed (diagnostics only; cleared on a successful mount). */
let _loadFailure: LlmHostLoadFailure | undefined

/**
 * Returns the LLM client for the current environment.
 *  - Browser (no `process`): documented degradation stub (available=false).
 *  - Node: real Node-backed client (available=true) for the resolved profile.
 *
 * Zero configuration resolves to the local Ollama target, so the default is
 * unchanged. A cloud provider is only ever mounted when configuration names it —
 * the seam never auto-switches, and never falls back to a cloud provider because
 * a credential is missing.
 */
export async function getLlmClient(): Promise<LlmClient> {
  if (_client) return _client
  if (typeof process !== 'undefined') {
    try {
      const host = await loadNodeHost(resolveLlmProviderProfile())
      _host = host
      _loadFailure = undefined
      _client = new NodeLlmClient(host)
    } catch (e) {
      // Fallback semantics are unchanged: a failed mount still degrades to the
      // browser stub. Only the REASON is now retained for diagnosis.
      _host = null
      _loadFailure = describeLoadFailure(e)
      _client = createBrowserStubClient()
    }
  } else {
    _client = createBrowserStubClient()
  }
  return _client
}

/** Drop the cached client so the next `getLlmClient()` re-resolves the profile. */
export function resetLlmClient(): void {
  _client = null
  _host = null
  _loadFailure = undefined
}

/**
 * Informational provider status (no credentials). `routeIds`/`targetRoute` report
 * what the mounted runtime actually registered, so discovery stays observable;
 * before a host exists they are empty/absent rather than guessed. When the host
 * could not be mounted, `hostLoadFailure` names the reason (and the module).
 */
export function getLlmProviderStatus(): LlmProviderStatus {
  const host = _host
  const profile = host?.profile ?? resolveLlmProviderProfile()
  const status: LlmProviderStatus = {
    providerKind: profile.providerKind,
    routeIds: host?.routeIds ?? [],
  }
  const targetRoute = host === null ? profile.providerRoute : resolveTargetRoute(host)
  if (targetRoute !== undefined) status.targetRoute = targetRoute
  if (profile.model !== undefined) status.model = profile.model
  if (profile.baseURL !== undefined) status.baseURL = profile.baseURL
  if (_loadFailure !== undefined) status.hostLoadFailure = _loadFailure
  return status
}

// --- seam probe (verification only; mirrors knowledgeUniverse window hook) ---
interface LlmHostSeamProbe {
  getLlmClient: typeof getLlmClient
  getLlmProviderStatus: typeof getLlmProviderStatus
  DEFAULT_OLLAMA_MODEL: string
  DEFAULT_LLM_PROVIDER_KIND: typeof DEFAULT_LLM_PROVIDER_KIND
}

declare global {
  interface Window {
    __kcuLlmHost?: LlmHostSeamProbe
  }
}

// Only attach in a DOM/Electron context; never crash SSR, tests, or headless runs.
if (typeof window !== 'undefined') {
  window.__kcuLlmHost = { getLlmClient, getLlmProviderStatus, DEFAULT_OLLAMA_MODEL, DEFAULT_LLM_PROVIDER_KIND }
}
