/**
 * MascotAvatar — the AI Employee IP portrait on a Desktop card.
 *
 * This component ONLY presents the mascot master asset: it renders the image
 * (no cropping logic — the source avatar PNG is already framed), applies the
 * rounded tile, shadow and hover lift, and wraps the figure in a status
 * animation container whose color and motion follow the employee's 5-state
 * lifecycle. The underlying PNG is never modified here.
 * @module @deepseek-ai/dsh-client-ui-desktop/client/MascotAvatar
 */

import type { CSSProperties } from 'react'
import type { EmployeeStatus, MascotId } from '../../types.ts'
import { STATUS_COLOR } from '../../status.ts'
import css from './MascotAvatar.module.css'

export interface MascotAvatarProps {
  /** Avatar image source (data URI or URL). Already framed — no cropping. */
  src: string
  /** Accessible name (the employee name). */
  name: string
  /** Which mascot family — drives the role-representative tile background. */
  mascot: MascotId
  /** Live lifecycle state, colors and animates the status ring. */
  status: EmployeeStatus
  /** Tile diameter in px (default 88). */
  size?: number
}

/**
 * Render the mascot avatar with a status-animated container.
 * @param props - image source, identity, status, optional size.
 * @returns the avatar tile with its status ring.
 */
export function MascotAvatar({ src, name, mascot, status, size = 88 }: MascotAvatarProps) {
  // One CSS custom property carries the status color to both the ring and the
  // badge, keeping the 5-state palette in a single source (status.ts).
  const statusVars = { '--ec-status': STATUS_COLOR[status] } as CSSProperties
  return (
    <div
      className={css.avatar}
      data-status={status}
      data-mascot={mascot}
      style={{ ...statusVars, width: size, height: size }}
    >
      <div className={css.tile}>
        <img className={css.img} src={src} alt={name} draggable={false} />
      </div>
      <span className={css.ring} aria-hidden="true" />
      <span className={css.badge} aria-hidden="true" />
    </div>
  )
}
