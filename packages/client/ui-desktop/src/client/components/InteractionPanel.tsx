/**
 * P2/Commit6 — Interaction Panel.
 *
 * Renders the derived {@link InteractionView} and binds it to the only actions
 * the runtime actually offers:
 *   - approve / question → `PendingWait.respond()` on the live pending carrier
 *     (the carrier is looked up by `view.key`, so the derivation stays pure)
 *   - settled / error    → a brand-new queued prompt via the `sendMessage` bridge
 *
 * There is deliberately NO retry button and NO 「继续生成」 button: the runtime
 * exposes no retry and no continue verb, and the UI must not imply otherwise.
 * The follow-up control is labelled 「继续对话」 because that is exactly what it
 * does — it starts a new turn.
 *
 * @module @deepseek-ai/dsh-client-ui-desktop/client/InteractionPanel
 */
import { useState, type ReactElement } from 'react'
import type { PendingInteraction, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import { Button, Pill, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { sendMessage } from '../sessionBridge.ts'
import type { ApproveView, InteractionView, QuestionView } from '../workspaceInteraction.ts'
import css from './InteractionPanel.module.css'

/** Error sink; passing null clears the last failure line. */
type OnError = (message: string | null) => void

/** Turn a caught unknown into a displayable line. */
function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

/** Tool-call approval: allow once, or reject. */
function ApproveBlock({ wait, approve, onError }: {
  wait: Extract<PendingInteraction, { kind: 'approval' }>
  approve: ApproveView
  onError: OnError
}): ReactElement {
  const [busy, setBusy] = useState(false)

  const respond = (outcome: 'allowed-once' | 'rejected'): void => {
    onError(null)
    setBusy(true)
    try {
      void wait
        .respond({
          ok: true,
          value: { sessionId: wait.sessionId, approvalId: wait.payload.approvalId, outcome },
        })
        .then((receipt) => {
          if (!receipt.accepted) onError(`未受理：${receipt.reason}`)
        })
        .catch((cause: unknown) => onError(describe(cause)))
        .finally(() => setBusy(false))
    } catch (cause) {
      // respond() throws synchronously once the wait has settled (pending.ts:74)
      onError(describe(cause))
      setBusy(false)
    }
  }

  return (
    <div className={css.block}>
      <div className={css.approveTool}>{approve.toolName}</div>
      {approve.reason !== null && <div className={css.detail}>{approve.reason}</div>}
      <div className={css.actions}>
        <Button variant="primary" size="sm" disabled={busy} onClick={() => respond('allowed-once')}>
          允许一次
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => respond('rejected')}>
          拒绝
        </Button>
      </div>
    </div>
  )
}

/** Add or remove one label from a multi-select answer. */
function toggleLabel(current: readonly string[], label: string): string[] {
  return current.includes(label)
    ? current.filter((entry) => entry !== label)
    : [...current, label]
}

/**
 * Question batch (a host ask() is answered as one batch, never split).
 * Single-select batches submit as soon as every question has an answer;
 * a batch containing any multi-select question waits for an explicit submit.
 */
function QuestionBlock({ wait, question, onError }: {
  wait: Extract<PendingInteraction, { kind: 'question' }>
  question: QuestionView
  onError: OnError
}): ReactElement {
  const [selected, setSelected] = useState<Record<string, readonly string[]>>({})
  const [busy, setBusy] = useState(false)

  const allAnswered = question.items.every((item) => (selected[item.id] ?? []).length > 0)
  const allSingle = question.items.every((item) => !item.multiSelect)

  const settle = (picked: Record<string, readonly string[]>): void => {
    const answers = question.items.map((item) => ({ id: item.id, selected: [...(picked[item.id] ?? [])] }))
    onError(null)
    setBusy(true)
    try {
      void wait
        .respond({ ok: true, value: { sessionId: wait.sessionId, answer: { answers } } })
        .then((receipt) => {
          if (!receipt.accepted) onError(`未受理：${receipt.reason}`)
        })
        .catch((cause: unknown) => onError(describe(cause)))
        .finally(() => setBusy(false))
    } catch (cause) {
      onError(describe(cause))
      setBusy(false)
    }
  }

  const cancel = (): void => {
    onError(null)
    setBusy(true)
    try {
      void wait
        .respond({
          ok: false,
          error: { code: 'cancelled', message: 'the user dismissed this question', details: {} },
        })
        .then((receipt) => {
          if (!receipt.accepted) onError(`未受理：${receipt.reason}`)
        })
        .catch((cause: unknown) => onError(describe(cause)))
        .finally(() => setBusy(false))
    } catch (cause) {
      onError(describe(cause))
      setBusy(false)
    }
  }

  return (
    <div className={css.block}>
      {question.items.map((item) => {
        const picked = selected[item.id] ?? []
        return (
          <div className={css.questionItem} key={item.id}>
            {item.header !== null && <div className={css.questionHeader}>{item.header}</div>}
            <div className={css.questionText}>{item.question}</div>
            {item.detail !== null && <div className={css.detail}>{item.detail}</div>}
            <div className={css.options}>
              {item.options.map((option) => (
                <Pill
                  key={option.label}
                  active={picked.includes(option.label)}
                  disabled={busy}
                  title={option.description ?? ''}
                  onClick={() => {
                    const next = item.multiSelect
                      ? { ...selected, [item.id]: toggleLabel(picked, option.label) }
                      : { ...selected, [item.id]: [option.label] }
                    setSelected(next)
                    const complete = question.items.every((entry) => (next[entry.id] ?? []).length > 0)
                    if (allSingle && complete) settle(next)
                  }}
                >
                  {option.label}
                </Pill>
              ))}
            </div>
          </div>
        )
      })}
      <div className={css.actions}>
        <Button variant="primary" size="sm" disabled={busy || !allAnswered} onClick={() => settle(selected)}>
          提交
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={cancel}>
          取消
        </Button>
      </div>
    </div>
  )
}

/**
 * Follow-up composer for the settled and error states.
 *
 * This sends a NEW queued turn. It is not a retry and not a resumption — the
 * runtime has no such verb, so the label stays 『继续对话』.
 */
function FollowUpBlock({ sessionId, onError }: {
  sessionId: SessionSummary['id']
  onError: OnError
}): ReactElement {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = (): void => {
    const body = text.trim()
    if (body === '') return
    onError(null)
    setBusy(true)
    void sendMessage(sessionId, body)
      .then((accepted) => {
        if (!accepted) {
          onError('未能发送：会话不可用')
          return
        }
        setText('')
        setOpen(false)
      })
      .catch((cause: unknown) => onError(describe(cause)))
      .finally(() => setBusy(false))
  }

  if (!open) {
    return (
      <div className={css.block}>
        <div className={css.actions}>
          <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
            继续对话
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={css.block}>
      <div className={css.compose}>
        <Input
          className={css.composeInput ?? ''}
          value={text}
          placeholder="补充说明，开启新一轮"
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
        />
        <Button variant="primary" size="sm" disabled={busy || text.trim() === ''} onClick={submit}>
          发送
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setOpen(false)
            setText('')
          }}
        >
          取消
        </Button>
      </div>
    </div>
  )
}

