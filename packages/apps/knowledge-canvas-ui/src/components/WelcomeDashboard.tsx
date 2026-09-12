import { useState } from 'react'
import { useNodes, useProgress, useRecommendations, useRelationships } from '../store/canvasStore'
import { useT, resolveEntity, formatDate, useLanguagePref } from '../i18n'
import { EmptyState } from './EmptyState'
import { startDemo } from '../demo/sequencer'

/** First-run landing — an "AI OS home" rather than a plain web page.
 *  Highlights Today's AI discoveries, knowledge growth, capability gaps and the
 *  recommended next step, then routes into the knowledge space. */
export function WelcomeDashboard({ onEnter }: { onEnter: () => void }) {
  const { t } = useT()
  const pref = useLanguagePref()
  const progress = useProgress()
  const recs = useRecommendations()
  const rels = useRelationships()
  const [hover, setHover] = useState(false)

  const list = Object.values(progress)
  const mastered = list.filter(p => p.status === 'known').length
  const learning = list.filter(p => p.status === 'learning').length
  const gaps = list.filter(p => p.status === 'gap').length
  const discovery = Object.keys(rels).length + 2
  const nextRec =
    Object.values(recs).find(r => r.kind === 'next') ??
    Object.values(recs).find(r => r.kind === 'path')

  const today = formatDate(new Date(), pref)
  const isEmpty = Object.keys(useNodes()).length === 0

  // Demo Flow entry (P4-1/4): seed the demo graph + flag active, then enter the canvas.
  const handleDemo = () => {
    startDemo()
    onEnter()
  }

  return (
    <div className="wd">
      <div className="wd__bg" aria-hidden />
      <div className="wd__mascot" aria-hidden>
        🐈‍⬛
      </div>

      <div className="wd__hero">
        <div className="wd__eyebrow">{t('dashboard.eyebrow', { date: today })}</div>
        <h1 className="wd__hi">{t('dashboard.title')}</h1>
        <p className="wd__sub">{t('dashboard.sub')}</p>
      </div>

      {isEmpty ? (
        <EmptyState
          variant="welcome"
          title={t('empty.title.welcome')}
          description={t('empty.desc.welcome')}
          action={
            <button className="wd-next__cta" onClick={handleDemo}>
              {t('demo.start')} →
            </button>
          }
        />
      ) : (
        <>
          <div className="wd__cards">
            <div className="wd-card wd-card--discover">
              <div className="wd-card__icon">🔗</div>
              <div className="wd-card__value">{discovery}</div>
              <div className="wd-card__label">{t('dashboard.today_discovery')}</div>
              <div className="wd-card__sub">{t('dashboard.discover.sub')}</div>
            </div>
            <div className="wd-card wd-card--grow">
              <div className="wd-card__icon">📈</div>
              <div className="wd-card__value">{mastered + learning}</div>
              <div className="wd-card__label">{t('dashboard.grow.label')}</div>
              <div className="wd-card__sub">{t('dashboard.grow.sub', { mastered, learning })}</div>
            </div>
            <div className="wd-card wd-card--gap">
              <div className="wd-card__icon">🎯</div>
              <div className="wd-card__value">{gaps}</div>
              <div className="wd-card__label">{t('dashboard.gap.label')}</div>
              <div className="wd-card__sub">{t('dashboard.gap.sub')}</div>
            </div>
          </div>

          <div className="wd-next">
            <div className="wd-next__avatar">🐈‍⬛</div>
            <div className="wd-next__body">
              <div className="wd-next__label">{t('dashboard.noxNext')}</div>
              <div className="wd-next__text">
                {nextRec
                  ? resolveEntity(nextRec.description, nextRec.descriptionLoc, pref.interfaceLanguage)
                  : t('dashboard.nextFallback')}
              </div>
            </div>
            <button className="wd-next__cta" onClick={onEnter}>
              {t('dashboard.start')} →
            </button>
          </div>
        </>
      )}

      <div className="wd__actions">
        <button
          className={'wd__enter' + (hover ? ' is-hover' : '')}
          onClick={onEnter}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          {t('dashboard.enter')}
          <span className="wd__enter-arrow">→</span>
        </button>
        <span className="wd__hint">{t('dashboard.hint')}</span>
      </div>
    </div>
  )
}
