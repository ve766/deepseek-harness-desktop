// Local-only failover guard — P2-4.3.2.
//
// The failure mode this module exists for (ruling Q-R3): a local provider fails
// at runtime and the caller walks down the candidate list into a cloud endpoint.
// That walk IS the leak. Therefore every failover candidate is RE-VERIFIED here
// against the endpoint facts — the `local` flag computed at decision time is
// deliberately ignored, because a stale or crafted flag must not vouch for a
// candidate.
//
// Scope: pure re-guard of candidate lists. There is no failover LOOP here (that
// arrives with the real executor in P2-4.3.3) and no retry policy — callers that
// walk candidates MUST consume this function between attempts, and under
// local-only an empty `allowed` means the run fails (no-local-provider) with the
// decision left to a human (ruling Q-R4).
//
// Dependency direction: src/llm/localGuard.ts -> ./routing (same layer) +
// ../contracts/agentRun (type only). Forbidden: store, knowledge, mock, demo,
// components, react, agent/.

import type { Privacy } from '../contracts/agentRun'
import { isLocalEndpoint, type ProviderCandidate, type RejectionCode } from './routing'

/** The privacy posture a failover walk must respect. */
export interface PrivacyContext {
  readonly privacy: Privacy
}

export interface GuardRejection {
  readonly candidate: ProviderCandidate
  readonly code: RejectionCode
  readonly reason: string
}

export interface FailoverGuardResult {
  readonly allowed: readonly ProviderCandidate[]
  readonly rejected: readonly GuardRejection[]
}

/**
 * Re-guard every failover candidate individually (ruling Q-R3: "每一个候选重新
 * 验证"). The cached `candidate.local` flag is IGNORED — localness is recomputed
 * from the profile's endpoint so that a stale or crafted flag cannot vouch for a
 * candidate. Under local-only, a candidate whose endpoint is not loopback is
 * rejected with privacy-local-only, whatever the earlier decision said.
 */
export function filterFailoverCandidates(
  candidates: readonly ProviderCandidate[],
  ctx: PrivacyContext,
): FailoverGuardResult {
  const allowed: ProviderCandidate[] = []
  const rejected: GuardRejection[] = []

  for (const candidate of candidates) {
    // Re-verify from facts; the cached flag is deliberately not trusted.
    const local = isLocalEndpoint(candidate.profile)
    if (ctx.privacy === 'local-only' && !local) {
      rejected.push({
        candidate,
        code: 'privacy-local-only',
        reason: `re-guard: endpoint '${candidate.profile.baseURL ?? '(kind default)'}' is not loopback under local-only`,
      })
      continue
    }
    // Refresh with the re-verified value — downstream sees facts, not history.
    allowed.push({ ...candidate, local })
  }

  return { allowed, rejected }
}

/**
 * Convenience for the single-question case ("may the NEXT failover candidate be
 * tried?"). Same facts, same rules as filterFailoverCandidates.
 */
export function mayAttemptFailover(
  candidate: ProviderCandidate,
  ctx: PrivacyContext,
): boolean {
  return filterFailoverCandidates([candidate], ctx).allowed.length === 1
}
