// AgentRun executor — the real execution entry (P2-4.3.3), converged into a
// LIFECYCLE-ONLY driver (P2-4.5 Step 1).
//
// Layer responsibilities (ruling Q2) — no layer may cross:
//   executor   : run lifecycle, turn/toolCall records, stage-boundary cancel,
//                failover discipline (guard between attempts)          <- THIS FILE
//   routing    : who may serve (decideProviderCandidates)
//   localGuard : re-verify every failover candidate (filterFailoverCandidates)
//   capability : the LLM ability abstraction (complete only)
//   adapter    : HTTP protocol
//
// THE EXECUTOR OWNS NO GOVERNANCE (P2-4.5 rulings):
//   - It does NOT import `knowledge/write` and never calls the Applier.
//   - It does NOT build a KnowledgeWriteProposal; proposal creation and
//     validation belong to the RunOutcome seam (`workflow/finalizeRun`), which is
//     the only composition root allowed to know both sides.
//   - It never mutates the knowledge store (ruling R-7): knowledge writes remain
//     PLANNED tool calls, recorded here and turned into a proposal later.
//   - Run shape, identity and planned tool calls all come from `./runSpec`, so
//     this driver and the skeleton cannot drift apart.
//
// The executor never sees a provider kind, a model id or an endpoint: it holds an
// LlmCapability instance bound by the factory. No ActivityEvents either: run.*
// kinds are not in the frozen ActivityKind (Q-G1/Q6).
//
// Failure semantics (ruling Q-R4): no provider passes the guard, or every
// guard-passed candidate fails -> the run FAILS (no-local-provider) and the human
// decides. Failover never bypasses the guard (Q-R3): after each failed attempt the
// REST of the candidates is re-run through filterFailoverCandidates.
//
// Cancellation (ruling Q4/D4): the external AbortSignal is checked at every stage
// boundary and forwarded into the model call; in-flight abort marks the tool call
// as errored(aborted) and the run returns cancelled at the next boundary. The
// contract's AgentRun.cancel() stays a documented terminal no-op.

import type { AgentRun, AgentRunRequest, ToolCall } from '../contracts/agentRun'
import { STAGE_SPECS, createRunRecorder, doneStageCall, plannedProposalOpCount, relateStageCalls, stagePrompt } from './runSpec'
import { decideProviderCandidates, type TaskRequirement } from '../llm/routing'
import { filterFailoverCandidates } from '../llm/localGuard'
import { createLlmCapability } from '../llm/capability'

/**
 * Execute the import task against a REAL provider chosen by the routing layer,
 * with the local-only guard re-arming between failover attempts.
 */
export async function executeImport(
  request: AgentRunRequest,
  signal?: AbortSignal,
): Promise<AgentRun> {
  const startedAt = Date.now()
  const recorder = createRunRecorder(request, startedAt)

  recorder.pushTurn('system', {
    task: request.taskKind,
    stages: STAGE_SPECS.map(spec => spec.stage),
    note: 'real execution: LLM calls go through routing -> guard -> capability (P2-4.3.3)',
  })

  if (request.taskKind !== 'extract') {
    return recorder.terminal('failed', {
      error: {
        code: 'unsupported-task-kind',
        message: `P2-4.3.3 supports taskKind 'extract' only; got '${request.taskKind}'.`,
      },
    })
  }

  const privacy = request.privacy ?? 'local-only'
  const requirement: TaskRequirement = {
    taskKind: request.taskKind,
    needs: request.needs ?? {},
    privacy,
  }

  const decision = decideProviderCandidates(requirement)
  if (decision.allowed.length === 0) {
    // Ruling Q-R4: fail and let a human decide. No cloud fallback.
    return recorder.terminal('failed', {
      error: {
        code: 'no-local-provider',
        message: 'no provider passed the local-only guard; reasons: ' +
          decision.rejected.map(r => `${r.code}`).join(', '),
      },
    })
  }

  recorder.pushTurn('assistant', {
    decision: 'routed',
    allowedCandidates: decision.allowed.length,
    rejected: decision.rejected.length,
  })

  let candidates = decision.allowed
  const totalCandidates = decision.allowed.length

  // Failover walk: `attempt` always addresses candidates[0]; after a failure the
  // rest is RE-GUARDED and replaces the list, so the walk can only shrink.
  for (;;) {
    if (signal?.aborted) {
      return recorder.terminal('cancelled')
    }
    const candidate = candidates[0]
    if (candidate === undefined) {
      return recorder.terminal('failed', {
        error: { code: 'no-local-provider', message: 'candidate list exhausted' },
      })
    }

    const attempt = totalCandidates - candidates.length + 1
    // The executor binds the capability WITHOUT learning kind/model/endpoint.
    const capability = createLlmCapability(candidate.profile)
    recorder.pushTurn('assistant', {
      attempt,
      note: 'capability bound (provider hidden behind LlmCapability)',
    })

    let attemptFailed = false
    for (const spec of STAGE_SPECS) {
      if (signal?.aborted) {
        return recorder.terminal('cancelled')
      }
      recorder.pushTurn('assistant', { stage: spec.stage, insightKey: spec.insightKey })

      if (spec.llm) {
        const prompt = stagePrompt(spec.stage)
        recorder.pushTool({
          name: 'llm.complete',
          args: { stage: spec.stage, promptChars: prompt.length },
          status: 'pending',
          stage: spec.stage,
          attempt,
        })
        try {
          const res = await capability.complete(
            {
              system: 'You are a knowledge ingestion assistant.',
              prompt,
              temperature: 0,
            },
            signal,
          )
          recorder.markLastTool('ok', { simulated: false, textPreview: res.text.slice(0, 120), usage: res.usage })
        } catch (e) {
          const aborted = signal?.aborted === true
          recorder.markLastTool('error', {
            simulated: false,
            aborted,
            error: String((e as Error)?.message ?? e).slice(0, 200),
          })
          if (aborted) {
            return recorder.terminal('cancelled')
          }
          attemptFailed = true
          break // leave the stage loop -> failover walk
        }
        continue
      }

      if (spec.stage === 'relate') {
        // Planned writes: recorded as tool calls, never executed (R-7).
        recorder.pushPlanned('relate', relateStageCalls(request.agentId), attempt)
      } else if (spec.stage === 'done') {
        recorder.pushPlanned('done', [doneStageCall()], attempt)
      }
    }

    if (!attemptFailed) {
      const realLlmCalls = recorder.toolCalls.filter(
        (call: ToolCall) => call.name === 'llm.complete' && call.status === 'ok',
      ).length
      return recorder.terminal('completed', {
        output: {
          stages: STAGE_SPECS.map(spec => spec.stage),
          // Derived from the recorded tool calls (ruling D8): never hardcoded.
          plannedProposalOps: plannedProposalOpCount(recorder.toolCalls),
          realLlmCalls,
        },
      })
    }

    // Failover: the failed candidate is out; the REST is re-guarded (Q-R3).
    const rest = candidates.slice(1)
    const reGuarded = filterFailoverCandidates(rest, { privacy })
    if (reGuarded.allowed.length === 0) {
      return recorder.terminal('failed', {
        error: {
          code: 'no-local-provider',
          message: 'all guard-passed candidates exhausted; failover re-guard rejected the rest',
        },
      })
    }
    candidates = reGuarded.allowed
  }
}
