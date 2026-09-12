// AgentRun skeleton — the import-task run, SIMULATED driver (P2-4.2a, converged
// in P2-4.5 Step 1).
//
// This file is now a thin driver: the stage sequence, insight keys, planned tool
// calls, identity and terminal construction all live in `./runSpec`. The skeleton
// exists as the deterministic TEST DOUBLE of `executeImport` (ruling Q-R5): same
// run shape, no model call, no store access.
//
// SCOPE (unchanged rulings Q-G1..Q-G5, P2-4.2a):
//   - NO real LLM: no callModel, no streamTokens, no provider. Routing is P2-4.3.
//   - NO store access: data-in (AgentRunRequest) / data-out (AgentRun).
//     R-7: state changes only via Event/Proposal -> controlled mutation, so this
//     skeleton only PLANS writes as tool-call records.
//   - NO run.* ActivityEvents: the frozen ActivityKind stays frozen (Q-G1);
//     run state lives in the structured AgentRun.
//   - The demo sequencer is NOT replaced here; it stays the legacy mutation path.
//
// Dependency direction: src/agent/* -> contracts/* + ../types (type only).
// Forbidden here: components, i18n, store, knowledge, llm, mock, demo, react.

import type { AgentRun, AgentRunRequest } from '../contracts/agentRun'
import {
  IMPORT_STAGE_SEQUENCE,
  STAGE_SPECS,
  createRunRecorder,
  doneStageCall,
  plannedProposalOpCount,
  relateStageCalls,
} from './runSpec'

/**
 * Execute the import task as a structured, side-effect-free run.
 *
 * Every stage appends a boundary turn; `relate` and `done` additionally plan the
 * writes they would perform. Everything is derived from `./runSpec`, so this
 * driver and `executeImport` cannot drift apart in run shape.
 */
export function runImportSkeleton(request: AgentRunRequest): AgentRun {
  const startedAt = Date.now()
  const recorder = createRunRecorder(request, startedAt)

  if (request.taskKind !== 'extract') {
    return recorder.terminal('failed', {
      error: {
        code: 'unsupported-task-kind',
        message: `P2-4.2a skeleton supports taskKind 'extract' only; got '${request.taskKind}'.`,
      },
    })
  }

  recorder.pushTurn('system', {
    task: 'extract',
    stages: IMPORT_STAGE_SEQUENCE,
    note: 'skeleton run: no model call, no store write (P2-4.2a)',
  })

  // input is opaque per contract; the skeleton reads at most a display title.
  const input = (request.input ?? {}) as { title?: string }
  const title = typeof input.title === 'string' ? input.title : 'Q3 产品规划.pdf'

  for (const spec of STAGE_SPECS) {
    recorder.pushTurn('assistant', { stage: spec.stage, insightKey: spec.insightKey })
    if (spec.stage === 'relate') {
      recorder.pushPlanned('relate', relateStageCalls(request.agentId, title))
    } else if (spec.stage === 'done') {
      recorder.pushPlanned('done', [doneStageCall()])
    }
  }

  return recorder.terminal('completed', {
    output: {
      stages: IMPORT_STAGE_SEQUENCE,
      // Derived from the spec (ruling D8) — never a hardcoded count.
      plannedProposalOps: plannedProposalOpCount(recorder.toolCalls),
    },
  })
}
