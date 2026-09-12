// Runtime configuration seam for the LightRAG HTTP client (Stage 8, D2).
//
// Resolution precedence (highest → lowest):
//   1. runtime config   — injected at runtime by the host (e.g. Electron main)
//   2. .env / local     — Vite `import.meta.env.VITE_*` (build-time injected)
//   3. globalThis        — temporary in-session switch for prototyping
//
// We deliberately do NOT hardcode a base URL at build time. The same bundle can
// target desktop / local / remote deployments by swapping the runtime config —
// no rebuild required. The globalThis layer exists only as a throwaway dev hook.

export interface LightRAGHttpConfig {
  baseURL: string
  apiKey?: string
}

// --- runtime override store (set by host at startup) ---
let runtimeConfig: Partial<LightRAGHttpConfig> = {}

/** Inject runtime config (highest precedence, D2). Safe to call multiple times. */
export function setLightRAGRuntimeConfig(cfg: Partial<LightRAGHttpConfig>): void {
  runtimeConfig = { ...runtimeConfig, ...cfg }
}

// --- feature-flag store (runtime override layer) ---
const runtimeFlags = new Map<string, boolean>()

/** Set a runtime feature flag (highest precedence, D2). */
export function setRuntimeFlag(name: string, value: boolean): void {
  runtimeFlags.set(name, value)
}

// Safe `import.meta.env` access so this module also runs under tsx (no Vite).
function readEnv(name: string): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> | undefined }).env
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

/** Resolve the LightRAG HTTP config. Returns `null` when nothing is configured
 *  (caller should fall back to MockBackend, R7). */
export function resolveLightRAGConfig(): LightRAGHttpConfig | null {
  const baseURL =
    runtimeConfig.baseURL ??
    readEnv('VITE_LIGHTRAG_BASE_URL') ??
    (readGlobal('__KCU_LIGHTRAG_BASE_URL') as string | undefined) ??
    undefined

  if (!baseURL) return null

  const apiKey =
    runtimeConfig.apiKey ??
    readEnv('VITE_LIGHTRAG_API_KEY') ??
    (readGlobal('__KCU_LIGHTRAG_API_KEY') as string | undefined) ??
    undefined

  return { baseURL, apiKey }
}

/**
 * Resolve a boolean feature flag with the same precedence as the HTTP config:
 * runtime flag > VITE_* env ("true") > globalThis switch > default.
 */
export function resolveFeatureFlag(name: string, envName: string, fallback = false): boolean {
  if (runtimeFlags.has(name)) return runtimeFlags.get(name) as boolean
  const env = readEnv(envName)
  if (env !== undefined) return env === 'true'
  const g = readGlobal(`__KCU_${name}`)
  if (g !== undefined) return g === true
  return fallback
}

/** Whether the Scrapling URL-ingestion component is enabled (default OFF). */
export function isScrapingEnabled(): boolean {
  return resolveFeatureFlag('ENABLE_SCRAPING', 'VITE_KCU_ENABLE_SCRAPING', false)
}
