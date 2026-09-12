/**
 * P1 · Domain status vocabularies for the Morphicon state layer.
 *
 * The base `MorphIcon` only knows 7 visual states (idle / thinking / searching /
 * learning / completed / warning / error). Each product surface has its own
 * vocabulary; these maps translate a *semantic* status into the visual base
 * state. Keeping the mapping here means consumers (Provider / Employee / Task /
 * AI) never need to know about the 7 internal states.
 */

import type { MorphState } from './geometry'

/* ---- Provider (LLM backend) ---- */
export type ProviderStatus = 'idle' | 'connecting' | 'online' | 'warning' | 'error'
export const PROVIDER_TO_BASE: Record<ProviderStatus, MorphState> = {
  idle: 'idle',
  connecting: 'thinking', // handshake in flight
  online: 'completed', // connected
  warning: 'warning', // latency high / quota low / unstable
  error: 'error', // explicit failure — Router does NOT auto-fallback
}
export const PROVIDER_KEY = (s: ProviderStatus): string => `status.provider.${s}`

/* ---- AI Employee ---- */
// Canonical vocabulary the product surface uses: idle / thinking / working /
// completed / offline. `blocked` is retained for backward-compat but is NOT part
// of the C1 canonical set (see docs/C1_EMPLOYEE_IDENTITY_UNIT_MINI_PLAN.md §4).
export type EmployeeStatus = 'idle' | 'thinking' | 'working' | 'completed' | 'blocked' | 'offline'
export const EMPLOYEE_TO_BASE: Record<EmployeeStatus, MorphState> = {
  idle: 'idle',
  thinking: 'thinking',
  working: 'searching', // actively doing something
  completed: 'completed',
  blocked: 'warning',
  offline: 'idle', // inactive / not connected — quiet, not alarming
}
export const EMPLOYEE_KEY = (s: EmployeeStatus): string => `status.employee.${s}`

/* ---- Task ---- */
export type TaskStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled'
export const TASK_TO_BASE: Record<TaskStatus, MorphState> = {
  queued: 'idle',
  running: 'thinking',
  success: 'completed',
  failed: 'error',
  cancelled: 'warning',
}
export const TASK_KEY = (s: TaskStatus): string => `status.task.${s}`

/* ---- AI working loop (ThinkingRing replacement) ---- */
export type AIStatus = 'thinking' | 'discovering' | 'building' | 'completed' | 'failed'
export const AI_TO_BASE: Record<AIStatus, MorphState> = {
  thinking: 'thinking', // 正在分析
  discovering: 'searching', // 发现关系
  building: 'learning', // 建立知识地图
  completed: 'completed', // 完成
  failed: 'error', // 失败原因
}
export const AI_KEY = (s: AIStatus): string => `status.ai.${s}`
