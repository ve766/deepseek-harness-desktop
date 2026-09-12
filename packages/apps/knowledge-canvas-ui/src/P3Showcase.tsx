import { useState } from 'react'
import { useT, useLanguagePref, setLanguage } from './i18n'
import { WelcomeDashboard } from './components/WelcomeDashboard'
import { LearningOverview } from './components/LearningOverview'
import { AIInsightPanel } from './components/AIInsightPanel'
import { ProviderStatusCard, type ProviderView } from './components/ProviderStatusCard'
import { AssociationExplainer } from './components/AssociationExplainer'
import { SAMPLE_ASSOCIATIONS } from './associationMock'
import { ProviderStatusIcon, EmployeeStatusIcon, TaskStatusIcon } from './components/morphicons'
import { AIStatusIcon } from './components/morphicons/AIStatusIcon'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { EmployeeIcon, EmployeeCard } from './components/EmployeeCard'
import { AGENTS } from './domain/agents'
import type { AgentProfile } from './types'
import type { EmployeeStatus } from './components/morphicons/states'
import { CommandCenter } from './components/CommandCenter'
import type {
  CommandCenterContext,
  CCAction,
  CCSystemEntry,
} from './components/CommandCenter'
import { Home } from './components/Home'
import type { HomeContext } from './components/Home'
import { NavigationRail } from './components/NavigationRail'
import type { NavRoute } from './components/NavigationRail'

const PROVIDERS: ProviderView[] = [
  { name: 'Ollama', subKey: 'provider.ollamaSub', status: 'online' },
  { name: 'DeepSeek Cloud', subKey: 'provider.deepseekSub', status: 'online' },
  { name: 'OpenRouter', subKey: 'provider.openrouterSub', status: 'warning' },
  { name: 'Anthropic', subKey: 'provider.anthropicSub', status: 'error' },
]

const PROVIDER: { status: string; key: string }[] = [
  { status: 'idle', key: 'status.provider.idle' },
  { status: 'connecting', key: 'status.provider.connecting' },
  { status: 'online', key: 'status.provider.online' },
  { status: 'warning', key: 'status.provider.warning' },
  { status: 'error', key: 'status.provider.error' },
]
const EMPLOYEE: { status: string; key: string }[] = [
  { status: 'idle', key: 'status.employee.idle' },
  { status: 'thinking', key: 'status.employee.thinking' },
  { status: 'working', key: 'status.employee.working' },
  { status: 'completed', key: 'status.employee.completed' },
  { status: 'offline', key: 'status.employee.offline' },
]
const TASK: { status: string; key: string }[] = [
  { status: 'queued', key: 'status.task.queued' },
  { status: 'running', key: 'status.task.running' },
  { status: 'success', key: 'status.task.success' },
  { status: 'failed', key: 'status.task.failed' },
  { status: 'cancelled', key: 'status.task.cancelled' },
]
const AI: { status: string; key: string }[] = [
  { status: 'thinking', key: 'status.ai.thinking' },
  { status: 'discovering', key: 'status.ai.discovering' },
  { status: 'building', key: 'status.ai.building' },
  { status: 'completed', key: 'status.ai.completed' },
  { status: 'failed', key: 'status.ai.failed' },
]

