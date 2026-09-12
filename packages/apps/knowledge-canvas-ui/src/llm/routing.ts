// Provider routing — the decision layer of the agent execution path (P2-4.3.1).
//
// Pure decision only: TaskRequirement -> ProviderCandidate -> ProviderDecision.
// No I/O, no model calls, no event emission (run.* kinds are not in the frozen
// ActivityKind; see STAGE14_ACTIVITY_RUN_EVOLUTION_PROPOSAL.md).
//
// LOCAL-ONLY IS A PRODUCT RED LINE (ruling Q-D), and a declared kind is NOT a
// fact: LlmProviderProfile.baseURL is a free-override field, so
// { providerKind: 'ollama', baseURL: 'https://api.example.com' } is perfectly
// legal today. Localness is therefore verified against the ENDPOINT using a
// WHATWG URL parse and an EXACT hostname whitelist — never substring or prefix
// checks (ruling Q-R2: `hostname.includes('localhost')` and
// `url.startsWith('http://127')` are both wrong). LAN Ollama (192.168.x.x) is a
// future PRODUCT rule and is deliberately absent here.
//
// Dependency direction: src/llm/routing.ts -> ./providerConfig (same layer,
// runtime) + ../contracts/agentRun (type only). Forbidden: store, knowledge,
// mock, demo, components, react, agent/.

import type { Privacy, RouteNeeds, TaskKind } from '../contracts/agentRun'
import {
  DEFAULT_OLLAMA_BASE_URL,
  isCredentialPresent,
  resolveLlmProviderChain,
  type LlmProviderProfile,
} from './providerConfig'

/** Normalised input to the decision. Built from an AgentRunRequest by the caller. */
export interface TaskRequirement {
  readonly taskKind: TaskKind
  readonly needs: RouteNeeds
  readonly privacy: Privacy
}

export interface ProviderCandidate {
  readonly profile: LlmProviderProfile
  /** Endpoint-verified localness — NEVER derived from providerKind alone. */
  readonly local: boolean
  readonly credentialReady: boolean
}

export type RejectionCode =
  | 'privacy-local-only' // cloud endpoint under the local-only red line
  | 'capability' // measured model/task mismatch (P1-4A evidence)
  | 'no-credential' // credentialRef named but absent

export interface ProviderRejection {
  readonly profile: LlmProviderProfile
  readonly code: RejectionCode
  readonly reason: string
}

export interface ProviderDecision {
  readonly chosen?: LlmProviderProfile
  readonly rejected: readonly ProviderRejection[]
  readonly decision: 'routed' | 'no-provider'
}

/**
 * Exact hostname whitelist for "local" (ruling Q-R2). Extend only through a
 * product rule — a LAN Ollama must NOT slip in via a code tweak here.
 */
const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '::1'])

/**
 * Endpoint-verified localness. Kind gates first (deepseek / openai-compatible
 * are cloud by definition), then the endpoint is parsed and the hostname is
 * exact-matched against the whitelist. Unparseable => not local.
 */
export function isLocalEndpoint(profile: LlmProviderProfile): boolean {
  if (profile.providerKind !== 'ollama') return false
  let url: URL
  try {
    url = new URL(profile.baseURL ?? DEFAULT_OLLAMA_BASE_URL)
  } catch {
    return false
  }
  // WHATWG URL brackets IPv6 hostnames ('[::1]'); strip to compare.
  const host = url.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  return LOCAL_HOSTNAMES.has(host)
}

/**
 * Capability gate, evidence-based only (no invented capability metadata):
 * P1-4A measured that qwen3:4b violates the extraction output contract in text
 * mode (relation tuples emitted as entities). Model-level, therefore checked
 * against the resolved model id, not the provider kind.
 */
function capabilityRejection(req: TaskRequirement, profile: LlmProviderProfile): string | null {
  if (req.taskKind === 'extract' && profile.model === 'qwen3:4b') {
    return 'qwen3:4b violates the extraction output contract (P1-4A: relation tuples emitted as entities)'
  }
  return null
}

/**
 * Decide which provider may serve the task. Pure: same input, same decision.
 *
 * Order is not negotiable (P2-4.3 ruling): privacy filter FIRST (candidates that
 * cannot exist are removed before selection — never "selected then rejected"),
 * then capability, then credential presence; cost/latency tiers only order the
 * survivors and the chain's own precedence order is kept (it already encodes the
 * four-layer configuration precedence).
 */
/**
 * Full candidate decision: EVERY candidate that passes the gates, in chain
 * order, plus every rejection with its reason. Added in P2-4.3.3 (additive) so
 * the executor can walk failover candidates through the local guard; the gates
 * and their order are identical to decideProvider (pure decision, no I/O).
 */
export interface ProviderCandidatesDecision {
  readonly allowed: readonly ProviderCandidate[]
  readonly rejected: readonly ProviderRejection[]
}

export function decideProviderCandidates(req: TaskRequirement): ProviderCandidatesDecision {
  const chain = resolveLlmProviderChain()
  const rejected: ProviderRejection[] = []
  const allowed: ProviderCandidate[] = []

  for (const profile of chain) {
    const local = isLocalEndpoint(profile)
    if (req.privacy === 'local-only' && !local) {
      rejected.push({
        profile,
        code: 'privacy-local-only',
        reason: `endpoint '${profile.baseURL ?? '(kind default)'}' is not loopback under local-only`,
      })
      continue
    }
    const cap = capabilityRejection(req, profile)
    if (cap !== null) {
      rejected.push({ profile, code: 'capability', reason: cap })
      continue
    }
    if (profile.credentialRef !== undefined && !isCredentialPresent(profile.credentialRef)) {
      rejected.push({
        profile,
        code: 'no-credential',
        reason: `credential '${profile.credentialRef}' named but absent`,
      })
      continue
    }
    allowed.push({
      profile,
      local,
      credentialReady: profile.credentialRef === undefined || isCredentialPresent(profile.credentialRef),
    })
  }

  return { allowed, rejected }
}

/** First-passing-candidate sugar over decideProviderCandidates (behaviour unchanged). */
export function decideProvider(req: TaskRequirement): ProviderDecision {
  const { allowed, rejected } = decideProviderCandidates(req)
  const first = allowed[0]
  if (first === undefined) {
    // Ruling Q-R4: no-provider under local-only is a RUN FAILURE — the human
    // decides. No cloud fallback, no silent downgrade, no retry elsewhere.
    return { rejected, decision: 'no-provider' }
  }
  return { chosen: first.profile, rejected, decision: 'routed' }
}
