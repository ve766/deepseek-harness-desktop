import type { AgentProfile, LocText } from '../types'
import type { EmployeeStatus } from './morphicons/states'
import { useT } from '../i18n'
import { EmployeeCard } from './EmployeeCard'
import { EmployeeKnowledgeSummary } from './EmployeeKnowledgeSummary'
import './EmployeeCenter.css'

/* ============================================================
 * AI Employee Center · Stage 2-A (management space, NOT a dashboard).
 *
 * Responsibility (per Stage 2-A Mini Plan, approved):
 *   - Employee roster / identity / capability overview / status / switch entry.
 *   - "Manage WHO" — the full crew directory; Home is the SINGLE primary's
 *     presence lounge. Both reuse <EmployeeCard> but aggregate differently (N vs 1).
 *
 * Hard red lines (Stage 2-A):
 *   - Reuses <EmployeeCard>/<EmployeeIcon> — does NOT modify them.
 *   - No chat / prompt / file upload / task creation.
 *   - No Runtime / Agent Registry / Manager / Memory Runtime.
 *   - Single glass layer: this surface is transparent (no backdrop-filter);
 *     only the TitleBar + CC floating layer may be glass.
 *   - `onOpenEmployee(id)` is a mock callback — in the real shell it is wired
 *     by MacWindowShell to "set focused employee + switch to Home". This component
 *     never touches AgentProfile or the data layer.
 * ============================================================ */

export interface EmployeeCenterEntry {
  profile: AgentProfile
  status: EmployeeStatus
  statusPhrase?: LocText
  level?: number
  /** Display-only capability hints (mock in Stage 2-A). Bilingual LocText[]. */
  capabilities?: LocText[]
}

export interface EmployeeCenterContext {
  entries: EmployeeCenterEntry[]
  /** Currently focused employee id (drives the `is-active` marker). */
  activeId?: string
}

export function EmployeeCenter({
  ctx,
  onOpenEmployee,
  onOpenDetail,
}: {
  ctx: EmployeeCenterContext
  onOpenEmployee?: (id: string) => void
  onOpenDetail?: (id: string) => void
}) {
  const { t } = useT()

  // Empty state — directory may be empty before any employee is onboarded.
  if (ctx.entries.length === 0) {
    return (
      <section className="employee-center employee-center--empty" aria-label={t('employees.title')}>
        <header className="employee-center__header">
          <h1 className="employee-center__title">{t('employees.title')}</h1>
          <p className="employee-center__subtitle">{t('employees.subtitle')}</p>
        </header>
        <div className="employee-center__empty">{t('employees.empty')}</div>
      </section>
    )
  }

  return (
    <section className="employee-center" aria-label={t('employees.title')}>
      <header className="employee-center__header">
        <h1 className="employee-center__title">{t('employees.title')}</h1>
        <p className="employee-center__subtitle">{t('employees.subtitle')}</p>
      </header>

      <div className="employee-center__grid">
        {ctx.entries.map((e) => {
          const active = e.profile.id === ctx.activeId
          return (
            <article
              key={e.profile.id}
              className={'employee-center__card' + (active ? ' is-active' : '')}
              data-employee-card
              data-employee-id={e.profile.id}
              style={{ ['--emp-color' as string]: e.profile.color }}
            >
              <EmployeeCard
                agent={e.profile}
                status={e.status}
                statusPhrase={e.statusPhrase}
                capabilities={e.capabilities}
                level={e.level}
                variant="card"
              />

              <div className="employee-center__card-foot">
                {active && <span className="employee-center__badge">{t('employees.active')}</span>}
                <EmployeeKnowledgeSummary agentId={e.profile.id} />
                <div className="employee-center__card-actions">
                  <button
                    type="button"
                    className="employee-center__open"
                    data-employee-open
                    data-employee-id={e.profile.id}
                    onClick={() => onOpenEmployee?.(e.profile.id)}
                  >
                    {t('employees.view')}
                  </button>
                  <button
                    type="button"
                    className="employee-center__detail"
                    data-employee-detail
                    data-employee-id={e.profile.id}
                    onClick={() => onOpenDetail?.(e.profile.id)}
                  >
                    {t('employees.detail.openDetail')}
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
