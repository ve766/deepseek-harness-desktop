// S14 P0 S1 — provider profile configuration for the LLM Provider abstraction.
//
// Scope (approved): this module holds INERT CONFIGURATION DATA ONLY. It creates
// no client, performs no call, and is never imported by the UI. It exists so the
// single LLM seam (`llmContext.ts`) can resolve *which* provider to target
// without any provider semantics leaking to consumers. This mirrors the existing
// `knowledge/backends/lightragConfig.ts` arrangement (config module beside its
// consumer), so the "one seam" rule is preserved: the seam is what CONSUMES the
// LLM, not what stores its configuration.
//
// Resolution precedence (highest → lowest), identical in spirit to LightRAG's:
//   1. runtime profile  — injected by the host at startup (e.g. Electron main)
//   2. build-time env   — Vite `import.meta.env.VITE_KCU_LLM_*` (NON-SECRET ONLY)
//   3. globalThis       — throwaway in-session switch for prototyping
//   4. defaults         — ollama + qwen3:8b (zero-config == S13-A behaviour)
//
// SECURITY (hard rule, S14 DP-IMPL-5 / DP-S0.5-2):
//   A profile NEVER carries an API key. It carries `credentialRef`: the NAME of
//   an environment variable that the Node host resolves at call time.
//   `import.meta.env` values are inlined into the BROWSER BUNDLE, therefore
//   `credentialRef` is deliberately NOT readable from VITE_*. A user who pasted a
//   real key into a VITE_* var would otherwise embed that secret in the bundle.
//   Keys are read from `process.env` only, and only in the Node path.

/** Which provider family a profile targets. */
export type LlmProviderKind = 'deepseek' | 'openai-compatible' | 'ollama'

/**
 * One resolved provider target.
 *
 * `providerRoute` is optional on purpose: the seam must DISCOVER the route id the
 * runtime actually registered (`ctx.llm.listProviders()`) instead of assuming one.
 * It is settable for the case where a route id is known/required, e.g. the
 * `llm-pi-ai` profile key that keeps a future router migration compatible.
 */
export interface LlmProviderProfile {
  providerKind: LlmProviderKind
  /** Runtime route id to target. Omit to let the seam discover it at runtime. */
  providerRoute?: string
  /** NAME of the env var holding the credential — never the secret itself. */
  credentialRef?: string
  /** Endpoint override (openai-compatible / ollama). */
  baseURL?: string
  /** Default model id; falls back to the kind's default when omitted. */
  model?: string
  /** Display-only label; never affects routing. */
  displayName?: string
}

// ---------------------------------------------------------------------------
// Defaults — zero configuration must reproduce S13-A exactly.
// ---------------------------------------------------------------------------

/** Default provider kind when nothing is configured (= S13-A behaviour). */
export const DEFAULT_LLM_PROVIDER_KIND: LlmProviderKind = 'ollama'
/** Default model for the default provider (workspace convention, S13-A). */
export const DEFAULT_LLM_MODEL = 'qwen3:8b'
/** Documented default Ollama endpoint (mirrors dsh-llm-ollama DEFAULT_BASE_URL). */
export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434/v1'
/** Default credential variable name for the DeepSeek family. */
export const DEFAULT_DEEPSEEK_CREDENTIAL_REF = 'DEEPSEEK_API_KEY'
/**
 * Route key reserved for the DeepSeek profile. Kept as the literal `deepseek`
 * deliberately: it matches both the router's recognised provider id and the
 * pi-ai profile-key-as-route-id convention, so a future router restoration needs
 * no renames. Stage 14 itself does NOT use `llm-router` (see the S0 findings).
 */
export const DEEPSEEK_PROVIDER_ROUTE_KEY = 'deepseek'

// ---------------------------------------------------------------------------
// Layer 1 — runtime profile store (set by the host at startup).
// ---------------------------------------------------------------------------

let runtimeProfile: Partial<LlmProviderProfile> | undefined
let runtimeChain: readonly LlmProviderProfile[] | undefined

/** Inject the runtime profile (highest precedence). Safe to call repeatedly. */
export function setLlmProviderProfile(profile: Partial<LlmProviderProfile>): void {
  runtimeProfile = { ...runtimeProfile, ...profile }
}

/**
 * Inject an explicit ordered provider chain (primary first, fallbacks after).
 * Nothing is derived automatically: without this call the chain is exactly one
 * entry, so a cloud provider is never selected implicitly.
 */
export function setLlmProviderChain(chain: readonly LlmProviderProfile[]): void {
  runtimeChain = chain.length > 0 ? [...chain] : undefined
}

/** Clear runtime overrides (tests / host teardown). */
export function clearLlmProviderProfile(): void {
  runtimeProfile = undefined
  runtimeChain = undefined
}

// ---------------------------------------------------------------------------
// Layers 2 & 3 — build-time env (non-secret) and globalThis prototype switch.
// ---------------------------------------------------------------------------

/** Safe `import.meta.env` access so the module also runs under tsx (no Vite). */
function readEnv(name: string): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    return env?.[name]
  } catch {
    return undefined
  }
}

function readGlobal(key: string): unknown {
  try {
    return (globalThis as Record<string, unknown>)[key]
  } catch {
    return undefined
  }
}

/** Narrow an arbitrary value to a known provider kind, else `undefined`. */
function asProviderKind(value: unknown): LlmProviderKind | undefined {
  if (value === 'deepseek' || value === 'openai-compatible' || value === 'ollama') return value
  return undefined
}

