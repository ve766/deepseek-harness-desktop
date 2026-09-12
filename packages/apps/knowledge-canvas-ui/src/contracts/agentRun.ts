// P2-2.1 contract — Agent Run
//
// Part of the system ABI layer: type-level declarations only. No runtime imports,
// no values, no side effects, no implementation.
//
// Scope: the single-Agent, single-Run lifecycle
//   Agent -> Run -> Turn -> ToolCall -> Result
// Deliberately NOT included (P2-4 / P3): handoff, multi-agent orchestration,
// LangGraph-style graphs, approval workflow, reviewer state machine, permission
// model, undo storage. Proposal / Reviewer / Applier types are scheduled for P2-2.3.
//
// Privacy note: `local-only` is a product constraint, not a user setting. It is
// enforced in Agent Core's routing layer and re-checked by the Applier later.

import type { AgentId } from '../types'

export type TaskKind = 'extract' | 'classify' | 'plan' | 'qa' | 'summarize'

export type RunStatus =
  | 'pending'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type RunTurnRole = 'user' | 'assistant' | 'tool' | 'system'

export type ToolCallStatus = 'pending' | 'ok' | 'error'

/** `local-only` is the default; `any` is never a user-facing option. */
export type Privacy = 'local-only' | 'any'

/** Capability-based routing input — not a hard-coded model mapping. */
export interface RouteNeeds {
  readonly structuredJson?: boolean
  readonly longContext?: boolean
  readonly costTier?: 'cheap' | 'balanced' | 'best'
  readonly latencyTier?: 'fast' | 'normal'
}

export interface Agent {
  readonly id: AgentId
  readonly taskKinds: readonly TaskKind[]
}

export interface RunTurn {
  readonly index: number
  readonly role: RunTurnRole
  readonly content: unknown
  readonly ts: number
}

export interface ToolCall {
  readonly id: string
  readonly name: string
  readonly args: unknown
  readonly status: ToolCallStatus
  readonly result?: unknown
  readonly ts: number
}

export interface RunResult {
  readonly status: Exclude<RunStatus, 'pending' | 'running'>
  readonly output?: unknown
  readonly error?: { readonly code: string; readonly message: string }
  readonly usage?: { readonly inputTokens?: number; readonly outputTokens?: number; readonly ms: number }
}

export interface AgentRunRequest {
  readonly agentId: AgentId
  readonly taskKind: TaskKind
  readonly input: unknown
  readonly needs?: RouteNeeds
  /** Defaults to 'local-only'. Not a user setting. */
  readonly privacy?: Privacy
  readonly maxTurns?: number
}

export interface AgentRun {
  readonly runId: string
  readonly agentId: AgentId
  readonly status: RunStatus
  readonly turns: readonly RunTurn[]
  readonly toolCalls: readonly ToolCall[]
  /** KnowledgeWriteProposal ids — a run never writes directly. */
  readonly proposals: readonly string[]
  readonly result?: RunResult
  /** Cooperative cancellation: stop at the next safe point and emit an event. */
  cancel(): void
}
