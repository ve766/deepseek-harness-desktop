// RunSpec — the SINGLE source of truth for an import run's shape and identity
// (P2-4.5 Step 1: Agent Core stabilization).
//
// WHY THIS FILE EXISTS
// The sync skeleton (`runner.ts`) and the real executor (`executor.ts`) used to
// duplicate three things -- the stage sequence, the insight keys and the planned
// tool calls -- and each kept its OWN `let runCounter = 0` plus its own
// tool-call id rule. Two structural defects followed, both real:
//
//   F-A  run ids collided across entries: both could mint `run-1`.
//   F-B  tool-call ids differed per entry, and ProposalBuilder derives op target
//        ids from them (`proposed-node-${tc.id}`) => a proposal's idempotency key
//        depended on WHICH entry produced the run.
//
// Identity now comes from one factory and the run shape from one spec, so the
// two entries can only differ in HOW a stage is executed, never in WHAT a run is.
//
// IDENTITY RULE (ruling D2)
//   runId       = run-<base36 ms>-<counter>        (one process-wide counter)
//   toolCall.id = tc-<runId>-a<attempt>-<stage>-<n>
// Properties: unique across BOTH entries; unique within a run even when a
// failover attempt repeats a stage; deterministic for a fixed execution path
// (same input + same attempt path => same ids), which is what makes a derived
// proposal reproducible and its idempotency key meaningful.
//
// LIFECYCLE NOTE (ruling D4)
// `AgentRun.cancel()` stays a documented terminal no-op. A returned run is
// already terminal, so cancellation is driven from OUTSIDE by an AbortSignal;
// the recorder holds the record, not the control.
//
// Dependency direction: src/agent/* -> contracts/* + ../types (type only).
// Forbidden here: components, i18n, store, knowledge, llm, mock, demo, react.

import type {
  AgentRun,
  AgentRunRequest,
  RunResult,
  RunTurn,
  ToolCall,
} from '../contracts/agentRun'
import type { AgentId } from '../types'

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

/** The six stages mirrored from `demo/sequencer.ts runImportDemo` (regression baseline). */
export const IMPORT_STAGE_SEQUENCE = [
  'import',
  'analyze',
  'scan',
  'relate',
  'map',
  'done',
] as const

export type ImportStage = (typeof IMPORT_STAGE_SEQUENCE)[number]

/**
 * Insight keys per stage, mirrored 1:1 from the sequencer so the UI text stays
 * identical when the switch happens. Keys only — rendering stays in the UI.
 */
export const IMPORT_STAGE_INSIGHT_KEYS: Record<ImportStage, string> = {
  import: 'insight.seqImport',
  analyze: 'insight.seqAnalyze',
  scan: 'insight.seqScan',
  relate: 'insight.seqNode',
  map: 'insight.seqMap',
  done: 'insight.seqDoneMap',
}

export interface StageSpec {
  readonly stage: ImportStage
  readonly insightKey: string
  /** true = the stage performs a REAL model call through the capability layer. */
  readonly llm: boolean
}

export const STAGE_SPECS: readonly StageSpec[] = IMPORT_STAGE_SEQUENCE.map(stage => ({
  stage,
  insightKey: IMPORT_STAGE_INSIGHT_KEYS[stage],
  llm: stage === 'analyze' || stage === 'scan',
}))

/** Smoke-grade prompts on purpose: 8B decode is minutes-scale on real ones. */
export const STAGE_PROMPTS: Partial<Record<ImportStage, string>> = {
  analyze: "Stage 'analyze'. Reply with exactly one short sentence confirming analysis readiness.",
  scan: "Stage 'scan'. Reply with exactly one short sentence confirming scan readiness.",
}

export function stagePrompt(stage: ImportStage): string {
  return STAGE_PROMPTS[stage] ?? `Stage '${stage}'. Reply with one short sentence.`
}

// ---------------------------------------------------------------------------
// Planned tool calls — the ONLY place that knows their shape
// ---------------------------------------------------------------------------

export interface PlannedToolCall {
  readonly name: string
  readonly args: unknown
  readonly result: unknown
}

/**
 * Tool-call names that become a proposal op. This deliberately MIRRORS the
 * frozen op mapping in `knowledge/write/proposalBuilder.ts`
 * (createNode -> node.create, createEdge -> relation.create,
 * updateAttribute -> node.update; createCluster is SKIPPED, deriveClusters is a
 * derived operation). It is a copied convention, not a dependency: the agent
 * layer must not import the knowledge layer (F12 direction). Keep in sync.
 */
const OP_PRODUCING_TOOL_CALLS: ReadonlySet<string> = new Set([
  'knowledge.createNode',
  'knowledge.createEdge',
  'knowledge.updateAttribute',
])

/**
 * The `relate` stage plans the writes it would perform. `title` is optional so
 * the two entries stay behaviourally distinct in exactly the way they were
 * before stabilization (the skeleton reads a display title from input, the real
 * executor plans without one).
 */
export function relateStageCalls(agentId: AgentId, title?: string): readonly PlannedToolCall[] {
  const nodeArgs: Record<string, unknown> = {
    kind: 'document',
    ownerAgent: agentId,
    aiStatus: 'draft',
  }
  if (title !== undefined && title !== '') nodeArgs.title = title

  return [
    { name: 'knowledge.createNode', args: nodeArgs, result: { simulated: true } },
    {
      name: 'knowledge.createEdge',
      // The sequencer links the new node to its 2 nearest by layout distance,
      // which requires a store read — deferred to the Proposal stage.
      args: { strategy: 'nearest-2-by-layout-distance', count: '0..2' },
      result: { simulated: true },
    },
    {
      name: 'knowledge.createCluster',
      args: { label: 'cluster.aiTitle', marker: 'ai' },
      result: { simulated: true },
    },
  ]
}

