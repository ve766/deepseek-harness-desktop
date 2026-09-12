import type { ReactNode } from 'react'
import './EmptyState.css'

export type EmptyStateVariant = 'welcome' | 'space' | 'growth'

export interface EmptyStateProps {
  variant: EmptyStateVariant
  title: string
  description: string
  /** Optional override for the default per-variant glyph. */
  icon?: string
  /** Optional single guidance action slot. Reserved for future Demo wiring; not used in P4-1/3. */
  action?: ReactNode
}

const DEFAULT_ICON: Record<EmptyStateVariant, string> = {
  welcome: '🌱',
  space: '🕸️',
  growth: '🌌',
}

/** Pure presentational value-guidance layer shown when a surface has no data.
 *  It is intentionally NOT a navigation/menu system — just icon + title + description
 *  (+ an optional single action slot reserved for a future Demo entry). */
export function EmptyState({ variant, title, description, icon, action }: EmptyStateProps) {
  return (
    <div className={`emptystate emptystate--${variant} emptystate-in`} role="status" aria-live="polite">
      <div className="emptystate__icon" aria-hidden="true">
        {icon ?? DEFAULT_ICON[variant]}
      </div>
      <h2 className="emptystate__title">{title}</h2>
      <p className="emptystate__desc">{description}</p>
      {action ? <div className="emptystate__action">{action}</div> : null}
    </div>
  )
}
