import { useState } from 'react'
import { useT } from '../i18n'
import { getTheme, setTheme, type ThemeMode } from '../themeBootstrap'

const MODES: ThemeMode[] = ['system', 'light', 'dark']

export function ThemeSwitcher() {
  const { t } = useT()
  const [mode, setMode] = useState<ThemeMode>(getTheme())

  const choose = (m: ThemeMode) => {
    setTheme(m)
    setMode(m)
  }

  return (
    <div className="theme-switcher" role="group" aria-label={t('theme.title')}>
      <span className="theme-switcher__label">{t('theme.title')}</span>
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          className={'theme-switcher__opt' + (mode === m ? ' is-active' : '')}
          aria-pressed={mode === m}
          onClick={() => choose(m)}
        >
          {t(('theme.' + m) as 'theme.system')}
        </button>
      ))}
    </div>
  )
}
