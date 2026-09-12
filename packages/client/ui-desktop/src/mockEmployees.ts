/**
 * AI Employee OS — P1 mock roster (static, no runtime).
 *
 * Two employees from the Mascot Visual System v1.0 family: the default
 * assistant (中华田园犬) and the research agent (黑猫 Nox). Status values exercise
 * the 5-state system so the avatar ring and status chip animate distinctly.
 * Replace with live data once the Agent Runtime face is wired (later commit).
 */
import type { Employee } from './types.ts'

/** The P1 static employee roster shown on the Desktop. */
export const mockEmployees: Employee[] = [
  {
    id: 'emp-assistant',
    name: '阿黄',
    role: '默认助手 · 系统管家',
    mascot: 'assistant',
    preset: 'employee.assistant-dog',
    status: 'idle',
    currentTask: '待命中 · 随时可用',
    tags: ['系统管家', '文件整理', '日常任务', '新手引导'],
    actions: [
      { label: '开始对话', primary: true },
      { label: '打开工作台' },
      { label: '管理' },
    ],
  },
  {
    id: 'emp-nox',
    name: 'Nox',
    role: 'Research Employee',
    mascot: 'nox',
    preset: 'employee.nox-cat',
    status: 'working',
    currentTask: '分析 AI Agent 市场',
    tags: ['搜索', '调研', '阅读', '报告', '知识沉淀'],
    actions: [
      { label: '查看过程' },
      { label: '查看报告' },
      { label: '继续任务', primary: true },
    ],
  },
]
