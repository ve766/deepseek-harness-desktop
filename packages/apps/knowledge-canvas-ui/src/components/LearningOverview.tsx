import { store, useLearningPaths, useProgress, useRecommendations } from '../store/canvasStore'
import { useT, resolveEntity } from '../i18n'

export function LearningOverview() {
  const { t, lang } = useT()
  const progress = useProgress()
  const paths = useLearningPaths()
  const recs = useRecommendations()

  const list = Object.values(progress)
  const mastered = list.filter((p) => p.status === 'known').length
  const learning = list.filter((p) => p.status === 'learning').length
  const gaps = list.filter((p) => p.status === 'gap').length

  const goalRec = Object.values(recs).find((r) => r.kind === 'path')
  const nextRec = Object.values(recs).find((r) => r.kind === 'next')

  const pathList = Object.values(paths)

  return (
    <div className="learning-overview">
      <div className="learning-overview__title">{t('lo.title')}</div>

      <div className="lo-goal">
        <span className="lo-goal__label">{t('lo.goalLabel')}</span>
        <span className="lo-goal__text">
          {goalRec ? resolveEntity(goalRec.title, goalRec.titleLoc, lang) : t('lo.goalDefault')}
        </span>
      </div>

      <div className="lo-stats">
        <div className="lo-stat lo-stat--known">
          <span className="lo-stat__v">{mastered}</span>
          <span className="lo-stat__l">{t('lo.known')}</span>
        </div>
        <div className="lo-stat lo-stat--learning">
          <span className="lo-stat__v">{learning}</span>
          <span className="lo-stat__l">{t('lo.learning')}</span>
        </div>
        <div className="lo-stat lo-stat--gap">
          <span className="lo-stat__v">{gaps}</span>
          <span className="lo-stat__l">{t('lo.gap')}</span>
        </div>
      </div>

      {nextRec && (
        <div className="lo-next">
          <span className="lo-next__label">{t('lo.nextLabel')}</span>
          <span className="lo-next__text">
            {resolveEntity(nextRec.description, nextRec.descriptionLoc, lang)}
          </span>
        </div>
      )}

      <div className="lo-paths">
        <div className="lo-paths__title">{t('lo.pathsTitle')}</div>
        {pathList.map((p) => (
          <button
            key={p.id}
            className="lo-path"
            onClick={() => store.setActivePath(p.id)}
          >
            <span className="lo-path__dot" />
            <span className="lo-path__name">{resolveEntity(p.title, p.titleLoc, lang)}</span>
            <span className="lo-path__count">{t('lo.nodeCount', { n: p.nodeIds.length })}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
