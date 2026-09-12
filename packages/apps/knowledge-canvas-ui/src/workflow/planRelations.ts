// planRelations — relation planning at the COMPOSITION ROOT (P2-5 route B).
//
// THE PROBLEM IT SOLVES
// The executor plans `knowledge.createEdge` as an INTENT:
//     { strategy: 'nearest-2-by-layout-distance', count: '0..2' }
// That is not data: it carries no endpoints, so `ProposalBuilder` maps it to a
// `relation.create` op whose payload has no `from` / `to` / `kind`, and the
// Applier's Import Rule correctly REJECTS it (an AI-created relation must declare
// `kind: 'ai-auto'`). Result: every run ended `partially_applied` forever.
//
// WHY PLANNING AND NOT EXECUTION (ruling: B belongs in workflow)
//   - Resolving endpoints requires READING existing knowledge.
//   - The executor was ruled to hold no store/knowledge access (hard constraint 1)
//     and must not gain it: that is runtime<->knowledge coupling.
//   - Planning produces DATA for a proposal, not a side effect, so it fits the
//     composition root -- the one place allowed to know both sides.
//
// WHAT IT IS: a pure-ish function of (run, read port). It reads through the
// injected port and RETURNS planning records. It never writes, never applies,
// never mutates the run, and does not import the Applier.
//
// ---------------------------------------------------------------------------
// FROZEN SPEC: nearest-2-by-layout-distance (ruling D6, amended 2026-09-12)
// ---------------------------------------------------------------------------
//   anchor      1. the title carried by the planned node.create payload, matched
//                  against an existing node with the same title (re-import case)
//               2. else the CENTROID of all existing nodes
//   candidates  all existing nodes EXCEPT the anchor itself (the planned node is
//               not in the store yet, so it cannot be a candidate or an anchor;
//               and an anchor cannot relate to itself)
//   selection   the 2 smallest euclidean distances to the anchor; ties broken by
//               nodeId ascending -> fully deterministic
//   output      one relation per selected candidate:
//               from = the planned node id, to = candidate, kind = 'ai-auto',
//               reason = rank + distance (explainable edges, KnowledgeEdge.reason)
//   degrade     no new node / no anchor / no candidate => NO relation at all, and
//               the reason is recorded (visible in the receipt instead of silently
//               producing a broken op)
//
// AMENDMENT (why the original step 1 was dropped): the first draft resolved an
// `input.anchorNodeId` hint, but `AgentRun` -- the RECORD -- carries no `input`
// field; only `AgentRunRequest` does. A completed run therefore cannot recover
// the request hint, and inventing a field for it would touch the frozen contract.
// The two surviving steps are both derivable from the run record alone. The gap
// is recorded in the P2-5 review as a candidate for a future contract evolution,
// NOT patched here.
//
// DETERMINISM: planning records reuse the single identity rule
// (`toolCallId(runId, 1, 'plan-relate', n)`) and take their timestamp from the
// run itself -- never from the wall clock -- so the same run always yields the
// same records, and therefore the same proposal.
//
// Dependency direction: workflow -> agent (identity + contract types) and
// workflow -> knowledge/write (the pre-allocated prefix constants only).
// Forbidden: store, llm, mock, demo, components, react, the Applier.

import type { AgentRun, ToolCall } from '../contracts/agentRun'
import { toolCallId } from '../agent/runSpec'
import { PROPOSED_NODE_PREFIX } from '../knowledge/write/proposalBuilder'
import type { KnowledgeReadPort, KnowledgeReadNode } from './knowledgeReadPort'

/** How many relations one import may plan (mirrors the frozen `count: '0..2'`). */
const MAX_RELATIONS = 2

/** The stage namespace for planning records: distinguishable from executor records. */
const PLAN_STAGE = 'plan-relate'

export type RelationPlanAnchorKind = 'title-match' | 'centroid'

export interface RelationPlanAnchor {
  readonly kind: RelationPlanAnchorKind
  /** Present for 'title-match'. */
  readonly nodeId?: string
  readonly x: number
  readonly y: number
}

export type RelationPlanSkipCode = 'no-new-node' | 'no-anchor'

export interface RelationPlanSkip {
  readonly code: RelationPlanSkipCode
  readonly reason: string
}

export interface PlannedRelation {
  readonly from: string
  readonly to: string
  /** rank 1 = nearest. */
  readonly rank: number
  readonly distance: number
}

export interface RelationPlan {
  readonly spec: 'nearest-2-by-layout-distance'
  /** Planning tool-call records, ready for ProposalBuilder. */
  readonly calls: readonly ToolCall[]
  readonly relations: readonly PlannedRelation[]
  readonly skipped: readonly RelationPlanSkip[]
  /** How the anchor was resolved -- null when it could not be resolved at all. */
  readonly anchor: RelationPlanAnchor | null
  /** Candidate nodes considered (existing knowledge only). */
  readonly considered: number
}

/**
 * Does this run still carry the unresolved edge intent? Only such a run needs
 * planning -- and a run without it must be left completely untouched.
 */
