import { useState } from 'react'
import { useMode } from '../store/canvasStore'
import { useT } from '../i18n'
import { CanvasViewport } from './CanvasViewport'
import { CanvasToolbar } from './CanvasToolbar'
import { GalaxyCanvas } from './GalaxyCanvas'
import { ModeSwitch } from './ModeSwitch'
import { BackgroundLayer } from './BackgroundLayer'
import { AppearanceSettings } from './AppearanceSettings'
import { LanguageSettings } from './LanguageSettings'
import { resetFirstRun } from '../firstRun'

export function CanvasRegion() {
  const mode = useMode()
  const { t } = useT()
  const [showAppearance, setShowAppearance] = useState(false)
  const [showLanguage, setShowLanguage] = useState(false)
  return (
    <section className="canvas-region">
      <BackgroundLayer />
      <ModeSwitch />
      {/* System toggles grouped into one top-right stack so they can never
          collide with the centered ModeSwitch or the canvas toolbar (P4-2 hotfix). */}
      <div className="canvas-actions">
        <button className="bg-toggle" onClick={() => setShowAppearance(s => !s)} title={t('bg.toggle')}>
          🎨 <span className="bg-toggle__label">{t('bg.toggle')}</span>
        </button>
        <button
          className="bg-toggle bg-toggle--lang"
          onClick={() => setShowLanguage(s => !s)}
          title={t('settings.language')}
        >
          🌐 <span className="bg-toggle__label">{t('settings.language')}</span>
        </button>
        <button
          className="bg-toggle bg-toggle--replay"
          onClick={() => {
            resetFirstRun()
            window.location.reload()
          }}
          title={t('settings.replayGuide')}
        >
          ↺ <span className="bg-toggle__label">{t('settings.replayGuide')}</span>
        </button>
      </div>
      {mode === 'space' ? <CanvasViewport /> : <GalaxyCanvas />}
      <CanvasToolbar />
      {showAppearance && <AppearanceSettings onClose={() => setShowAppearance(false)} />}
      {showLanguage && <LanguageSettings onClose={() => setShowLanguage(false)} />}
    </section>
  )
}
