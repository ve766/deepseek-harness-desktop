/**
 * DesktopHeader — the AI Employee OS Desktop title bar.
 *
 * Shows the product wordmark, a one-line subtitle, and a live summary of the
 * roster's lifecycle states (how many are active / idle / need help). Purely
 * derived from the mock roster; no runtime wiring.
 * @module @deepseek-ai/dsh-client-ui-desktop/client/DesktopHeader
 */

import type { Employee } from '../../types.ts'
import { statusBucket } from '../../status.ts'
import css from './DesktopHeader.module.css'

export interface DesktopHeaderProps {
  employees: Employee[]
}

/**
 * Render the Desktop header.
 * @param props.employees - the roster, used to summarize status.
 * @returns the header element.
 */
export function DesktopHeader({ employees }: DesktopHeaderProps) {
  const active = employees.filter((e) => statusBucket(e.status) === 'active').length
  const idle = employees.filter((e) => statusBucket(e.status) === 'idle').length
  const error = employees.filter((e) => statusBucket(e.status) === 'error').length

  return (
    <header className={css.header}>
      <div className={css.titleBlock}>
        <h1 className={css.title}>AI Employee OS</h1>
        <p className={css.subtitle}>你的 AI 员工团队 · 一眼看到谁在做什么</p>
      </div>
      <div className={css.summary}>
        <span className={css.stat}>
          <strong className={css.statNum}>{employees.length}</strong>
          <span className={css.statLabel}>名员工</span>
        </span>
        <span className={css.stat} data-kind="active">
          <strong className={css.statNum}>{active}</strong>
          <span className={css.statLabel}>工作中</span>
        </span>
        <span className={css.stat} data-kind="idle">
          <strong className={css.statNum}>{idle}</strong>
          <span className={css.statLabel}>空闲</span>
        </span>
        {error > 0 && (
          <span className={css.stat} data-kind="error">
            <strong className={css.statNum}>{error}</strong>
            <span className={css.statLabel}>需协助</span>
          </span>
        )}
      </div>
    </header>
  )
}
