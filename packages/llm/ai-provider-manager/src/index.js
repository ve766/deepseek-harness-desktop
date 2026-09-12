/**
 * AI Provider Manager: environment-driven provider detection and recommendation
 * for the DeepSeek Harness LLM seam.
 *
 * Independent of any provider adapter — adding a provider needs no change to
 * existing adapter packages. The Router (Phase B) consumes {@link detect} and
 * {@link recommend} to resolve `auto` and to protect explicit provider choice.
 * @module @deepseek-ai/dsh-ai-provider-manager
 */
export { DEFAULT_DEEPSEEK_API_KEY_ENV, DEFAULT_OLLAMA_BASE_URL, detect, detectDeepSeek, detectOllama, } from "./detect.js";
export { recommend } from "./recommend.js";
//# sourceMappingURL=index.js.map