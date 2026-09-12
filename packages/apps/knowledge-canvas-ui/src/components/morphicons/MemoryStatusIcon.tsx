import { useT } from '../../i18n'
import { MorphIcon } from './MorphIcon'
import type { MorphState } from './geometry'

export interface MemoryStatusIconProps {
  state?: MorphState
  size?: number
  className?: string
}

/** Memory read / write / index state. */
export function MemoryStatusIcon({ state = 'idle', size = 16, className }: MemoryStatusIconProps) {
  const { t } = useT()
  return (
    <MorphIcon
      state={state}
      size={size}
      label={t('morph.aria.memory', { state: t('morph.state.' + state) })}
      className={className ? `morph--memory ${className}` : 'morph--memory'}
    />
  )
}
