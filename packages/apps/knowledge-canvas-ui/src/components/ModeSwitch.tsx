import { store, useMode } from '../store/canvasStore'
import { useT, type LanguageKey } from '../i18n'

const OPTIONS: { id: 'space' | 'growth'; labelKey: LanguageKey; subKey: LanguageKey; icon: string }[] = [
  { id: 'space', labelKey: 'canvas.space', subKey: 'canvas.spaceSub', icon: '📁' },
  { id: 'growth', labelKey: 'canvas.growth', subKey: 'canvas.growthSub', icon: '🌱' },
]

export function ModeSwitch() {
  const { t } = useT()
  const mode = useMode()
  return (
    <div className="modeswitch" role="tablist" aria-label={t('canvas.aria')}>
      <div
        className="modeswitch__track"
        style={{ transform: `translateX(${mode === 'growth' ? '100%' : '0'})` }}
      />
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={mode === o.id}
          className={'modeswitch__opt' + (mode === o.id ? ' is-active' : '')}
          onClick={() => store.setMode(o.id)}
        >
          <span className="modeswitch__icon">{o.icon}</span>
          <span className="modeswitch__label">{t(o.labelKey)}</span>
          <span className="modeswitch__sub">{t(o.subKey)}</span>
        </button>
      ))}
    </div>
  )
}
