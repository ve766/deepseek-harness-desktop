/**
 * Provider recommendation for the AI Provider Manager.
 *
 * Auto resolution follows the cloud → local → offline fallback chain: prefer the
 * cloud API when credentialed, then a local Ollama server, then declare offline.
 * Explicit selection is returned as-is so the Router can enforce the
 * no-cross-provider-fallback policy (it reports the failure directly rather than
 * silently switching providers).
 * @module @deepseek-ai/dsh-ai-provider-manager/recommend
 */
/**
 * Resolve which provider the Router should use.
 * @param report - the detection outcome.
 * @param mode - `auto` or a concrete provider; defaults to `auto`.
 * @returns the provider the Router should use.
 */
export function recommend(report, mode = 'auto') {
    if (mode !== 'auto')
        return mode;
    if (report.cloud.available)
        return 'deepseek';
    if (report.local.available)
        return 'ollama';
    return 'none';
}
//# sourceMappingURL=recommend.js.map