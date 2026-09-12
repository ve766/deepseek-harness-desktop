/**
 * P0 review harness for the Morphicon state system.
 *
 * Standalone — it is rendered by its own entry (src/morphiconDemoEntry.tsx) so
 * that no existing component, route or stylesheet has to be touched.
 */
import { setLanguage, useLanguagePref, useT } from '../i18n'
import { EmployeeStatusIcon } from './morphicons/EmployeeStatusIcon'
import { MemoryStatusIcon } from './morphicons/MemoryStatusIcon'
import { MorphIcon } from './morphicons/MorphIcon'
import { ProviderStatusIcon } from './morphicons/ProviderStatusIcon'
import { TaskStatusIcon } from './morphicons/TaskStatusIcon'
import { useMorphState } from './morphicons/useMorphState'
import { usePrefersReducedMotion } from './morphicons/usePrefersReducedMotion'
import { MORPH_STATES, type MorphState } from './morphicons/geometry'
import '../morphiconDemo.css'

const SIZES = [16, 20, 28, 44]

export function MorphiconDemo() {
  const { t } = useT()
  const pref = useLanguagePref()
  const reduced = usePrefersReducedMotion()
  const live = useMorphState('idle')

  const isZh = pref.interfaceLanguage === 'zh-CN'

  const rapidFire = () => {
    live.set('thinking')
    window.setTimeout(() => live.set('searching'), 80)
    window.setTimeout(() => live.set('learning'), 160)
    window.setTimeout(() => live.set('completed'), 240)
  }

  return (
    <div className="mdemo">
      <header className="mdemo__head">
        <div>
          <h1 className="mdemo__title">{t('morph.demo.title')}</h1>
          <p className="mdemo__sub">{t('morph.demo.subtitle')}</p>
        </div>
        <div className="mdemo__head-right">
          <span className="mdemo__lang-label">{t('morph.demo.lang')}</span>
          <div className="mdemo__seg">
            <button
              type="button"
              className={isZh ? 'mdemo__seg-btn is-on' : 'mdemo__seg-btn'}
              onClick={() => setLanguage({ interfaceLanguage: 'zh-CN', locale: 'zh-CN' })}
            >
              简体中文
            </button>
            <button
              type="button"
              className={!isZh ? 'mdemo__seg-btn is-on' : 'mdemo__seg-btn'}
              onClick={() => setLanguage({ interfaceLanguage: 'en-US', locale: 'en-US' })}
            >
              English
            </button>
          </div>
        </div>
      </header>

      {/* ---- All seven states ---- */}
      <section className="mdemo__card">
        <h2 className="mdemo__h2">{t('morph.demo.gallery')}</h2>
        <div className="mdemo__row">
          {MORPH_STATES.map((s) => (
            <div className="mdemo__cell" key={s}>
              <MorphIcon state={s} size={44} />
              <span className="mdemo__cell-label">{t('morph.state.' + s)}</span>
              <code className="mdemo__code">{s}</code>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Size scale ---- */}
      <section className="mdemo__card">
        <h2 className="mdemo__h2">{t('morph.demo.sizes')}</h2>
        <div className="mdemo__row mdemo__row--baseline">
          {SIZES.map((n) => (
            <div className="mdemo__cell" key={n}>
              <MorphIcon state="thinking" size={n} />
              <code className="mdemo__code">{n}px</code>
            </div>
          ))}
        </div>
      </section>

      {/* ---- The four semantic wrappers ---- */}
      <section className="mdemo__card">
        <h2 className="mdemo__h2">{t('morph.demo.family')}</h2>
        <div className="mdemo__row">
          <div className="mdemo__cell">
            <EmployeeStatusIcon state="searching" size={40} name="Nox" />
            <span className="mdemo__cell-label">{t('morph.aria.employee', { name: 'Nox', state: t('morph.state.searching') })}</span>
            <code className="mdemo__code">EmployeeStatusIcon</code>
          </div>
          <div className="mdemo__cell">
            <TaskStatusIcon state="thinking" size={40} />
            <span className="mdemo__cell-label">{t('morph.aria.task', { state: t('morph.state.thinking') })}</span>
            <code className="mdemo__code">TaskStatusIcon</code>
          </div>
          <div className="mdemo__cell">
            <MemoryStatusIcon state="learning" size={40} />
            <span className="mdemo__cell-label">{t('morph.aria.memory', { state: t('morph.state.learning') })}</span>
            <code className="mdemo__code">MemoryStatusIcon</code>
          </div>
          <div className="mdemo__cell">
            <ProviderStatusIcon state="completed" size={40} name="Ollama" />
            <span className="mdemo__cell-label">{t('morph.aria.provider', { name: 'Ollama', state: t('morph.state.completed') })}</span>
            <code className="mdemo__code">ProviderStatusIcon</code>
          </div>
        </div>

        {/* Provider is the P1 target: it replaces a single static "ok" dot. */}
        <div className="mdemo__providers">
          {(['completed', 'warning', 'error'] as MorphState[]).map((s) => (
            <div className="mdemo__prow" key={s}>
              <ProviderStatusIcon state={s} size={16} name={s} />
              <span className="mdemo__pname">{s}</span>
              <span className="mdemo__pstate">{t('morph.state.' + s)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Live state machine ---- */}
      <section className="mdemo__card">
        <h2 className="mdemo__h2">{t('morph.demo.live')}</h2>
        <p className="mdemo__hint">{t('morph.demo.liveHint')}</p>

        <div className="mdemo__live">
          <div className="mdemo__live-icon">
            <MorphIcon state={live.state} size={96} />
          </div>
          <div className="mdemo__live-side">
            <div className="mdemo__cur">
              <span className="mdemo__cur-k">{t('morph.demo.current')}</span>
              <span className="mdemo__cur-v">{t('morph.state.' + live.state)}</span>
              <code className="mdemo__code">{live.state}</code>
            </div>
            <div className="mdemo__btns">
              {MORPH_STATES.map((s) => (
                <button
                  type="button"
                  key={s}
                  className={live.state === s ? 'mdemo__btn is-on' : 'mdemo__btn'}
                  onClick={() => live.set(s)}
                >
                  {t('morph.state.' + s)}
                </button>
              ))}
            </div>
            <div className="mdemo__btns">
              <button type="button" className="mdemo__btn mdemo__btn--alt" onClick={rapidFire}>
                {t('morph.demo.rapid')}
              </button>
              <button type="button" className="mdemo__btn mdemo__btn--alt" onClick={live.reset}>
                {t('morph.demo.reset')}
              </button>
            </div>
            <div className="mdemo__status">
              <span className="mdemo__status-k">{t('morph.demo.reduced')}</span>
              <span className={reduced ? 'mdemo__badge is-on' : 'mdemo__badge'}>
                {reduced ? t('morph.demo.reducedOn') : t('morph.demo.reducedOff')}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
