/**
 * P1 review harness — renders the three P1 consumer surfaces (Provider /
 * Employee / Task) plus the AI working-state layer and the AI Activity hook.
 *
 * Standalone: mounted by src/p1DemoEntry.tsx, does NOT touch main.tsx or any
 * existing route/stylesheet. Build with:
 *
 *   node build.cjs src/p1DemoEntry.tsx
 */
import { useEffect, useRef, useState } from 'react'
import { setLanguage, useLanguagePref, useT } from './i18n'
import { ProviderStatusCard } from './components/ProviderStatusCard'
import { AgentAvatar } from './components/AgentAvatar'
import { ThinkingRing } from './components/ThinkingRing'
import { AIStatusIcon } from './components/morphicons/AIStatusIcon'
import { EmployeeStatusIcon } from './components/morphicons/EmployeeStatusIcon'
import { ProviderStatusIcon } from './components/morphicons/ProviderStatusIcon'
import { TaskStatusIcon } from './components/morphicons/TaskStatusIcon'
import type {
  AIStatus,
  EmployeeStatus,
  ProviderStatus,
  TaskStatus,
} from './components/morphicons/states'
import { emitAIEvent, subscribeAIEvents, type AIEvent } from './aiActivity'
import { usePrefersReducedMotion } from './components/morphicons/usePrefersReducedMotion'
import type { AgentProfile } from './types'
import './p1Demo.css'

const PROVIDER_STATES: ProviderStatus[] = ['idle', 'connecting', 'online', 'warning', 'error']
const EMPLOYEE_STATES: EmployeeStatus[] = ['idle', 'thinking', 'working', 'completed', 'blocked']
const TASK_STATES: TaskStatus[] = ['queued', 'running', 'success', 'failed', 'cancelled']
const AI_STATES: AIStatus[] = ['thinking', 'discovering', 'building', 'completed', 'failed']

const NOX: AgentProfile = {
  id: 'nox',
  name: 'Nox',
  role: 'Research Agent',
  nameLoc: { 'en-US': 'Nox' },
  roleLoc: { 'en-US': 'Research Agent' },
  color: '#1A1A1A',
}