export function hasUnresolvedEdgeIntent(run: AgentRun): boolean {
  return run.toolCalls.some(call => call.name === 'knowledge.createEdge' && !isResolved(call))
}

function isResolved(call: ToolCall): boolean {
  const args = call.args
  if (typeof args !== 'object' || args === null) return false
  const record = args as Record<string, unknown>
  return typeof record.from === 'string' && record.from !== '' &&
    typeof record.to === 'string' && record.to !== '' &&
    typeof record.kind === 'string' && record.kind !== ''
}

function planTs(run: AgentRun): number {
  let max = 0
  for (const call of run.toolCalls) max = Math.max(max, call.ts)
  return max
}

/** The display title carried by a planned node.create payload (may be absent). */
function plannedTitle(newNodes: readonly ToolCall[]): string | undefined {
  for (const call of newNodes) {
    const args = call.args
    if (typeof args !== 'object' || args === null) continue
    const title = (args as Record<string, unknown>).title
    if (typeof title === 'string' && title !== '') return title
  }
  return undefined
}

function centroidOf(nodes: readonly KnowledgeReadNode[]): { x: number; y: number } | null {
  if (nodes.length === 0) return null
  let x = 0
  let y = 0
  for (const node of nodes) {
    x += node.position.x
    y += node.position.y
  }
  return { x: x / nodes.length, y: y / nodes.length }
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Resolve the frozen spec against the current read state.
 *
 * Async because the port is async (a real store read is not instantaneous);
 * everything else about it is deterministic.
 */
export async function planRelations(run: AgentRun, readPort: KnowledgeReadPort): Promise<RelationPlan> {
  const newNodes = run.toolCalls.filter(call => call.name === 'knowledge.createNode')
  const SPEC = 'nearest-2-by-layout-distance' as const

  if (newNodes.length === 0) {
    return {
      spec: SPEC,
      calls: [],
      relations: [],
      anchor: null,
      considered: 0,
      skipped: [{ code: 'no-new-node', reason: 'run planned no node.create, so there is nothing to relate' }],
    }
  }

  const existing = await readPort.listNodes()
  const anchor = resolveAnchor(existing, plannedTitle(newNodes))
  if (anchor === null) {
    return {
      spec: SPEC,
      calls: [],
      relations: [],
      anchor: null,
      considered: 0,
      skipped: [
        {
          code: 'no-anchor',
          reason: 'no anchor resolvable: no matching input anchor, no title match, and no existing node to average',
        },
      ],
    }
  }

  // The anchor itself is never a candidate: a relation from a node to itself is
  // not knowledge, it is a bug (found by the routing probe: the anchor scored
  // distance 0 and took rank 1).
  const candidates = anchor.nodeId === undefined
    ? existing
    : existing.filter(existingNode => existingNode.id !== anchor.nodeId)

  const ranked = candidates
    .map(existingNode => ({ node: existingNode, distance: distance(anchor, existingNode.position) }))
    .sort((a, b) => (a.distance === b.distance ? (a.node.id < b.node.id ? -1 : 1) : a.distance - b.distance))

  // NOTE: an empty store cannot reach here -- it has no centroid, so it already
  // degraded as 'no-anchor' above. No unreachable 'no-candidates' branch is kept.

  const selected = ranked.slice(0, MAX_RELATIONS)
  const ts = planTs(run)
  const calls: ToolCall[] = []
  const relations: PlannedRelation[] = []

  let ordinal = 0
  for (const newNode of newNodes) {
    const from = `${PROPOSED_NODE_PREFIX}${newNode.id}`
    for (const hit of selected) {
      ordinal++
      const rank = relations.filter(r => r.from === from).length + 1
      const rounded = Math.round(hit.distance * 100) / 100
      relations.push({ from, to: hit.node.id, rank, distance: rounded })
      calls.push({
        id: toolCallId(run.runId, 1, PLAN_STAGE, ordinal),
        name: 'knowledge.createEdge',
        args: {
          from,
          to: hit.node.id,
          kind: 'ai-auto',
          reason: `nearest-2-by-layout-distance: rank=${rank} anchor=${anchor.kind} d=${rounded}`,
        },
        status: 'ok',
        // Planning record, never a model call and never a store write.
        result: { simulated: false, plan: true, spec: SPEC, anchorKind: anchor.kind, rank, distance: rounded },
        ts,
      })
    }
  }

  return { spec: SPEC, calls, relations, anchor, considered: ranked.length, skipped: [] }
}

function resolveAnchor(
  existing: readonly KnowledgeReadNode[],
  title: string | undefined,
): RelationPlanAnchor | null {
  if (title !== undefined) {
    const found = existing.find(node => node.title === title)
    if (found !== undefined) {
      return { kind: 'title-match', nodeId: found.id, x: found.position.x, y: found.position.y }
    }
  }
  const centroid = centroidOf(existing)
  if (centroid === null) return null
  return { kind: 'centroid', x: centroid.x, y: centroid.y }
}
