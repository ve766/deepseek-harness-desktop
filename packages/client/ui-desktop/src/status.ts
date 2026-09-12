/**
 * AI Employee OS — five-state lifecycle mapping for an AI Employee.
 *
 * This module is the single source of truth for the employee status system
 * (Employee Card & Desktop Experience Design v1.0 §3.2). It consolidates the
 * label, palette color, coarse bucket and human hint for each of the five
 * states, and collapses that 5-state lifecycle onto the 4-state
 * `ui-primitives` StateDot without touching the platform core.
 *
 * The component layer (EmployeeStatusDot / MascotAvatar) only reads from here,
 * so adding or retuning a state is a one-file change.
 */
import type { EmployeeStatus } from './types.ts'

/** The four states exposed by `ui-primitives` StateDot (platform core, read-only in P1). */
export type StateDotStatus = 'done' | 'warning' | 'ongoing' | 'error'

/** Per-state presentation + semantics for the five-state employee lifecycle. */
export interface EmployeeStatusMeta {
  /** Chip / ring label. */
  label: string
  /** §3.2 palette color; travels as the `--ec-status` CSS custom property. */
  color: string
  /** Coarse bucket used by dashboard / header summaries. */
  bucket: 'active' | 'idle' | 'error'
  /** One-line human hint, used as the aria-label / tooltip source. */
  hint: string
}

/**
 * Single source of truth for the five-state lifecycle:
 * idle / working / thinking / success / error.
 */
export const STATUS_META: Record<EmployeeStatus, EmployeeStatusMeta> = {
  idle: {
    label: '空闲',
    color: '#8e8e93',
    bucket: 'idle',
    hint: '待命中，可随时分配新任务',
  },
  working: {
    label: '工作中',
    color: '#0071e3',
    bucket: 'active',
    hint: '正在执行任务',
  },
  thinking: {
    label: '思考中',
    color: '#AF52DE',
    bucket: 'active',
    hint: '正在推理或检索资料',
  },
  success: {
    label: '已完成',
    color: '#34C759',
    bucket: 'active',
    hint: '任务已顺利完成',
  },
  error: {
    label: '需协助',
    color: '#FF3B30',
    bucket: 'error',
    hint: '遇到阻塞，需要人工介入',
  },
}

/** Display labels (derived from {@link STATUS_META}). */
export const STATUS_LABEL: Record<EmployeeStatus, string> = {
  idle: STATUS_META.idle.label,
  working: STATUS_META.working.label,
  thinking: STATUS_META.thinking.label,
  success: STATUS_META.success.label,
  error: STATUS_META.error.label,
}

/** §3.2 palette colors (derived from {@link STATUS_META}). */
export const STATUS_COLOR: Record<EmployeeStatus, string> = {
  idle: STATUS_META.idle.color,
  working: STATUS_META.working.color,
  thinking: STATUS_META.thinking.color,
  success: STATUS_META.success.color,
  error: STATUS_META.error.color,
}

/** Coarse bucket used by dashboard / header summaries. */
export function statusBucket(status: EmployeeStatus): 'active' | 'idle' | 'error' {
  return STATUS_META[status].bucket
}

/**
 * Collapse the 5-state lifecycle onto the 4-state `ui-primitives` StateDot.
 *
 * The platform core is NOT modified by P1; this pure mapping keeps the two
 * systems aligned for when a card opts into the platform's StatusDot. `idle`
 * has no direct 4-state equivalent, so it collapses to `warning` (standby).
 */
export function toStateDotStatus(status: EmployeeStatus): StateDotStatus {
  switch (status) {
    case 'working':
    case 'thinking':
      return 'ongoing'
    case 'success':
      return 'done'
    case 'error':
      return 'error'
    case 'idle':
      return 'warning'
  }
}
