/**
 * P2/Commit7 — Knowledge Entry Panel.
 *
 * Renders the derived {@link KnowledgeDraftView} and binds it to the only action
 * v0.1 offers: a manual 「沉淀为知识」 button that persists the draft into the
 * Personal Knowledge OS through the `saveKnowledge` bridge.
 *
 * There is deliberately NO auto-save and NO feedback / goal / artifact wiring:
 * the runtime exposes no such contract, and v0.1 validates the Employee →
 * Knowledge OS flow by hand. After a successful save the button locks to 「已沉淀」
 * to mitigate duplicate inserts (the import verb is always-insert).
 *
 * @module @deepseek-ai/dsh-client-ui-desktop/client/KnowledgeEntryPanel
 */
import { useState, type ReactElement } from 'react'
import { Button, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import { saveKnowledge } from '../knowledgeBridge.ts'
import type { KnowledgeDisabledReason, KnowledgeDraftView } from '../workspaceKnowledge.ts'
import css from './KnowledgeEntryPanel.module.css'

/** Error sink; passing null clears the last failure line. */
type OnError = (message: string | null) => void

/** Turn a caught unknown into a displayable line. */
function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

/** Human-readable hint for each disabled reason. */
function hintFor(reason: KnowledgeDisabledReason): string {
  switch (reason) {
    case 'empty': return '暂无可沉淀的内容'
    case 'running': return '员工工作中，暂不可沉淀'
    case 'pending': return '有待处理请求，暂不可沉淀'
  }
}

/** Props: the derived knowledge draft for the current session. */
export type KnowledgeEntryPanelProps = {
  draft: KnowledgeDraftView
}

/**
 * The Knowledge Entry Panel: persist the employee's work as a knowledge note.
 * Renders nothing meaningful when there is no derived draft (the Workspace still
 * mounts it, but it shows only the disabled hint).
 */
export function KnowledgeEntryPanel({ draft }: KnowledgeEntryPanelProps): ReactElement {
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [errorLine, setErrorLine] = useState<string | null>(null)

  const onError: OnError = (message) => setErrorLine(message)

  const disabled = busy || saved || !draft.canSave

  const onSave = (): void => {
    if (disabled) return
    onError(null)
    setBusy(true)
    void saveKnowledge(draft)
      .then((res) => {
        if (res.ok) {
          setSaved(true)
          setToast('已沉淀为知识')
        } else {
          onError(`沉淀失败：${res.error.message}`)
        }
      })
      .catch((cause: unknown) => onError(`沉淀失败：${describe(cause)}`))
      .finally(() => setBusy(false))
  }

  return (
    <div className={css.root}>
      <div className={css.head}>
        <div className={css.blockLabel}>知识沉淀</div>
        {draft.canSave && draft.title !== '' && (
          <div className={css.previewTitle}>{draft.title}</div>
        )}
      </div>
      <div className={css.actions}>
        <Button variant="primary" size="sm" disabled={disabled} onClick={onSave}>
          {saved ? '已沉淀' : '沉淀为知识'}
        </Button>
        {!draft.canSave && draft.disabledReason !== null && (
          <span className={css.hint}>{hintFor(draft.disabledReason)}</span>
        )}
      </div>
      {errorLine !== null && <div className={css.errorLine}>{errorLine}</div>}
      {toast !== null && <Toast text={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
