import type { ReactNode } from 'react'
import type { AgentProfile, LocText } from '../types'
import type { EmployeeStatus, TaskStatus } from './morphicons/states'
import { useT, resolveLoc } from '../i18n'
import { EmployeeCard } from './EmployeeCard'
import './CommandCenter.css'

/* ============================================================
 * AI Command Center — presentation-only contract (B).
 *
 * This is the AI Employee CONTROL console — NOT a chat window:
 *   - project / employee / task context read-outs
 *   - a graded list of ACTIONS (primary / context)
 *   - system entries (settings / memory / market)
 *
 * HARD RED LINES (B):
 *   - No chat bubbles, no prompt input, no conversation history.
 *   - No connection to the AgentProfile registry, Agent runtime, Task
 *     runtime, or Memory remote. All data is mock `LocText`.
 *   - Action execution hooks (execute / permission / agentCapability)
 *     are intentionally omitted — the shape reserves the extension
 *     point but implements nothing.
 *   - Reuses <EmployeeCard variant="card"> for the Presence block;
 *     no new identity component is created.
 *   - Single glass layer only; E0 `--aios-*` tokens exclusively.
 * ============================================================ */

export type CommandCenterVariant = 'floating' | 'docked'

export interface CCProject {
  name: LocText
  phase: LocText
  progress: number // 0..1
}

export interface CCEmployee {
  profile: AgentProfile
  status: EmployeeStatus
  statusPhrase?: LocText
  level?: number
}

export interface CCTask {
  title: LocText
  progress: number // 0..1
  status: TaskStatus
}

/** Action grading (B): primary = the one decisive control; context = secondary. */
export type CCActionKind = 'primary' | 'context'

export interface CCAction {
  actionId: string
  label: LocText
  /** Display-only glyph (emoji / unicode). Not a CJK string. */
  icon: string
  shortcut?: string
  kind: CCActionKind
  // Extension point (NOT implemented in B):
  // execute?: () => void
  // permission?: () => boolean
  // agentCapability?: string
}

export type CCSystemEntryId = 'settings' | 'memory' | 'market'

export interface CCSystemEntry {
  id: CCSystemEntryId
  label: LocText
  icon: string
}

export interface CommandCenterContext {
  project?: CCProject
  employee: CCEmployee
  task?: CCTask
  actions: CCAction[]
  systemEntries: CCSystemEntry[]
}

function pct(n: number): number {
  return Math.round(Math.max(0, Math.min(1, n)) * 100)
}

/* ---------- collapsible section (native <details>, no external deps) ---------- */
function CCSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="cc-section" open>
      <summary className="cc-section__summary">
        <span className="cc-section__title">{title}</span>
        <span className="cc-section__chevron" aria-hidden />
      </summary>
      <div className="cc-section__body">{children}</div>
    </details>
  )
}

/* ---------- project read-out ---------- */
function CCProjectView({ project }: { project?: CCProject }) {
  const { t, lang } = useT()
  if (!project) {
    return <div className="cc-empty">{t('cc.empty.task')}</div>
  }
  const name = resolveLoc(undefined, project.name, lang)
  const phase = resolveLoc(undefined, project.phase, lang)
  return (
    <div className="cc-project">
      <div className="cc-project__name">{name}</div>
      <div className="cc-row">
        <span className="cc-row__k">{t('cc.project.phase')}</span>
        <span className="cc-row__v">{phase}</span>
      </div>
      <div className="cc-row">
        <span className="cc-row__k">{t('cc.project.progress')}</span>
        <span className="cc-row__v">{pct(project.progress)}%</span>
      </div>
      <div
        className="cc-bar"
        role="progressbar"
        aria-valuenow={pct(project.progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="cc-bar__fill" style={{ width: pct(project.progress) + '%' }} />
      </div>
    </div>
  )
}

/* ---------- task read-out ---------- */
function CCTaskView({ task }: { task?: CCTask }) {
  const { t, lang } = useT()
  if (!task) {
    return <div className="cc-empty">{t('cc.empty.task')}</div>
  }
  const title = resolveLoc(undefined, task.title, lang)
  return (
    <div className="cc-task">
      <div className="cc-task__label">{t('cc.task.label')}</div>
      <div className="cc-task__title">{title}</div>
      <div className="cc-row">
        <span className="cc-row__k">{t('status.task.' + task.status)}</span>
        <span className="cc-row__v">{pct(task.progress)}%</span>
      </div>
      <div
        className="cc-bar"
        role="progressbar"
        aria-valuenow={pct(task.progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="cc-bar__fill" style={{ width: pct(task.progress) + '%' }} />
      </div>
    </div>
  )
}

/* ---------- action row ---------- */
function CCActionRow({ action }: { action: CCAction }) {
  const { lang } = useT()
  const label = resolveLoc(undefined, action.label, lang)
  return (
    <button
      type="button"
      className={'cc-action cc-action--' + action.kind}
      data-action-id={action.actionId}
      onClick={() => {
        /* mock only — no execution in B */
      }}
    >
      <span className="cc-action__icon" aria-hidden>
        {action.icon}
      </span>
      <span className="cc-action__label">{label}</span>
      {action.shortcut && <span className="cc-action__shortcut">{action.shortcut}</span>}
    </button>
  )
}

/* ---------- system entry row ---------- */
function CCSystemRow({ entry }: { entry: CCSystemEntry }) {
  const { lang } = useT()
  const label = resolveLoc(undefined, entry.label, lang)
  return (
    <button
      type="button"
      className="cc-system__entry"
      data-entry-id={entry.id}
      onClick={() => {
        /* mock only */
      }}
    >
      <span className="cc-system__icon" aria-hidden>
        {entry.icon}
      </span>
      <span className="cc-system__label">{label}</span>
    </button>
  )
}

/* ============================================================
 * CommandCenter — the single glass shell.
 * ============================================================ */
export function CommandCenter({
  ctx,
  variant = 'floating',
}: {
  ctx: CommandCenterContext
  variant?: CommandCenterVariant
}) {
  const { t } = useT()
  return (
    <section
      className={'command-center command-center--' + variant}
      data-variant={variant}
      aria-label={t('cc.title')}
    >
      <header className="cc-header">
        <div className="cc-header__title">{t('cc.title')}</div>
        <div className="cc-header__presence">
          <EmployeeCard
            agent={ctx.employee.profile}
            status={ctx.employee.status}
            statusPhrase={ctx.employee.statusPhrase}
            level={ctx.employee.level}
            variant="card"
          />
        </div>
      </header>

      <CCSection title={t('cc.section.project')}>
        <CCProjectView project={ctx.project} />
      </CCSection>

      <CCSection title={t('cc.section.task')}>
        <CCTaskView task={ctx.task} />
      </CCSection>

      <CCSection title={t('cc.section.actions')}>
        <div className="cc-actions">
          {ctx.actions.map(a => (
            <CCActionRow key={a.actionId} action={a} />
          ))}
        </div>
      </CCSection>

      <CCSection title={t('cc.section.system')}>
        <div className="cc-system">
          {ctx.systemEntries.map(e => (
            <CCSystemRow key={e.id} entry={e} />
          ))}
        </div>
      </CCSection>
    </section>
  )
}
