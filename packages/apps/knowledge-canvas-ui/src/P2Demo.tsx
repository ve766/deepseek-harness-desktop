/**
 * P2 review harness — renders the AI association explainer: a single explainable
 * link played as source-pulse → edge-reveal → target-ripple → reason bubble.
 *
 * Standalone: mounted by src/p2DemoEntry.tsx, does NOT touch main.tsx or any
 * existing route/stylesheet. Build with:  node build.cjs src/p2DemoEntry.tsx
 *
 * Frozen scope: no graph algorithm, no embedding, no real knowledge graph.
 * reason / confidence / relationship are mock data (see associationMock.ts).
 */
import { useState } from 'react'
import { setLanguage, useLanguagePref, useT } from './i18n'
import { AssociationExplainer } from './components/AssociationExplainer'
import { usePrefersReducedMotion } from './components/morphicons/usePrefersReducedMotion'
import { SAMPLE_ASSOCIATIONS } from './associationMock'
import './p2Demo.css'

export function P2Demo() {
  const { t } = useT()
  const pref = useLanguagePref()
  const reduced = usePrefersReducedMotion()
  const isZh = pref.interfaceLanguage === 'zh-CN'

  const [idx, setIdx] = useState(0)
  const [runId, setRunId] = useState(0)
  const total = SAMPLE_ASSOCIATIONS.length
  const active = SAMPLE_ASSOCIATIONS[idx]

  const prev = () => setIdx((i) => (i - 1 + total) % total)
  const next = () => setIdx((i) => (i + 1) % total)
  const replay = () => setRunId((r) => r + 1)

  return (
    <div className="p2">
      <header className="p2__head">
        <div>
          <h1 className="p2__title">{t('association.title')}</h1>
          <p className="p2__sub">{t('association.subtitle')}</p>
          <p className="p2__intro">{t('association.intro')}</p>
        </div>
        <div className="p2__head-right">
          <span className="p2__lang-label">{t('morph.demo.lang')}</span>
          <div className="p2__seg">
            <button
              type="button"
              className={isZh ? 'p2__seg-btn is-on' : 'p2__seg-btn'}
              onClick={() => setLanguage({ interfaceLanguage: 'zh-CN', locale: 'zh-CN' })}
            >
              简体中文
            </button>
            <button
              type="button"
              className={!isZh ? 'p2__seg-btn is-on' : 'p2__seg-btn'}
              onClick={() => setLanguage({ interfaceLanguage: 'en-US', locale: 'en-US' })}
            >
              English
            </button>
          </div>
          <span className={reduced ? 'p2__reduced is-on' : 'p2__reduced'}>
            {reduced ? t('morph.demo.reducedOn') : t('morph.demo.reducedOff')}
          </span>
        </div>
      </header>

      <section className="p2__card">
        <AssociationExplainer key={active.id + ':' + runId} assoc={active} />

        <div className="p2__controls">
          <button type="button" className="p2__btn" onClick={prev}>
            ←
          </button>
          <button type="button" className="p2__btn p2__btn--primary" onClick={replay}>
            {t('association.replay')}
          </button>
          <button type="button" className="p2__btn" onClick={next}>
            →
          </button>
          <span className="p2__counter">
            {idx + 1} / {total}
          </span>
        </div>

        <p className="p2__note">{t('association.scanNote')}</p>
      </section>
    </div>
  )
}