/** Derived operation (ruling Q-G4): never a proposal itself. */
export function doneStageCall(): PlannedToolCall {
  return {
    name: 'knowledge.deriveClusters',
    args: {
      ruling: 'derived operation (Q-G4): never a proposal itself',
      products: 'addCluster proposal',
    },
    result: { simulated: true },
  }
}

/**
 * How many proposal ops these tool calls would produce (ruling D8: DERIVED from
 * the spec, never hardcoded). For a successful import run this is 2 — the
 * createCluster call is skipped by the frozen mapping above, which is precisely
 * why a hardcoded 3 was wrong.
 */
export function plannedProposalOpCount(toolCalls: readonly ToolCall[]): number {
  let count = 0
  for (const call of toolCalls) {
    if (call.status === 'ok' && OP_PRODUCING_TOOL_CALLS.has(call.name)) count++
  }
  return count
}

// ---------------------------------------------------------------------------
// Identity (ruling D2) — one factory, used by every entry
// ---------------------------------------------------------------------------

let runCounter = 0

/** Process-wide unique run id. Entries must never build their own counter. */
export function nextRunId(): string {
  return `run-${Date.now().toString(36)}-${++runCounter}`
}

/** Attempt-scoped, stage-scoped tool-call id (see the identity rule above). */
export function toolCallId(runId: string, attempt: number, stage: string, ordinal: number): string {
  return `tc-${runId}-a${attempt}-${stage}-${ordinal}`
}

// ---------------------------------------------------------------------------
// Run recorder — the run record, not the run control
// ---------------------------------------------------------------------------

export type TerminalStatus = 'completed' | 'failed' | 'cancelled'

export interface PushToolInput {
  readonly name: string
  readonly args: unknown
  readonly stage: ImportStage
  readonly status?: ToolCall['status']
  readonly result?: unknown
  /** Failover attempt number (1 for the first, and always 1 for the skeleton). */
  readonly attempt?: number
}

export interface TerminalExtra {
  readonly error?: { readonly code: string; readonly message: string }
  readonly output?: unknown
}

export interface RunRecorder {
  readonly runId: string
  readonly turns: RunTurn[]
  readonly toolCalls: ToolCall[]
  pushTurn(role: RunTurn['role'], content: unknown): void
  pushTool(input: PushToolInput): ToolCall
  pushPlanned(
    stage: ImportStage,
    calls: readonly PlannedToolCall[],
    attempt?: number,
  ): void
  /** Update the most recent tool call (llm.complete pending -> ok/error). */
  markLastTool(status: ToolCall['status'], result: unknown): void
  terminal(status: TerminalStatus, extra?: TerminalExtra): AgentRun
}

export function createRunRecorder(request: AgentRunRequest, startedAt: number): RunRecorder {
  const runId = nextRunId()
  const turns: RunTurn[] = []
  const toolCalls: ToolCall[] = []
  let turnIndex = 0
  /** Per (attempt, stage) ordinal, so ids never depend on when a stage ran. */
  const stageOrdinals = new Map<string, number>()

  const pushTool = (input: PushToolInput): ToolCall => {
    const attempt = input.attempt ?? 1
    const key = `${attempt}:${input.stage}`
    const ordinal = (stageOrdinals.get(key) ?? 0) + 1
    stageOrdinals.set(key, ordinal)

    const call: ToolCall = {
      id: toolCallId(runId, attempt, input.stage, ordinal),
      name: input.name,
      args: input.args,
      status: input.status ?? 'ok',
      ts: Date.now(),
      ...(input.result !== undefined ? { result: input.result } : {}),
    }
    toolCalls.push(call)
    return call
  }

  return {
    runId,
    turns,
    toolCalls,

    pushTurn(role: RunTurn['role'], content: unknown): void {
      turns.push({ index: turnIndex++, role, content, ts: Date.now() })
    },

    pushTool,

    pushPlanned(stage: ImportStage, calls: readonly PlannedToolCall[], attempt = 1): void {
      for (const call of calls) {
        pushTool({ name: call.name, args: call.args, result: call.result, stage, attempt })
      }
    },

    markLastTool(status: ToolCall['status'], result: unknown): void {
      const last = toolCalls[toolCalls.length - 1]
      if (last !== undefined) toolCalls[toolCalls.length - 1] = { ...last, status, result }
    },

    terminal(status: TerminalStatus, extra?: TerminalExtra): AgentRun {
      const result: RunResult = {
        status,
        usage: { ms: Date.now() - startedAt },
        ...(extra?.error !== undefined ? { error: extra.error } : {}),
        ...(extra?.output !== undefined ? { output: extra.output } : {}),
      }
      return {
        runId,
        agentId: request.agentId,
        status,
        turns,
        toolCalls,
        proposals: [], // proposal ids are filled by the RunOutcome seam (Step 2)
        result,
        cancel() {
          // Documented terminal no-op (ruling D4): a returned run has already
          // terminated, so there is no safe point left to stop at. In-flight
          // cancellation is driven by the external AbortSignal.
        },
      }
    },
  }
}
