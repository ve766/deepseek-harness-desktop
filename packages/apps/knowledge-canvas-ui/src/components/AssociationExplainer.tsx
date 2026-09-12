import { useEffect, useRef, useState } from 'react'
import { useT, resolveEntity } from '../i18n'
import { usePrefersReducedMotion } from './morphicons/usePrefersReducedMotion'
import type { Association } from '../associationMock'
import './AssociationExplainer.css'

// Sequence the AI association explanation plays through:
//   source node  ──pulse──▶  edge reveal  ──▶  target ripple  ──▶  reason bubble
type Stage = 'pulse' | 'reveal' | 'ripple' | 'reason'

const STAGE_ORDER: Stage[] = ['pulse', 'reveal', 'ripple', 'reason']
// Cumulative timeline (ms). The reason bubble is the resting/terminal state.
const STAGE_AT: Record<Stage, number> = { pulse: 0, reveal: 700, ripple: 1500, reason: 2200 }

const ACCENT: Record<string, string> = {
  concept: '#5e5ce6',
  skill: '#0a84ff',
  memory: '#34c759',
  task: '#ff9f0a',
  learningPath: '#ff375f',
  document: '#8e8e93',
  video: '#ff375f',
  conversation: '#5e5ce6',
  project: '#0a84ff',
}

/**
 * Visualizes HOW the AI decided two knowledge units are related — not a graph
 * feature. The four-stage animation makes the association *explainable*:
 * the source emits a pulse, the link draws in, the target ripples, and the
 * reason (with confidence + relationship type) is surfaced as a bubble.
 *
 * Reduced-motion: everything is shown immediately and statically — the
 * explanation is carried by shape + text + colour, never by motion.
 */
export function AssociationExplainer({ assoc }: { assoc: Association }) {
  const { t, lang } = useT()
  const reduced = usePrefersReducedMotion()
  const [stage, setStage] = useState<Stage>(reduced ? 'reason' : 'pulse')
  const timers = useRef<number[]>([])

  useEffect(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (reduced) {
      setStage('reason')
      return
    }
    setStage('pulse')
    timers.current.push(window.setTimeout(() => setStage('reveal'), STAGE_AT.reveal))
    timers.current.push(window.setTimeout(() => setStage('ripple'), STAGE_AT.ripple))
    timers.current.push(window.setTimeout(() => setStage('reason'), STAGE_AT.reason))
    return () => timers.current.forEach(clearTimeout)
  }, [assoc.id, reduced])

  const reached = (s: Stage) => STAGE_ORDER.indexOf(s) <= STAGE_ORDER.indexOf(stage)
  const kindLabel = (k: string) => t(('kind.' + k) as Parameters<typeof t>[0])
  const nodeTitle = (n: Association['source']) =>
    n.titleLoc ? resolveEntity(n.title, n.titleLoc, lang) : n.title

  return (
    <div
      className={'assoc assoc--' + stage + (reduced ? ' assoc--reduced' : '')}
      style={{ ['--accent' as string]: ACCENT[assoc.source.kind] ?? '#8e8e93' }}
    >
      <div className="assoc__head">
        <span className="assoc__badge">{t('association.source')}</span>
        <span className="assoc__arrow">→</span>
        <span className="assoc__badge">{t('association.target')}</span>
        <span className="assoc__stage">{t(('association.stage.' + stage) as Parameters<typeof t>[0])}</span>
      </div>

      <div className="assoc__stage-area">
        <div className={'assoc__node assoc__node--source kind-' + assoc.source.kind}>
          <span className="assoc__pulse" aria-hidden />
          <div className="assoc__node-body">
            <div className="assoc__node-kind">{kindLabel(assoc.source.kind)}</div>
            <div className="assoc__node-title">{nodeTitle(assoc.source)}</div>
          </div>
        </div>

        <svg className="assoc__edge" viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden>
          <path className="assoc__edge-line" d="M 2 40 C 70 2, 130 78, 198 40" pathLength={1} fill="none" />
        </svg>

        <div className={'assoc__node assoc__node--target kind-' + assoc.target.kind}>
          <span className="assoc__ripple" aria-hidden />
          <div className="assoc__node-body">
            <div className="assoc__node-kind">{kindLabel(assoc.target.kind)}</div>
            <div className="assoc__node-title">{nodeTitle(assoc.target)}</div>
          </div>
        </div>
      </div>

      <div className="assoc__reason" aria-live="polite">
        <div className="assoc__reason-why">{t('association.why')}</div>
        <div className="assoc__reason-text">{t(assoc.reasonKey as Parameters<typeof t>[0])}</div>
        <div className="assoc__reason-meta">
          <span className="assoc__chip">
            {t(('association.rel.' + assoc.relationship) as Parameters<typeof t>[0])}
          </span>
          <span className="assoc__conf">
            <span className="assoc__conf-label">{t('association.confidence')}</span>
            <span className="assoc__conf-bar">
              <span
                className="assoc__conf-fill"
                style={{ width: Math.round(assoc.confidence * 100) + '%' }}
              />
            </span>
            <span className="assoc__conf-val">{Math.round(assoc.confidence * 100)}%</span>
          </span>
        </div>
      </div>
    </div>
  )
}
