import { useState } from 'react'
import { useT } from '../i18n'
import { LanguageStep } from './steps/LanguageStep'
import { ThemeStep } from './steps/ThemeStep'
import { EmployeeIntroStep } from './steps/EmployeeIntroStep'
import './FirstRunScreen.css'

const STEPS = ['language', 'theme', 'employee'] as const

/**
 * 3-step first-run screen. Step index is the ONLY local state — no new store,
 * no Context. Each step is a leaf component that reuses existing systems
 * (language store, themeBootstrap, agent.nox.* identity).
 */
export function FirstRunScreen({ onFinish }: { onFinish: () => void }) {
  const { t } = useT()
  const [step, setStep] = useState(0)
  const stepId = STEPS[step]
  const isLast = step === STEPS.length - 1

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1))
  const back = () => setStep(s => Math.max(s - 1, 0))

  return (
    <div className="firstrun" data-firstrun-step={stepId}>
      <div className="firstrun__card">
        <div className="firstrun__brand">{t('app.brand')}</div>
        <div className="firstrun__subtitle">{t('firstrun.subtitle')}</div>

        <div className="firstrun__dots" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s} className={'firstrun__dot' + (i === step ? ' is-active' : '')} />
          ))}
        </div>
        <div className="firstrun__step-label">{t('firstrun.stepLabel', { n: step + 1 })}</div>

        <div className="firstrun__body">
          {stepId === 'language' && <LanguageStep />}
          {stepId === 'theme' && <ThemeStep />}
          {stepId === 'employee' && <EmployeeIntroStep />}
        </div>

        <div className="firstrun__nav">
          {step > 0 ? (
            <button className="appbtn appbtn--ghost" data-act="back" onClick={back}>
              {t('firstrun.back')}
            </button>
          ) : (
            <span />
          )}
          <div className="firstrun__nav-right">
            <button className="appbtn appbtn--ghost" data-act="skip" onClick={onFinish}>
              {t('firstrun.skip')}
            </button>
            {isLast ? (
              <button className="appbtn" data-act="finish" onClick={onFinish}>
                {t('firstrun.finish')}
              </button>
            ) : (
              <button className="appbtn" data-act="next" onClick={next}>
                {t('firstrun.next')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
