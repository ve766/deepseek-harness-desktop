import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { TitleBar } from './TitleBar'
import { NavigationRail } from './NavigationRail'
import type { NavRoute } from './NavigationRail'
import { AIInsightPanel } from './AIInsightPanel'
import { Home } from './Home'
import type { HomeContext } from './Home'
import { CommandCenter } from './CommandCenter'
import type { CommandCenterContext } from './CommandCenter'
import { AGENTS, AGENT_MAP } from '../domain/agents'
import type { AgentId, LocText } from '../types'
import { useT } from '../i18n'
import { EmployeeCenter } from './EmployeeCenter'
import type { EmployeeCenterContext } from './EmployeeCenter'
import { EmployeeDetail } from './EmployeeDetail'
import type { EmployeeDetailContext, EmployeeDetailGrowthItem } from './EmployeeDetail'
import type { EmployeeStatus } from './morphicons/states'
// Stage 4: Shared Knowledge Universe architecture seam (D2 module singleton).
// Imported here only to declare the universe entry is mounted; no knowledge
// props are passed to any surface (seam-only, per approved Stage 4 plan).
import { getSharedUniverse } from '../knowledge/knowledgeUniverse'
// Stage 5: Shared Knowledge Space — wraps the reused canvas (children) and adds
// the read-only knowledge-graph identity layer. Wrapping only (D1): the canvas
// capability is reused, not rewritten; no new Rail item, no new surface roots.
import { SharedKnowledgeSpace } from './SharedKnowledgeSpace'

/* ============================================================
 * MacWindowShell — real App Shell.
 *
 * Shell Integration (A3 → real shell): replaces the wide glass SideNav
 * with the flat non-glass Navigation Rail. Holds the surface-switch state
 * (`activeRoute`) and the CommandCenter invoke state (`ccOpen`).
 *
 * Red lines (per Shell Integration Mini Plan, approved):
 *   - Rail is flat non-glass (handled inside NavigationRail.css).
 *   - `knowledge` route reuses `children` (the entered-gated canvas), so the
 *     existing WelcomeDashboard ↔ CanvasRegion gateway is preserved untouched.
 *   - `home` mounts the existing <Home /> — mount only, NO internal refactor,
 *     NO Runtime, NO workflow.
 *   - employees/memory/projects/settings are inert placeholders (do NOT claim
 *     functionality that does not exist). marketplace stays disabled in Rail.
 *   - CommandCenter is mounted by the SHELL (not by Rail): Rail CC button →
 *     ccOpen → floating overlay (role=dialog + Esc + focus return). CC internal
 *     component is NOT modified; no chat/prompt/command-runtime/workflow.
 *   - SideNav is NOT deleted (kept as rollback fallback); App.tsx is untouched;
 *     no router library is introduced.
 * ============================================================ */

// ---- mock contexts (mirror P3Showcase fixtures; Home/CommandCenter are
// presentation-only and require a context object). Kept local to the shell so
// P3Showcase is not modified. ----

// Per-agent presentation state (mock only — display, never data-layer).
// Mirrors P3Showcase fixtures; D2 lets the focused employee drive Home's primary.
const SHELL_AGENT_STATE: Record<AgentId, { status: EmployeeStatus; notification: boolean; statusPhrase: LocText }> = {
  assistant: {
    status: 'working',
    notification: true,
    statusPhrase: { 'zh-CN': '正在处理你的日常请求', 'en-US': 'Handling your everyday requests' },
  },
  nox: {
    status: 'thinking',
    notification: false,
    statusPhrase: { 'zh-CN': '正在为你梳理研究资料', 'en-US': 'Organizing research material for you' },
  },
  knowledge: {
    status: 'idle',
    notification: false,
    statusPhrase: { 'zh-CN': '已就绪，随时为你整理知识', 'en-US': 'Ready to organize your knowledge' },
  },
  task: {
    status: 'offline',
    notification: false,
    statusPhrase: { 'zh-CN': '当前离线', 'en-US': 'Currently offline' },
  },
}

