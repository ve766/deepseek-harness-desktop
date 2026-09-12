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
import type { DetectionReport, ProviderSource, RecommendMode } from './types.ts';
/**
 * Resolve which provider the Router should use.
 * @param report - the detection outcome.
 * @param mode - `auto` or a concrete provider; defaults to `auto`.
 * @returns the provider the Router should use.
 */
export declare function recommend(report: DetectionReport, mode?: RecommendMode): ProviderSource;
//# sourceMappingURL=recommend.d.ts.map