export function P1Demo() {
  const { t } = useT()
  const pref = useLanguagePref()
  const reduced = usePrefersReducedMotion()
  const isZh = pref.interfaceLanguage === 'zh-CN'

  const [events, setEvents] = useState<AIEvent[]>([])
  const seqRef = useRef(0)

  useEffect(() => subscribeAIEvents((e) => setEvents((prev) => [e, ...prev].slice(0, 12))), [])

  const simulateNox = () => {
    const steps: Array<{ status: AIStatus; action: string; reason: string }> = [
      { status: 'thinking', action: 'analyze', reason: '读取导入的 24 篇文档' },
      { status: 'discovering', action: 'relate', reason: '发现「Agent Memory」与「上下文压缩」共同出现 11 次' },
      { status: 'building', action: 'map', reason: '建立知识地图：6 个簇，23 条关系' },
      { status: 'completed', action: 'done', reason: '知识地图就绪，可在 Galaxy 中查看' },
    ]
    steps.forEach((s, i) => {
      window.setTimeout(() => {
        emitAIEvent({
          agent: 'nox',
          action: t('p1.action') + ' · ' + s.action,
          status: s.status,
          reason: s.reason,
        })
        seqRef.current += 1
      }, i * 360)
    })
  }

  return (
    <div className="p1">
      <header className="p1__head">
        <div>
          <h1 className="p1__title">{t('p1.title')}</h1>
          <p className="p1__sub">{t('p1.subtitle')}</p>
        </div>
        <div className="p1__head-right">
          <span className="p1__lang-label">{t('morph.demo.lang')}</span>
          <div className="p1__seg">
            <button
              type="button"
              className={isZh ? 'p1__seg-btn is-on' : 'p1__seg-btn'}
              onClick={() => setLanguage({ interfaceLanguage: 'zh-CN', locale: 'zh-CN' })}
            >
              简体中文
            </button>
            <button
              type="button"
              className={!isZh ? 'p1__seg-btn is-on' : 'p1__seg-btn'}
              onClick={() => setLanguage({ interfaceLanguage: 'en-US', locale: 'en-US' })}
            >
              English
            </button>
          </div>
          <span className={reduced ? 'p1__reduced is-on' : 'p1__reduced'}>
            {reduced ? t('morph.demo.reducedOn') : t('morph.demo.reducedOff')}
          </span>
        </div>
      </header>

      {/* ---- Provider: real consumer card ---- */}
      <section className="p1__card">
        <h2 className="p1__h2">{t('p1.provider')}</h2>
        <div className="p1__grid">
          {PROVIDER_STATES.map((s) => (
            <div className="p1__cell" key={s}>
              <ProviderStatusIcon status={s} size={40} name={t('status.provider.' + s)} />
              <span className="p1__label">{t('status.provider.' + s)}</span>
              <code className="p1__code">{s}</code>
            </div>
          ))}
        </div>
        <div className="p1__providers">
          <ProviderStatusCard />
        </div>
      </section>

      {/* ---- Employee: avatar badge + bare icon ---- */}
      <section className="p1__card">
        <h2 className="p1__h2">{t('p1.employee')}</h2>
        <div className="p1__grid">
          {EMPLOYEE_STATES.map((s) => (
            <div className="p1__cell" key={s}>
              <AgentAvatar agent={NOX} size={56} status={s} />
              <span className="p1__label">{t('status.employee.' + s)}</span>
              <code className="p1__code">{s}</code>
            </div>
          ))}
        </div>
        <div className="p1__row">
          {EMPLOYEE_STATES.map((s) => (
            <div className="p1__cell p1__cell--bare" key={s}>
              <EmployeeStatusIcon status={s} size={36} name={NOX.name} />
              <span className="p1__label">{t('status.employee.' + s)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Task: inline status ---- */}
      <section className="p1__card">
        <h2 className="p1__h2">{t('p1.task')}</h2>
        <div className="p1__grid">
          {TASK_STATES.map((s) => (
            <div className="p1__cell" key={s}>
              <TaskStatusIcon status={s} size={40} />
              <span className="p1__label">{t('status.task.' + s)}</span>
              <code className="p1__code">{s}</code>
            </div>
          ))}
        </div>
      </section>

      {/* ---- AI working loop: replaces the old spinner ---- */}
      <section className="p1__card">
        <h2 className="p1__h2">{t('p1.ai')}</h2>
        <div className="p1__grid">
          {AI_STATES.map((s) => (
            <div className="p1__cell" key={s}>
              <ThinkingRing status={s} size={48} />
              <span className="p1__label">{t('status.ai.' + s)}</span>
              <code className="p1__code">{s}</code>
            </div>
          ))}
        </div>
        <div className="p1__row">
          {AI_STATES.map((s) => (
            <div className="p1__cell p1__cell--bare" key={s}>
              <AIStatusIcon status={s} size={28} />
              <span className="p1__label">{t('status.ai.' + s)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- AI Activity Timeline hook (data only) ---- */}
      <section className="p1__card">
        <div className="p1__timeline-head">
          <h2 className="p1__h2">{t('p1.timeline')}</h2>
          <button type="button" className="p1__emit" onClick={simulateNox}>
            {t('p1.emit')}
          </button>
        </div>
        <p className="p1__hint">{t('p1.timelineHint')}</p>
        <div className="p1__events">
          {events.length === 0 && <span className="p1__empty">—</span>}
          {events.map((e) => (
            <div className="p1__event" key={e.id}>
              <span className="p1__event-state">
                <AIStatusIcon status={e.status as AIStatus} size={18} />
              </span>
              <span className="p1__event-agent">{t('p1.agent')}: {e.agent}</span>
              <span className="p1__event-action">{e.action}</span>
              <span className="p1__event-reason">
                {t('p1.reason')}: {e.reason}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