/** First defined string of the candidates, or `undefined`. */
function firstString(...candidates: (string | undefined)[]): string | undefined {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate.length > 0) return candidate
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Per-kind defaults
// ---------------------------------------------------------------------------

/**
 * The model to use when a profile names no model.
 *
 * Ollama keeps the workspace default so zero-config stays byte-identical to
 * S13-A. Cloud kinds deliberately return `undefined`: the model id belongs to the
 * provider's own catalog, and naming one here would fabricate a choice the
 * configuration never made.
 */
export function defaultModelForKind(kind: LlmProviderKind): string | undefined {
  return kind === 'ollama' ? DEFAULT_LLM_MODEL : undefined
}

/** The credential variable NAME to use when a profile names none. */
export function defaultCredentialRefForKind(kind: LlmProviderKind): string | undefined {
  if (kind === 'deepseek' || kind === 'openai-compatible') return DEFAULT_DEEPSEEK_CREDENTIAL_REF
  return undefined
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the single primary provider profile.
 *
 * Zero-config result: `{ providerKind: 'ollama', model: 'qwen3:8b',
 * baseURL: DEFAULT_OLLAMA_BASE_URL }` — byte-for-byte the S13-A target. A cloud
 * provider is only ever selected when configuration asks for it explicitly.
 */
export function resolveLlmProviderProfile(): LlmProviderProfile {
  const kind =
    asProviderKind(runtimeProfile?.providerKind) ??
    asProviderKind(readEnv('VITE_KCU_LLM_PROVIDER')) ??
    asProviderKind(readGlobal('__KCU_LLM_PROVIDER')) ??
    DEFAULT_LLM_PROVIDER_KIND

  const profile: LlmProviderProfile = { providerKind: kind }

  // `exactOptionalPropertyTypes` forbids assigning `undefined`, so every optional
  // field is set only when it actually has a value.
  const route = firstString(
    runtimeProfile?.providerRoute,
    typeof readGlobal('__KCU_LLM_PROVIDER_ROUTE') === 'string'
      ? (readGlobal('__KCU_LLM_PROVIDER_ROUTE') as string)
      : undefined,
  )
  if (route !== undefined) profile.providerRoute = route

  const credentialRef = firstString(
    runtimeProfile?.credentialRef,
    typeof readGlobal('__KCU_LLM_CREDENTIAL_REF') === 'string'
      ? (readGlobal('__KCU_LLM_CREDENTIAL_REF') as string)
      : undefined,
    defaultCredentialRefForKind(kind),
  )
  if (credentialRef !== undefined) profile.credentialRef = credentialRef

  const baseURL = firstString(
    runtimeProfile?.baseURL,
    readEnv('VITE_KCU_LLM_BASE_URL'),
    typeof readGlobal('__KCU_LLM_BASE_URL') === 'string'
      ? (readGlobal('__KCU_LLM_BASE_URL') as string)
      : undefined,
    kind === 'ollama' ? DEFAULT_OLLAMA_BASE_URL : undefined,
  )
  if (baseURL !== undefined) profile.baseURL = baseURL

  const model = firstString(
    runtimeProfile?.model,
    readEnv('VITE_KCU_LLM_MODEL'),
    typeof readGlobal('__KCU_LLM_MODEL') === 'string'
      ? (readGlobal('__KCU_LLM_MODEL') as string)
      : undefined,
    defaultModelForKind(kind),
  )
  if (model !== undefined) profile.model = model

  if (runtimeProfile?.displayName !== undefined) profile.displayName = runtimeProfile.displayName

  return profile
}

/**
 * Resolve the ordered candidate chain: primary first, then explicitly configured
 * fallbacks. With no explicit chain this is exactly `[primary]` — the seam never
 * invents a cloud fallback on its own.
 */
export function resolveLlmProviderChain(): readonly LlmProviderProfile[] {
  if (runtimeChain !== undefined) return runtimeChain
  return [resolveLlmProviderProfile()]
}

// ---------------------------------------------------------------------------
// Credential presence (Node only) — a NAME check, never a secret read-out.
// ---------------------------------------------------------------------------

/**
 * Whether the credential named by `ref` is present in the Node environment.
 * Returns `false` in a browser (no Node host), which is the documented
 * degradation contract — this never throws.
 */
export function isCredentialPresent(ref: string | undefined): boolean {
  if (ref === undefined || ref.length === 0) return false
  if (typeof process === 'undefined') return false
  try {
    const env = (process as unknown as { env?: Record<string, string | undefined> }).env
    const value = env?.[ref]
    return value !== undefined && value.trim().length > 0
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Failover policy (data only — the seam applies it)
// ---------------------------------------------------------------------------

/**
 * Error codes that permit falling through to the next chain entry. Infrastructure
 * faults only: a credential/auth failure must surface, never be hidden behind a
 * provider switch (S14 DP-IMPL-6).
 */
export const FAILOVER_ELIGIBLE_CODES = ['NO_ADAPTER', 'TRANSPORT', 'TIMEOUT', 'SERVER', 'QUOTA'] as const

export type FailoverEligibleCode = (typeof FAILOVER_ELIGIBLE_CODES)[number]

/** Whether an error code is allowed to trigger a provider fallback. */
export function isFailoverEligible(code: string | undefined): boolean {
  if (code === undefined) return false
  return (FAILOVER_ELIGIBLE_CODES as readonly string[]).includes(code)
}
