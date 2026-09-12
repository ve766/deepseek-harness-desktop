// Moved from `mock/agents.ts` in P2-1: the employee roster is domain data
// (`AgentId` lives in `types.ts` and is used as `ownerAgent` on nodes), not fixture.
import type { AgentProfile } from '../types'

// Only `assistant` (中华田园犬) and `nox` (黑猫 Research Agent) have master/avatar
// PNGs in the repo's mascot assets. The other two render a CSS placeholder until
// their master/avatar assets are confirmed (Mascot visual system v1.0: no ImageGen
// re-draw, same visual family, master-confirmed before expanding).
export const AGENTS: AgentProfile[] = [
  {
    id: 'assistant',
    name: '田园犬',
    nameLoc: { 'en-US': 'Doge' },
    role: '默认助手',
    roleLoc: { 'en-US': 'Default Assistant' },
    color: '#F5A623',
    avatarUrl: '/mascots/assistant-dog-avatar.png',
  },
  {
    id: 'nox',
    name: '黑猫 Nox',
    nameLoc: { 'en-US': 'Nox' },
    role: '研究型 Agent',
    roleLoc: { 'en-US': 'Research Agent' },
    color: '#1A1A1A',
    avatarUrl: '/mascots/nox-cat-avatar.png',
  },
  {
    id: 'knowledge',
    name: '布偶猫',
    nameLoc: { 'en-US': 'Ragdoll Cat' },
    role: '知识管家',
    roleLoc: { 'en-US': 'Knowledge Manager' },
    color: '#A8C8EC',
  },
  {
    id: 'task',
    name: '边牧',
    nameLoc: { 'en-US': 'Border Collie' },
    role: '任务型 Agent',
    roleLoc: { 'en-US': 'Task Agent' },
    color: '#6B7280',
  },
]

export const AGENT_MAP: Record<string, AgentProfile> = Object.fromEntries(
  AGENTS.map(a => [a.id, a]),
)
