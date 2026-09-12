import { useState } from 'react'
import { useT } from '../../i18n'
import { getTheme, setTheme, type ThemeMode } from '../../themeBootstrap'

const MODES: { mode: ThemeMode; labelKey: 'theme.system' | 'theme.light' | 'theme.dark' }[] = [
  { mode: 'system', labelKey: 'theme.system' },
  { mode: 'light', labelKey: 'theme.light' },
  { mode: 'dark', labelKey: 'theme.dark' },
]

/** Step 2 — pick appearance. Reuses themeBootstrap (kcu-theme persistence +
 *  data-theme application); local state mirrors the selection for live feedback. */
export function ThemeStep() {
  const { t } = useT()
  const [current, setCurrent] = useState<ThemeMode>(() => getTheme())

  const choose = (m: ThemeMode) => {
    setTheme(m)
    setCurrent(m)
  }

  return (
    <div className="firstrun-step">
      <h2 className="firstrun-step__title">{t('firstrun.theme.title')}</h2>
      <p className="firstrun-step__desc">{t('firstrun.theme.desc')}</p>
      <div className="firstrun-step__opts">
        {MODES.map(m => (
          <button
            key={m.mode}
            className={'appbtn' + (current === m.mode ? ' is-on' : '')}
            onClick={() => choose(m.mode)}
          >
            {t(m.labelKey)}
          </button>
        ))}
      </div>
    </div>
  )
}
