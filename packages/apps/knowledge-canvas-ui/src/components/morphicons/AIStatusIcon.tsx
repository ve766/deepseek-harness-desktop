import { useT } from '../../i18n'
import { MorphIcon } from './MorphIcon'
import { AI_KEY, AI_TO_BASE, type AIStatus } from './states'

export interface AIStatusIconProps {
  status?: AIStatus
  size?: number
  className?: string
}

/**
 * The AI working loop, used to replace the old `ThinkingRing` spinner.
 * Five states map the human-readable AI phases onto the morphicon base states.
 */
export function AIStatusIcon({ status = 'thinking', size = 20, className }: AIStatusIconProps) {
  const { t } = useT()
  return (
    <MorphIcon
      state={AI_TO_BASE[status]}
      size={size}
      label={t(AI_KEY(status))}
      className={className ? `morph--ai ${className}` : 'morph--ai'}
    />
  )
}
