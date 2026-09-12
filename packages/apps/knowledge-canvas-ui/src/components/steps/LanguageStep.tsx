import { useT, setLanguage } from '../../i18n'
import { INTERFACE_LANGS } from '../LanguageSettings'

/** Step 1 — pick interface language. Reuses the existing language store
 *  (setLanguage) and the same option list as LanguageSettings, so the choice
 *  is immediately reflected app-wide and persisted. */
export function LanguageStep() {
  const { t, lang } = useT()
  return (
    <div className="firstrun-step">
      <h2 className="firstrun-step__title">{t('firstrun.language.title')}</h2>
      <p className="firstrun-step__desc">{t('firstrun.language.desc')}</p>
      <div className="firstrun-step__opts">
        {INTERFACE_LANGS.map(l => (
          <button
            key={l.code}
            className={'appbtn' + (lang === l.code ? ' is-on' : '')}
            disabled={l.soon}
            onClick={() => setLanguage({ interfaceLanguage: l.code })}
          >
            {t(l.labelKey)}
            {l.soon && <span className="appbtn__soon">soon</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
