import type { KnowledgeNode } from '../types'
import { useProgress } from '../store/canvasStore'
import { useT, resolveEntity } from '../i18n'
import { MasteryRing } from './MasteryRing'

const KIND_META: Record<string, { icon: string; accent: string }> = {
  concept: { icon: '✸', accent: '#5e5ce6' },
  skill: { icon: '✦', accent: '#0a84ff' },
  memory: { icon: '❖', accent: '#34c759' },
  task: { icon: '✓', accent: '#ff9f0a' },
  learningPath: { icon: '⟿', accent: '#ff375f' },
  document: { icon: '▤', accent: '#8e8e93' },
  video: { icon: '▶', accent: '#ff375f' },
  conversation: { icon: '💬', accent: '#5e5ce6' },
  project: { icon: '◈', accent: '#0a84ff' },
}

const STATUS_CLS: Record<string, string> = {
  known: 'gnode__status--known',
  learning: 'gnode__status--learning',
  gap: 'gnode__status--gap',
}

export function GalaxyNode({ node, index = 0 }: { node: KnowledgeNode; index?: number }) {
  const { t, lang } = useT()
  const progress = useProgress()
  const meta = KIND_META[node.kind] ?? KIND_META.concept
  const p = progress[node.id]
  const mastery = node.concept?.mastery ?? p?.mastery ?? 0
  const status = p?.status ?? (mastery >= 0.8 ? 'known' : mastery > 0 ? 'learning' : 'gap')
  const isAbstract = node.kind === 'concept' || node.kind === 'skill'

  return (
    <div
      className={'gnode gnode--' + node.kind + (node.concept?.aiSuggestion ? ' gnode--ai' : '')}
      style={{
        left: node.position.x,
        top: node.position.y,
        ['--accent' as string]: meta.accent,
        animationDelay: `${Math.min(index, 12) * 45}ms`,
      }}
    >
      <div className="gnode__head">
        <span className="gnode__icon">{meta.icon}</span>
        <span className="gnode__kind">{t('kind.' + node.kind)}</span>
        {isAbstract && (
          <span className={'gnode__status ' + (STATUS_CLS[status] ?? '')}>{t('status.' + status)}</span>
        )}
      </div>
      <div className="gnode__title">{resolveEntity(node.title, node.titleLoc, lang)}</div>

      {node.concept?.description && (
        <div className="gnode__desc">
          {resolveEntity(node.concept.description, node.concept.descriptionLoc, lang)}
        </div>
      )}

      {isAbstract && (
        <div className="gnode__foot">
          <div className="gnode__sugg">
            {node.concept?.aiSuggestion ? (
              <span className="gnode__sugg-text">
                💡 {resolveEntity(node.concept.aiSuggestion, node.concept.aiSuggestionLoc, lang)}
              </span>
            ) : (
              <span className="gnode__sugg-empty">{t('gnode.suggEmpty')}</span>
            )}
          </div>
          <MasteryRing value={mastery} status={status} size={42} label={t('gnode.masteryLabel')} />
        </div>
      )}

      {node.concept?.nextAction && (
        <div className="gnode__next">
          {t('gnode.next')}
          {resolveEntity(node.concept.nextAction, node.concept.nextActionLoc, lang)}
        </div>
      )}
    </div>
  )
}
