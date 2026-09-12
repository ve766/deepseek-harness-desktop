import { useEffect, useState } from 'react'
import type { MemoryEntry } from '../types'
import { store, useAiState, useAiStage, useInsight, useMode, useNodes } from '../store/canvasStore'
import { STAGE_LABEL } from '../aiStages'
import { useT, resolveEntity } from '../i18n'
import { AGENT_MAP } from '../domain/agents'
import { ThinkingRing } from './ThinkingRing'
import { ProviderStatusCard } from './ProviderStatusCard'
import { NoxGapCard } from './NoxGapCard'
import { NoxResearchPanel } from './NoxResearchPanel'
import { runImportDemo, endDemo, useDemoActive } from '../demo/sequencer'

export function AIInsightPanel() {
  const { t, lang } = useT()
  const aiState = useAiState()
  const aiStage = useAiStage()
  const insight = useInsight()
  const mode = useMode()
  const nodes = useNodes()
  const inferring = aiState === 'inferring'
  const demoActive = useDemoActive()

  const cMemory = nodes['c-memory']
  const videoNode = nodes['video-onboarding']

  const agentName = (id: string) => {
    const a = AGENT_MAP[id]
    return a ? resolveEntity(a.name, a.nameLoc, lang) : id
  }

  const ACTIONS: { id: string; label: string; agent: string; run: () => void }[] = [
    { id: 'research', label: t('action.research'), agent: agentName('nox'), run: () => runImportDemo() },
    {
      id: 'summary',
      label: t('action.summary'),
      agent: agentName('assistant'),
      run: () => store.setInsight({ tone: 'success', text: 'insight.summaryDone' }),
    },
    {
      id: 'task',
      label: t('action.task'),
      agent: agentName('task'),
      run: () => store.setInsight({ tone: 'success', text: 'insight.taskDone' }),
    },
    {
      id: 'memory',
      label: t('action.memory'),
      agent: agentName('knowledge'),
      run: () => store.setInsight({ tone: 'success', text: 'insight.memoryDone' }),
    },
  ]

  // Growth mode: Nox acts as Personal Knowledge Navigator (gap-driven).
  if (mode === 'growth') {
    return (
      <aside className="insight">
        <div className="insight__header">{t('insight.growthHeader')}</div>
        <div className="insight__body">
          {inferring ? (
            <div className="insight__thinking">
              <ThinkingRing />
              <div className="insight__thinking-text">
                <div className="insight__thinking-title">
                  {aiStage ? t(STAGE_LABEL[aiStage]) : t('insight.growthThinkingDefault')}
                </div>
                <div className="insight__thinking-sub">{t('insight.growthThinkingSub')}</div>
              </div>
            </div>
          ) : insight ? (
            <div className={'insight__msg insight__msg--' + insight.tone}>{t(insight.text as Parameters<typeof t>[0])}</div>
          ) : (
            <div className="insight__discovery">
              <div className="insight__discovery-head">
                <span className="insight__discovery-spark">✨</span> {t('insight.growthDiscovery')}
              </div>
              <div className="insight__discovery-text">
                {t('insight.growthDiscoveryText', {
                  concept: cMemory
                    ? resolveEntity(cMemory.title, cMemory.titleLoc, lang)
                    : 'Memory Architecture',
                })}
              </div>
            </div>
          )}
        </div>
        <NoxGapCard />
        <NoxResearchPanel />
        {demoActive && (
          <div className="insight__section">
            <div className="insight__section-title">{t('demo.growthHint')}</div>
            <div className="insight__cta">
              <button className="cta" onClick={endDemo}>
                <span className="cta__label">{t('demo.exit')}</span>
                <span className="cta__agent">×</span>
              </button>
            </div>
          </div>
        )}
        <ProviderStatusCard />
      </aside>
    )
  }

  return (
    <aside className="insight">
      <div className="insight__header">{t('insight.header')}</div>

      <div className="insight__body">
        {inferring ? (
          <div className="insight__thinking">
            <ThinkingRing />
            <div className="insight__thinking-text">
              <div className="insight__thinking-title">
                {aiStage ? t(STAGE_LABEL[aiStage]) : t('insight.thinkingDefault')}
              </div>
              <div className="insight__thinking-sub">{t('insight.thinkingSub')}</div>
            </div>
          </div>
        ) : insight ? (
          <div className={'insight__msg insight__msg--' + insight.tone}>{t(insight.text as Parameters<typeof t>[0])}</div>
        ) : (
          <div className="insight__discovery">
            <div className="insight__discovery-head">
              <span className="insight__discovery-spark">✨</span> {t('insight.discovery')}
            </div>
            <div className="insight__discovery-text">
              {t('insight.discoveryText', {
                video: videoNode
                  ? resolveEntity(videoNode.title, videoNode.titleLoc, lang)
                  : 'New User Onboarding Recording',
              })}
            </div>
          </div>
        )}
      </div>

      <div className="insight__section">
        <div className="insight__section-title">{t('insight.suggest')}</div>
        <div className="insight__cta">
          {ACTIONS.map(a => (
            <button key={a.id} className="cta" onClick={a.run}>
              <span className="cta__label">{a.label}</span>
              <span className="cta__agent">{a.agent}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="insight__section">
        <div className="insight__section-title">{t('insight.memory')}</div>
        <MemorySummary />
      </div>

      {demoActive && !inferring && (
        <div className="insight__section">
          <div className="insight__section-title">{t('demo.spaceDone')}</div>
          <div className="insight__cta">
            <button className="cta" onClick={() => store.setMode('growth')}>
              <span className="cta__label">{t('demo.growthCta')}</span>
              <span className="cta__agent">→</span>
            </button>
          </div>
        </div>
      )}

      <ProviderStatusCard />
    </aside>
  )
}

function MemorySummary() {
  const { t, lang } = useT()
  const [items, setItems] = useState<MemoryEntry[]>([])
  useEffect(() => {
    let alive = true
    store.backend.getMemory().then((m) => {
      if (alive) setItems(m)
    })
    return () => {
      alive = false
    }
  }, [])
  return (
    <ul className="memory-list">
      {items.map(m => (
        <li key={m.id} className={'memory-item memory-item--' + m.category}>
          <span className="memory-item__tag">{t('memory.' + m.category)}</span>
          <span className="memory-item__text">{resolveEntity(undefined, m.text, lang)}</span>
        </li>
      ))}
    </ul>
  )
}
