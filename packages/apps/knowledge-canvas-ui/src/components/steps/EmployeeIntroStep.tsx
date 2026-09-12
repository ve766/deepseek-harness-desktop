import { useT } from '../../i18n'

/**
 * Step 3 — meet the first AI Employee.
 * A1 rule: `agent.nox.*` is Nox's identity fact layer (name + role, the single
 * source for the Agent Registry). `firstrun.employee.*` is the first-run display
 * layer only — it never redefines who Nox is.
 */
export function EmployeeIntroStep() {
  const { t } = useT()
  return (
    <div className="firstrun-step firstrun-step--employee">
      <h2 className="firstrun-step__title">{t('firstrun.employee.title')}</h2>
      <div className="firstrun-employee">
        <div className="firstrun-employee__avatar" aria-hidden="true">🐈‍⬛</div>
        <div className="firstrun-employee__name">{t('agent.nox.name')}</div>
        <div className="firstrun-employee__role">{t('agent.nox.role')}</div>
      </div>
      <p className="firstrun-employee__greeting">{t('firstrun.employee.greeting')}</p>
      <p className="firstrun-employee__desc">{t('firstrun.employee.desc')}</p>
      <p className="firstrun-employee__note">{t('firstrun.employee.avatarNote')}</p>
    </div>
  )
}