function makeShellHomeCtx(focusedId: AgentId = 'nox'): HomeContext {
  const primaryId = AGENT_MAP[focusedId] ? focusedId : 'nox'
  const pm = SHELL_AGENT_STATE[primaryId]
  return {
    primary: {
      profile: AGENT_MAP[primaryId],
      status: pm.status,
      statusPhrase: pm.statusPhrase,
      level: 0.72,
    },
    // roster order is fixed (nox / dog / cat / task) — only `primary` tracks focus,
    // so the Dock's reserved states (active / working+notify / idle / offline) stay
    // stable. Home internal code is NOT modified.
    roster: (['nox', 'assistant', 'knowledge', 'task'] as AgentId[]).map(id => ({
      profile: AGENT_MAP[id],
      status: SHELL_AGENT_STATE[id].status,
      notification: SHELL_AGENT_STATE[id].notification,
    })),
    quickActions: [
      { actionId: 'research.view', label: { 'zh-CN': '查看研究资料', 'en-US': 'View research materials' }, icon: '📂', kind: 'primary' },
      { actionId: 'memory.snapshot', label: { 'zh-CN': '记忆快照', 'en-US': 'Memory snapshot' }, icon: '🧠', kind: 'context' },
      { actionId: 'brief.export', label: { 'zh-CN': '导出简报', 'en-US': 'Export brief' }, icon: '📄', kind: 'context' },
    ],
  }
}

// Mock static capability labels + mastery (Stage 2-A D3: NO real capability
// probing, NO Registry/Manager). Bilingual display-only hints.
const SHELL_EMP_CAPS: Record<AgentId, LocText[]> = {
  assistant: [
    { 'zh-CN': '日常助理', 'en-US': 'Daily Assistant' },
    { 'zh-CN': '任务编排', 'en-US': 'Task Orchestration' },
    { 'zh-CN': '信息检索', 'en-US': 'Information Retrieval' },
  ],
  nox: [
    { 'zh-CN': '深度研究', 'en-US': 'Deep Research' },
    { 'zh-CN': '资料综述', 'en-US': 'Literature Review' },
    { 'zh-CN': '趋势分析', 'en-US': 'Trend Analysis' },
  ],
  knowledge: [
    { 'zh-CN': '知识整理', 'en-US': 'Knowledge Organizing' },
    { 'zh-CN': '文档摘要', 'en-US': 'Document Summarization' },
    { 'zh-CN': '标签分类', 'en-US': 'Tag Classification' },
  ],
  task: [
    { 'zh-CN': '流程执行', 'en-US': 'Workflow Execution' },
    { 'zh-CN': '定时任务', 'en-US': 'Scheduled Tasks' },
    { 'zh-CN': '状态监控', 'en-US': 'Status Monitoring' },
  ],
}

const SHELL_EMP_LEVEL: Record<AgentId, number> = {
  assistant: 0.82,
  nox: 0.72,
  knowledge: 0.68,
  task: 0.61,
}

function makeShellEmployeeCtx(focusedId: AgentId): EmployeeCenterContext {
  const activeId = AGENT_MAP[focusedId] ? focusedId : 'nox'
  return {
    activeId,
    entries: AGENTS.map((p) => {
      const st = SHELL_AGENT_STATE[p.id]
      return {
        profile: p,
        status: st.status,
        statusPhrase: st.statusPhrase,
        level: SHELL_EMP_LEVEL[p.id],
        capabilities: SHELL_EMP_CAPS[p.id],
      }
    }),
  }
}

// Mock growth timeline (Stage 3 D2: NO Task History / Memory query / real probing).
// Bilingual, display-only. Shared structure, agent-flavored detail lines.
function gd(zhP: string, enP: string, zhD: string, enD: string): EmployeeDetailGrowthItem {
  return {
    phase: { 'zh-CN': zhP, 'en-US': enP },
    detail: { 'zh-CN': zhD, 'en-US': enD },
  }
}

