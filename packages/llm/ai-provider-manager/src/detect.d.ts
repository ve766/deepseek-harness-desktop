/**
 * Environment detection for the AI Provider Manager.
 *
 * Detection is self-contained: it probes the local Ollama endpoint and checks
 * the DeepSeek credential env var directly, without importing any provider
 * adapter. That keeps the Manager an independent package and means existing
 * adapters need no modification to participate.
 * @module @deepseek-ai/dsh-ai-provider-manager/detect
 */
import type { DetectOptions, DetectionReport, ProviderCapability } from './types.ts';
/** Env var that holds the DeepSeek API key when not overridden. */
export declare const DEFAULT_DEEPSEEK_API_KEY_ENV = "DEEPSEEK_API_KEY";
/** Chat base URL probed for Ollama's model list when not overridden. */
export declare const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";
/**
 * Probe a local Ollama server for reachability and installed models. Never
 * throws — an unreachable or erroring server is a supported "not installed"
 * outcome the caller surfaces without crashing.
 * @param baseURL - the configured chat base URL (its `/v1` suffix is stripped).
 * @param signal - optional caller cancellation.
 * @param fetchImpl - fetch implementation (injected for tests).
 * @returns Ollama capability, always with `available` set.
 */
export declare function detectOllama(baseURL: string, signal: AbortSignal | undefined, fetchImpl: typeof fetch): Promise<ProviderCapability>;
/**
 * Check whether DeepSeek credentials are present in the environment. This is the
 * Manager's "credential check" for the cloud tier — no network call is made.
 * @param apiKeyEnv - env var name to read the key from.
 * @param env - environment snapshot (injected for tests).
 * @returns DeepSeek capability, always with `available` set.
 */
export declare function detectDeepSeek(apiKeyEnv: string, env: NodeJS.ProcessEnv): ProviderCapability;
/**
 * Detect every known provider against the current environment.
 * @param options - tunables; all optional with safe defaults.
 * @returns the full detection report.
 */
export declare function detect(options?: DetectOptions): Promise<DetectionReport>;
//# sourceMappingURL=detect.d.ts.map