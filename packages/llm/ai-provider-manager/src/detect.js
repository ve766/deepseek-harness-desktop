/**
 * Environment detection for the AI Provider Manager.
 *
 * Detection is self-contained: it probes the local Ollama endpoint and checks
 * the DeepSeek credential env var directly, without importing any provider
 * adapter. That keeps the Manager an independent package and means existing
 * adapters need no modification to participate.
 * @module @deepseek-ai/dsh-ai-provider-manager/detect
 */
/** Env var that holds the DeepSeek API key when not overridden. */
export const DEFAULT_DEEPSEEK_API_KEY_ENV = 'DEEPSEEK_API_KEY';
/** Chat base URL probed for Ollama's model list when not overridden. */
export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434/v1';
/** Strip a `/v1` suffix so a chat base URL becomes the Ollama server root. */
function ollamaRootUrl(baseURL) {
    return baseURL.replace(/\/v1\/?$/, '');
}
/**
 * Probe a local Ollama server for reachability and installed models. Never
 * throws — an unreachable or erroring server is a supported "not installed"
 * outcome the caller surfaces without crashing.
 * @param baseURL - the configured chat base URL (its `/v1` suffix is stripped).
 * @param signal - optional caller cancellation.
 * @param fetchImpl - fetch implementation (injected for tests).
 * @returns Ollama capability, always with `available` set.
 */
export async function detectOllama(baseURL, signal, fetchImpl) {
    try {
        const root = ollamaRootUrl(baseURL);
        const response = await fetchImpl(`${root}/api/tags`, { signal: signal ?? null });
        if (!response.ok) {
            return {
                source: 'ollama',
                tier: 'local',
                available: false,
                models: [],
                reason: `Ollama GET /api/tags returned HTTP ${response.status}`,
            };
        }
        const json = await response.json();
        const models = [];
        for (const model of json.models ?? []) {
            if (typeof model.name === 'string' && model.name.length > 0) {
                models.push(model.name);
            }
        }
        return { source: 'ollama', tier: 'local', available: true, models };
    }
    catch (error) {
        return {
            source: 'ollama',
            tier: 'local',
            available: false,
            models: [],
            reason: error instanceof Error ? error.message : 'Ollama probe failed',
        };
    }
}
/**
 * Check whether DeepSeek credentials are present in the environment. This is the
 * Manager's "credential check" for the cloud tier — no network call is made.
 * @param apiKeyEnv - env var name to read the key from.
 * @param env - environment snapshot (injected for tests).
 * @returns DeepSeek capability, always with `available` set.
 */
export function detectDeepSeek(apiKeyEnv, env) {
    const key = env[apiKeyEnv];
    const available = typeof key === 'string' && key.trim().length > 0;
    const capability = {
        source: 'deepseek',
        tier: 'cloud',
        available,
        models: [],
    };
    if (!available)
        capability.reason = `missing ${apiKeyEnv} credential`;
    return capability;
}
/**
 * Detect every known provider against the current environment.
 * @param options - tunables; all optional with safe defaults.
 * @returns the full detection report.
 */
export async function detect(options = {}) {
    const apiKeyEnv = options.deepseekApiKeyEnv ?? DEFAULT_DEEPSEEK_API_KEY_ENV;
    const ollamaBaseUrl = options.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL;
    const fetchImpl = options.fetchImpl ?? fetch;
    const env = options.env ?? process.env;
    const ollama = await detectOllama(ollamaBaseUrl, options.signal, fetchImpl);
    const deepseek = detectDeepSeek(apiKeyEnv, env);
    const none = {
        source: 'none',
        tier: 'offline',
        available: false,
        models: [],
        reason: 'no provider detected in the environment',
    };
    return {
        providers: { deepseek, ollama, none },
        cloud: deepseek,
        local: ollama,
        offline: none,
        anyAvailable: deepseek.available || ollama.available,
    };
}
//# sourceMappingURL=detect.js.map