const SHELL_EMP_GROWTH: Record<AgentId, EmployeeDetailGrowthItem[]> = {
  assistant: [
    gd('入职引导', 'Onboarding', '完成基础环境接入与身份绑定', 'Completed base environment setup and identity binding'),
    gd('能力认证', 'Capability certified', '通过日常助理核心能力评估', 'Passed core daily-assistant capability assessment'),
    gd('独立交付', 'Independent delivery', '开始独立处理日常请求', 'Began handling everyday requests independently'),
  ],
  nox: [
    gd('入职引导', 'Onboarding', '接入研究知识库与检索通道', 'Connected to research knowledge base and retrieval'),
    gd('能力认证', 'Capability certified', '通过深度研究能力评估', 'Passed deep-research capability assessment'),
    gd('独立交付', 'Independent delivery', '主导首个行业研究简报', 'Led the first industry research brief'),
  ],
  knowledge: [
    gd('入职引导', 'Onboarding', '完成文档与标签体系接入', 'Connected document and tagging systems'),
    gd('能力认证', 'Capability certified', '通过知识整理能力评估', 'Passed knowledge-organizing capability assessment'),
    gd('独立交付', 'Independent delivery', '开始独立归档知识条目', 'Began archiving knowledge entries independently'),
  ],
  task: [
    gd('入职引导', 'Onboarding', '接入流程编排引擎', 'Connected the workflow orchestration engine'),
    gd('能力认证', 'Capability certified', '通过定时任务能力评估', 'Passed scheduled-task capability assessment'),
    gd('独立交付', 'Independent delivery', '开始独立执行批处理任务', 'Began executing batch tasks independently'),
  ],
}

function makeShellEmployeeDetailCtx(id: AgentId): EmployeeDetailContext {
  const profile = AGENT_MAP[id]
  const st = SHELL_AGENT_STATE[id]
  return {
    profile,
    status: st.status,
    statusPhrase: st.statusPhrase,
    capabilities: SHELL_EMP_CAPS[id],
    level: SHELL_EMP_LEVEL[id],
    growth: SHELL_EMP_GROWTH[id],
  }
}

function makeShellCCCtx(): CommandCenterContext {
  const nox = AGENTS[1]
  return {
    project: {
      name: { 'zh-CN': 'Q3 产品规划', 'en-US': 'Q3 Product Plan' },
      phase: { 'zh-CN': '研究阶段', 'en-US': 'Research phase' },
      progress: 0.42,
    },
    employee: {
      profile: nox,
      status: 'thinking',
      statusPhrase: { 'zh-CN': '正在整理研究资料', 'en-US': 'Organizing research material' },
      level: 0.72,
    },
    task: {
      title: { 'zh-CN': '行业竞品分析', 'en-US': 'Competitor analysis' },
      progress: 0.35,
      status: 'running',
    },
    actions: [
      { actionId: 'research.deep', label: { 'zh-CN': '启动深度研究', 'en-US': 'Launch deep research' }, icon: '🔍', kind: 'primary' },
      { actionId: 'brief.export', label: { 'zh-CN': '导出简报', 'en-US': 'Export brief' }, icon: '📄', kind: 'context', shortcut: '⌘E' },
      { actionId: 'memory.snapshot', label: { 'zh-CN': '记忆快照', 'en-US': 'Memory snapshot' }, icon: '🧠', kind: 'context' },
    ],
    systemEntries: [
      { id: 'settings', label: { 'zh-CN': '设置', 'en-US': 'Settings' }, icon: '⚙' },
      { id: 'memory', label: { 'zh-CN': '记忆', 'en-US': 'Memory' }, icon: '💾' },
      { id: 'market', label: { 'zh-CN': '市场', 'en-US': 'Market' }, icon: '🛒' },
    ],
  }
}

// ---- CommandCenter floating overlay (Shell-owned wrapper, D4) ----
// role=dialog + aria-modal + Esc close + overlay (scrim) close + focus return
// to the trigger. The CommandCenter component itself is unchanged.
function CommandCenterOverlay({
  ctx,
  onClose,
}: {
  ctx: CommandCenterContext
  onClose: () => void
}) {
  const { t } = useT()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])

  return (
    <div
      className="command-center-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="command-center-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('cc.title')}
        tabIndex={-1}
        ref={panelRef}
      >
        <CommandCenter ctx={ctx} variant="floating" />
      </div>
    </div>
  )
}