/** Props: the derived view, the live pending carriers, and the session id. */
export type InteractionPanelProps = {
  view: InteractionView
  pending: readonly PendingInteraction[]
  sessionId: SessionSummary['id']
}

/**
 * The Interaction Panel: what the employee needs from the user right now.
 * Renders nothing when there is nothing to ask for (`kind === 'none'`).
 */
export function InteractionPanel({ view, pending, sessionId }: InteractionPanelProps): ReactElement | null {
  const [error, setError] = useState<string | null>(null)

  if (view.kind === 'none') return null

  const wait = view.key === null ? undefined : pending.find((entry) => entry.key === view.key)

  return (
    <div className={css.root}>
      {view.message !== null && (
        <div className={css.headline}>
          {view.message}
          {view.pendingCount > 1 && <span className={css.count}>1 / {view.pendingCount}</span>}
        </div>
      )}

      {view.kind === 'approve' && view.approve !== undefined && wait !== undefined && wait.kind === 'approval' && (
        <ApproveBlock wait={wait} approve={view.approve} onError={setError} />
      )}

      {view.kind === 'question' && view.question !== undefined && wait !== undefined && wait.kind === 'question' && (
        <QuestionBlock wait={wait} question={view.question} onError={setError} />
      )}

      {(view.kind === 'settled' || view.kind === 'error') && (
        <FollowUpBlock sessionId={sessionId} onError={setError} />
      )}

      {error !== null && <div className={css.errorLine}>{error}</div>}
    </div>
  )
}
