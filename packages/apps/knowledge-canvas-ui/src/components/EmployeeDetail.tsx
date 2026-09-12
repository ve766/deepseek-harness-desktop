import type { AgentProfile, LocText } from '../types'
import type { EmployeeStatus } from './morphicons/states'
import { useT, resolveLoc } from '../i18n'
import { EmployeeIdentity } from './EmployeeCard'
import { EmployeeKnowledgeDetail } from './EmployeeKnowledgeDetail'
import './EmployeeDetail.css'

/* ============================================================
 * AI Employee Detail · Stage 3 (drill-down profile, NOT a dashboard).
 *
 * Responsibility (per Stage 3 Mini Plan, approved):
 *   - EmployeeIdentity hero + Capability Overview + Level + Growth Timeline.
 *   - Pure presentation of mock data; NO Agent Runtime / Registry / Memory
 *     query / capability auto-probing / task history.
 *
 * Hard red lines (Stage 3):
 *   - Reuses <EmployeeIdentity> (variant="hero") — does NOT modify it.
 *   - No chat / prompt / file upload / task creation.
 *   - Single glass layer: this surface is transparent (no backdrop-filter);
 *     only the TitleBar + CommandCenter floating layer may be glass.
 *   - Entered from Employee Center via `onOpenDetail(id)`; returns via
 *     `onBack()` (clears detailId, stays on the employees route).
 * ============================================================ */

export interface EmployeeDetailGrowthItem {
  phase: LocText
  detail: LocText
}

export interface EmployeeDetailContext {
  profile: AgentProfile
  status: EmployeeStatus
  statusPhrase?: LocText
  capabilities: LocText[]
  level: number
  growth: EmployeeDetailGrowthItem[]
}

export function EmployeeDetail({
  ctx,
  onBack,
}: {
  ctx: EmployeeDetailContext
  onBack: () => void
}) {
  const { t, lang } = useT()

  return (
    <section
      className="employee-detail"
      aria-label={t('employees.detail.title')}
      style={{ ['--emp-color' as string]: ctx.profile.color }}
    >
      <header className="employee-detail__bar">
        <button type="button" className="employee-detail__back" data-employee-back onClick={onBack}>
          <span className="employee-detail__back-arrow" aria-hidden>
            ‹
          </span>
          {t('employees.detail.back')}
        </button>
        <h1 className="employee-detail__title">{t('employees.detail.title')}</h1>
      </header>

      <div className="employee-detail__hero" aria-label={t('employees.detail.roleDesc')}>
        <EmployeeIdentity
          agent={ctx.profile}
          status={ctx.status}
          statusPhrase={ctx.statusPhrase}
          capabilities={ctx.capabilities}
          level={ctx.level}
          variant="hero"
        />
      </div>

      <section
        className="employee-detail__panel"
        data-employee-detail-caps
        aria-label={t('employees.detail.capabilities')}
      >
        <h2 className="employee-detail__section-title">{t('employees.detail.capabilities')}</h2>
        <ul className="employee-detail__caps">
          {ctx.capabilities.map((c, i) => (
            <li className="employee-detail__cap" key={i}>
              {resolveLoc(undefined, c, lang)}
            </li>
          ))}
        </ul>
      </section>

      <section
        className="employee-detail__panel"
        data-employee-detail-level
        aria-label={t('employees.detail.level')}
      >
        <h2 className="employee-detail__section-title">{t('employees.detail.level')}</h2>
        <div className="employee-detail__level">
          <span className="employee-detail__level-track">
            <span className="employee-detail__level-fill" style={{ width: Math.round(ctx.level * 100) + '%' }} />
          </span>
          <span className="employee-detail__level-text">Lv {Math.round(ctx.level * 100)}</span>
        </div>
      </section>

      <section
        className="employee-detail__panel"
        data-employee-detail-growth
        aria-label={t('employees.detail.growth')}
      >
        <h2 className="employee-detail__section-title">{t('employees.detail.growth')}</h2>
        <ol className="employee-detail__timeline">
          {ctx.growth.map((g, i) => (
            <li className="employee-detail__milestone" key={i}>
              <span className="employee-detail__milestone-dot" aria-hidden />
              <div className="employee-detail__milestone-body">
                <div className="employee-detail__milestone-phase">{resolveLoc(undefined, g.phase, lang)}</div>
                <div className="employee-detail__milestone-detail">{resolveLoc(undefined, g.detail, lang)}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <EmployeeKnowledgeDetail agentId={ctx.profile.id} />
    </section>
  )
}