// ---- inert placeholder for not-yet-built surfaces (D1: employees keeps its
// entry + placeholder; memory/projects/settings similarly do NOT claim function) ----
function InertSurface({ route }: { route: NavRoute }) {
  const { t } = useT()
  return (
    <section className="shell-surface shell-surface--placeholder" aria-label={t('nav.' + route)}>
      <div className="shell-surface__title">{t('nav.' + route)}</div>
    </section>
  )
}

export function MacWindowShell({ children }: { children: ReactNode }) {
  const [activeRoute, setActiveRoute] = useState<NavRoute>('knowledge')
  const [ccOpen, setCcOpen] = useState(false)
  // D2: focusedId is the single source of truth for "which employee is primary".
  // Employee Center selects; Home renders the focused employee's presence.
  const [focusedId, setFocusedId] = useState<AgentId>('nox')
  // Stage 3 D4: employees-route drill-down. `detailId` is the single source of
  // truth for "which profile is open"; stays within the employees route (no
  // overlay, no Rail change).
  const [detailId, setDetailId] = useState<AgentId | null>(null)

  // Stage 4 (D2): declare the Shared Knowledge Universe entry is mounted. Pure
  // infrastructure seam — does not pass any knowledge props into a surface, and
  // getSharedUniverse() is a module singleton (no React Provider/Context).
  useEffect(() => {
    getSharedUniverse()
  }, [])

  // D1: selecting an employee in the Center focuses it AND returns to Home
  // (the presence lounge). Mock-only — no Runtime / data layer involved.
  const handleOpenEmployee = (id: string) => {
    if (AGENT_MAP[id]) setFocusedId(id as AgentId)
    setActiveRoute('home')
  }

  // D1 (Detail entry): open the drill-down profile, staying on the employees route.
  const handleOpenDetail = (id: string) => {
    if (AGENT_MAP[id]) setDetailId(id as AgentId)
  }

  // D3: back from detail clears detailId → returns to Employee Center; the
  // employees route keeps its Rail highlight. Does NOT go to Home.
  const handleBackFromDetail = () => {
    setDetailId(null)
  }

  let surface: ReactNode
  switch (activeRoute) {
    case 'home':
      // D3: mount the existing Home only — no internal refactor / Runtime / workflow.
      // D2: focusedId drives Home's primary employee (presence lounge).
      surface = (
        <div className="shell-surface">
          <Home ctx={makeShellHomeCtx(focusedId)} />
        </div>
      )
      break
    case 'employees':
      // Stage 2-A + Stage 3: real Employee Center surface, with Stage 3 drill-down.
      // D4: within the employees route, `detailId` switches to <EmployeeDetail>
      // (surface swap, NOT an overlay). No chat / prompt / Runtime / Registry.
      surface = (
        <div className="shell-surface">
          {detailId ? (
            <EmployeeDetail
              ctx={makeShellEmployeeDetailCtx(detailId)}
              onBack={handleBackFromDetail}
            />
          ) : (
            <EmployeeCenter
              ctx={makeShellEmployeeCtx(focusedId)}
              onOpenEmployee={handleOpenEmployee}
              onOpenDetail={handleOpenDetail}
            />
          )}
        </div>
      )
      break
    case 'memory':
    case 'projects':
    case 'settings':
      surface = <InertSurface route={activeRoute} />
      break
    default:
      // knowledge (and any fallback): the Shared Knowledge Space — wrap the
      // entered-gated canvas (children) in the read-only identity layer. D1:
      // wraps & reuses the canvas; does NOT rewrite it or add a new Rail item.
      surface = <SharedKnowledgeSpace>{children}</SharedKnowledgeSpace>
  }

  return (
    <div className="shell">
      <TitleBar />
      <NavigationRail
        activeRoute={activeRoute}
        onNavigate={setActiveRoute}
        onCommandCenter={() => setCcOpen(o => !o)}
      />
      <main className="canvas-region-host">{surface}</main>
      <AIInsightPanel />
      {ccOpen && (
        <CommandCenterOverlay ctx={makeShellCCCtx()} onClose={() => setCcOpen(false)} />
      )}
    </div>
  )
}
