/**
 * EmployeeStatusDot — status indicator for an AI Employee.
 *
 * Maps the five-state lifecycle (idle / working / thinking / success / error)
 * onto a colored pulse dot plus an optional text label. This is the card-level
 * status chip; the avatar ring (MascotAvatar) reuses the same palette via the
 * `--ec-status` custom property so both stay in lockstep.
 *
 * All per-state presentation is sourced from {@link STATUS_META} in `status.ts`,
 * so the chip never hard-codes a label or color of its own.
 * @module @deepseek-ai/dsh-client-ui-desktop/client/EmployeeStatusDot
 */

import type { CSSProperties } from 'react'
import type { EmployeeStatus } from '../../types.ts'
import { STATUS_META } from '../../status.ts'
import css from './EmployeeStatusDot.module.css'

export interface EmployeeStatusDotProps {
  status: EmployeeStatus
  /** Show the text label next to the dot (default true). */
  showLabel?: boolean
}

/**
 * Render the employee status chip.
 * @param props.status - lifecycle state.
 * @param props.showLabel - whether to render the textual label.
 * @returns the status chip (dot + optional label).
 */
export function EmployeeStatusDot({ status, showLabel = true }: EmployeeStatusDotProps) {
  const meta = STATUS_META[status]
  const vars = { '--ec-status': meta.color } as CSSProperties
  return (
    <span
      className={css.wrap}
      data-status={status}
      style={vars}
      role="status"
      aria-label={meta.hint}
      title={meta.hint}
    >
      <span className={css.dot} aria-hidden="true" />
      {showLabel && <span className={css.label}>{meta.label}</span>}
    </span>
  )
}
