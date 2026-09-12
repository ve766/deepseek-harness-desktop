import type { KnowledgeNode } from '../types'
import { store, useNodes, useProgress, useRecommendations } from '../store/canvasStore'
import { useT, resolveEntity, useLanguagePref } from '../i18n'
import { runLearningPathDemo } from '../demo/galaxy'

export function NoxGapCard() {
  const { t } = useT()
  const pref = useLanguagePref()
  // Nox's reply language: system / user / auto all resolve to the UI language in
  // this v1.3 scope (full auto-detection lands in a later release).
  const noxLang = pref.interfaceLanguage
  const progress = useProgress()
  const recs = useRecommendations()
  const nodes = useNodes()

  const knownNodes = Object.values(progress)
    .filter((p) => p.status === 'known')
    .map((p) => nodes[p.nodeId])
    .filter(Boolean) as KnowledgeNode[]
  const gaps = Object.values(recs).filter((r) => r.kind === 'gap')
  const gap = gaps[0]
  const pathRec = Object.values(recs).find((r) => r.kind === 'path')
  const routePaths = Object.values(recs).filter((r) => r.kind === 'path')

  return (
    <div className="nox-card">
      <div className="nox-card__head">
        <span className="nox-card__avatar">🐈‍⬛</span>
        <div className="nox-card__id">
          <div className="nox-card__name">{t('agent.nox.name')}</div>
          <div className="nox-card__role">{t('agent.nox.role')}</div>
        </div>
      </div>

      {gap && (
        <div className="nox-gap">
          <div className="nox-gap__title">
            <span className="nox-gap__pulse" /> {t('nox.gapTitle')}
          </div>
          <div className="nox-gap__name">{resolveEntity(gap.title, gap.titleLoc, noxLang)}</div>
          <div className="nox-gap__why">
            {t('nox.why', { desc: resolveEntity(gap.description, gap.descriptionLoc, noxLang) })}
          </div>
          <div className="nox-gap__time">{t('nox.gapTime')}</div>
        </div>
      )}

      <button className="nox-card__cta" onClick={() => runLearningPathDemo(pathRec?.pathId)}>
        <span className="nox-card__cta-label">{t('nox.ctaLabel')}</span>
        <span className="nox-card__cta-sub">
          {pathRec ? resolveEntity(pathRec.title, pathRec.titleLoc, noxLang) : t('nox.ctaSub')}
        </span>
      </button>

      {knownNodes.length > 0 && (
        <div className="nox-card__section">
          <div className="nox-card__sec-title">{t('nox.mastered', { n: knownNodes.length })}</div>
          <div className="nox-chips">
            {knownNodes.map((n) => (
              <span key={n.id} className="nox-chip nox-chip--ok">
                ✓ {resolveEntity(n.title, n.titleLoc, noxLang)}
              </span>
            ))}
          </div>
        </div>
      )}

      {routePaths.length > 0 && (
        <div className="nox-card__section">
          <div className="nox-card__sec-title">{t('nox.routes')}</div>
          <ul className="nox-routes">
            {routePaths.map((r) => (
              <li
                key={r.id}
                className="nox-route"
                onClick={() => store.setActivePath(r.pathId ?? null)}
              >
                <span className="nox-route__dot" />
                <span className="nox-route__name">
                  {resolveEntity(r.title, r.titleLoc, noxLang)}
                </span>
                <span className="nox-route__go">{t('nox.routeGo')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        className="nox-card__link"
        onClick={() => store.setActivePath(pathRec?.pathId ?? null)}
      >
        {t('nox.viewGalaxy')}
      </button>
    </div>
  )
}