function MorphGrid({ title, items, kind }: { title: string; items: { status: string; key: string }[]; kind: 'p' | 'e' | 't' | 'a' }) {
  const { t } = useT()
  return (
    <section className="p3-region">
      <h2 className="p3-region__title">{title}</h2>
      <div className="p3-morph-grid">
        {items.map(it => (
          <div className="p3-morph-cell" key={it.status}>
            {kind === 'p' && <ProviderStatusIcon status={it.status} size={40} name={it.status} />}
            {kind === 'e' && <EmployeeStatusIcon status={it.status} size={40} name={it.status} />}
            {kind === 't' && <TaskStatusIcon status={it.status} size={40} name={it.status} />}
            {kind === 'a' && <AIStatusIcon status={it.status} size={40} name={it.status} />}
            <span className="p3-morph-label">{t(it.key)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

const STATUSES: EmployeeStatus[] = ['idle', 'thinking', 'working', 'completed', 'offline']

// Boundary-only agents for overflow testing. These are LOCAL showcase mocks —
// they do NOT touch the AgentProfile data layer (domain/agents.ts stays frozen).
const LONG_DOG: AgentProfile = {
  id: 'x-dog',
  name: '超级无敌研究型中华田园犬长名字压测',
  nameLoc: { 'en-US': 'Supercalifragilistic Research Dog With A Very Long Name' },
  role: '默认助手兼全栈工程师兼知识管家',
  roleLoc: { 'en-US': 'Default Assistant & Full-stack Engineer & Knowledge Steward' },
  color: '#F5A623',
  avatarUrl: '/mascots/assistant-dog-avatar.png',
}
const LONG_CAT: AgentProfile = {
  id: 'x-cat',
  name: '黑猫诺克斯超级研究代理超长',
  nameLoc: { 'en-US': 'Nox the Super Research Agent With Extended Title' },
  role: '研究型 Agent 长角色说明占位',
  roleLoc: { 'en-US': 'Research Agent With An Overly Long Role Description For Boundary Test' },
  color: '#1A1A1A',
  avatarUrl: '/mascots/nox-cat-avatar.png',
}

function EmployeeCardShowcase() {
  return (
    <section className="p3-region">
      <h2 className="p3-region__title">AI Employee Identity Unit · Employee Card</h2>

      {/* Size ladder — App-Icon layer at every dock/panel scale */}
      <div className="ec-row">
        {AGENTS.map(a => (
          <div className="ec-cell" key={a.id}>
            <EmployeeIcon agent={a} size={32} status="idle" />
            <EmployeeIcon agent={a} size={64} status="thinking" />
            <EmployeeIcon agent={a} size={160} status="working" />
          </div>
        ))}
      </div>

      {/* Status grid — every employee × every canonical status (5×5) */}
      <div className="ec-grid">
        {AGENTS.map(a =>
          STATUSES.map(s => (
            <EmployeeCard
              key={a.id + s}
              agent={a}
              status={s}
              variant="card"
              capabilities={
                a.id === 'nox'
                  ? [{ 'zh-CN': '研究', 'en-US': 'Research' }, { 'zh-CN': '写作', 'en-US': 'Writing' }]
                  : undefined
              }
              level={a.id === 'nox' ? 0.72 : undefined}
              growth={a.id === 'nox' ? { 'zh-CN': '成长中', 'en-US': 'Growing' } : undefined}
              statusPhrase={
                s === 'thinking'
                  ? { 'zh-CN': '正在整理资料…', 'en-US': 'Organizing files…' }
                  : undefined
              }
            />
          )),
        )}
      </div>

      {/* Hero — the Presence protagonist (used by Home / Showcase) */}
      <div className="ec-hero-row">
        <EmployeeCard
          agent={AGENTS[1]}
          variant="hero"
          status="working"
          statusPhrase={{ 'zh-CN': '正在为你研究行业报告', 'en-US': 'Researching industry reports for you' }}
          capabilities={[
            { 'zh-CN': '研究', 'en-US': 'Research' },
            { 'zh-CN': '写作', 'en-US': 'Writing' },
            { 'zh-CN': '分析', 'en-US': 'Analysis' },
          ]}
          level={0.82}
          growth={{ 'zh-CN': '资深', 'en-US': 'Senior' }}
        />
      </div>

      {/* Boundary — long name / long role, zh & en (no overflow allowed) */}
      <div className="ec-grid">
        <EmployeeCard
          agent={LONG_DOG}
          variant="card"
          status="working"
          capabilities={[{ 'zh-CN': '全栈', 'en-US': 'Full-stack' }, { 'zh-CN': '知识', 'en-US': 'Knowledge' }]}
          level={0.9}
        />
        <EmployeeCard agent={LONG_CAT} variant="card" status="thinking" />
      </div>
    </section>
  )
}

// ---------- B · AI Command Center showcase (mock context ONLY) ----------
// Hard red line: Command Center is a control console, NOT a chat window.
// No chat bubble / prompt input / conversation history is rendered here.
function makeCCContext(agent: AgentProfile, kind: 'floating' | 'docked'): CommandCenterContext {
  const isNox = agent.id === 'nox'
  const actions: CCAction[] = [
    {
      actionId: 'research.deep',
      label: { 'zh-CN': '启动深度研究', 'en-US': 'Launch deep research' },
      icon: '🔍',
      kind: 'primary',
    },
    {
      actionId: 'brief.export',
      label: { 'zh-CN': '导出简报', 'en-US': 'Export brief' },
      icon: '📄',
      kind: 'context',
      shortcut: '⌘E',
    },
    {
      actionId: 'memory.snapshot',
      label: { 'zh-CN': '记忆快照', 'en-US': 'Memory snapshot' },
      icon: '🧠',
      kind: 'context',
    },
  ]
  const systemEntries: CCSystemEntry[] = [
    { id: 'settings', label: { 'zh-CN': '设置', 'en-US': 'Settings' }, icon: '⚙' },
    { id: 'memory', label: { 'zh-CN': '记忆', 'en-US': 'Memory' }, icon: '💾' },
    { id: 'market', label: { 'zh-CN': '市场', 'en-US': 'Market' }, icon: '🛒' },
  ]
  return {
    project: {
      name: { 'zh-CN': 'Q3 产品规划', 'en-US': 'Q3 Product Plan' },
      phase: { 'zh-CN': '研究阶段', 'en-US': 'Research phase' },
      progress: 0.42,
    },
    employee: {
      profile: agent,
      status: isNox ? 'thinking' : 'working',
      statusPhrase: isNox
        ? { 'zh-CN': '正在整理研究资料', 'en-US': 'Organizing research material' }
        : { 'zh-CN': '正在处理日常任务', 'en-US': 'Handling daily tasks' },
      level: isNox ? 0.72 : 0.9,
    },
    // docked fixture exercises the empty-task branch; floating shows a live task
    task:
      kind === 'docked'
        ? undefined
        : {
          title: { 'zh-CN': '行业竞品分析', 'en-US': 'Competitor analysis' },
          progress: 0.35,
          status: 'running',
        },
    actions,
    systemEntries,
  }
}

function CommandCenterShowcase() {
  const floatingCtx = makeCCContext(AGENTS[1], 'floating')
  const dockedCtx = makeCCContext(AGENTS[0], 'docked')
  return (
    <section className="p3-region">
      <h2 className="p3-region__title">
        AI Command Center · B (control console, not a chat window)
      </h2>
      <div className="cc-showcase-grid">
        <div className="cc-showcase-cell" data-cc-fixture="floating">
          <CommandCenter ctx={floatingCtx} variant="floating" />
        </div>
        <div className="cc-showcase-cell" data-cc-fixture="docked">
          <CommandCenter ctx={dockedCtx} variant="docked" />
        </div>
      </div>
    </section>
  )
}

// ---------- A · AI Employee Home showcase (mock context ONLY) ----------
// Hard red line: Home is a presence lounge, NOT a chat / task-entry console.
// No prompt input / file upload / conversation history is rendered here.
function makeHomeContext(): HomeContext {
  const nox = AGENTS[1]
  const dog = AGENTS[0]
  const cat = AGENTS[2]
  const task = AGENTS[3]
  return {
    primary: {
      profile: nox,
      status: 'thinking',
      statusPhrase: { 'zh-CN': '正在为你梳理研究资料', 'en-US': 'Organizing research material for you' },
      level: 0.72,
    },
    // roster exercises the Dock's reserved states: active / working+notification /
    // idle / offline (sleeping) — visual only, no real switch in A1.
    roster: [
      { profile: nox, status: 'thinking', notification: false },
      { profile: dog, status: 'working', notification: true },
      { profile: cat, status: 'idle', notification: false },
      { profile: task, status: 'offline', notification: false },
    ],
    // A2 quick actions — entry points, NOT a task-creation console (that belongs to
    // Business Workflow Layer). primary ≤1, context ≤3. Mock only, no dispatch.
    quickActions: [
      {
        actionId: 'research.view',
        label: { 'zh-CN': '查看研究资料', 'en-US': 'View research materials' },
        icon: '📂',
        kind: 'primary',
      },
      {
        actionId: 'memory.snapshot',
        label: { 'zh-CN': '记忆快照', 'en-US': 'Memory snapshot' },
        icon: '🧠',
        kind: 'context',
      },
      {
        actionId: 'brief.export',
        label: { 'zh-CN': '导出简报', 'en-US': 'Export brief' },
        icon: '📄',
        kind: 'context',
      },
    ],
  }
}

function HomeShowcase() {
  return (
    <section className="p3-region">
      <h2 className="p3-region__title">
        AI Employee Home · A (lounge, not a dashboard — presence first)
      </h2>
      <div className="home-showcase-cell" data-home-fixture="default">
        <Home ctx={makeHomeContext()} />
      </div>
    </section>
  )
}

// ---------- A3 · Navigation Rail showcase (mock state ONLY) ----------
// Hard red lines: Rail is a system nav ("go where"); it does NOT embed Home,
// does NOT modify Home, and the CC invoke here is a reserved no-op. The rail
// renders in a RELATIVE container (D1: NOT position:fixed).
function NavigationRailShowcase() {
  const [route, setRoute] = useState<NavRoute>('home')
  const { t } = useT()
  return (
    <section className="p3-region" data-rail-fixture="default">
      <h2 className="p3-region__title">
        Navigation Rail · A3 (system nav, flat non-glass — "go where")
      </h2>
      <div className="rail-showcase">
        <NavigationRail
          activeRoute={route}
          onNavigate={setRoute}
          onCommandCenter={() => {
            /* A3: reserved no-op */
          }}
        />
        <div className="rail-showcase__stage" aria-hidden>
          <div className="rail-showcase__stage-label">{t('nav.' + route)}</div>
        </div>
      </div>
    </section>
  )
}

export function P3Showcase() {
  const { t } = useT()
  const pref = useLanguagePref()
  const [lang, setLang] = useState<'zh-CN' | 'en-US'>(pref.interfaceLanguage)

  const switchLang = (l: 'zh-CN' | 'en-US') => {
    setLang(l)
    setLanguage({ interfaceLanguage: l })
  }

  return (
    <div className="p3-root">
      <div className="p3-bar">
        <span className="p3-bar__title">{t('p3.barTitle')}</span>
        <div className="p3-bar__group">
          <span className="p3-bar__lbl">{t('p3.language')}</span>
          <button className={'p3-chip' + (lang === 'zh-CN' ? ' is-on' : '')} onClick={() => switchLang('zh-CN')} title="简体中文" aria-label="简体中文">
            ZH
          </button>
          <button className={'p3-chip' + (lang === 'en-US' ? ' is-on' : '')} onClick={() => switchLang('en-US')} title="English" aria-label="English">
            EN
          </button>
        </div>
        <div className="p3-bar__group">
          <ThemeSwitcher />
        </div>
      </div>

      <div className="p3-scroll">
        <section className="p3-region">
          <h2 className="p3-region__title">{t('dashboard.title')} · Welcome Dashboard</h2>
          <WelcomeDashboard onEnter={() => {}} />
        </section>

        <section className="p3-region">
          <h2 className="p3-region__title">Growth View · Learning Overview</h2>
          <LearningOverview />
        </section>

        <section className="p3-region">
          <h2 className="p3-region__title">Nox Insight Panel</h2>
          <AIInsightPanel />
        </section>

        <section className="p3-region">
          <h2 className="p3-region__title">Provider Status</h2>
          <ProviderStatusCard providers={PROVIDERS} />
        </section>

        <MorphGrid title="Morphicon · Provider" items={PROVIDER} kind="p" />
        <MorphGrid title="Morphicon · Employee" items={EMPLOYEE} kind="e" />
        <MorphGrid title="Morphicon · Task" items={TASK} kind="t" />
        <MorphGrid title="Morphicon · AI" items={AI} kind="a" />

        <EmployeeCardShowcase />

        <CommandCenterShowcase />

        <HomeShowcase />

        <NavigationRailShowcase />

        <section className="p3-region">
          <h2 className="p3-region__title">Association Reason Bubble</h2>
          <AssociationExplainer assoc={SAMPLE_ASSOCIATIONS[0]} />
        </section>
      </div>
    </div>
  )
}
