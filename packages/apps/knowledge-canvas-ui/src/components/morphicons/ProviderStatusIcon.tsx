import { useT } from '../../i18n'
import { MorphIcon } from './MorphIcon'
import { PROVIDER_KEY, PROVIDER_TO_BASE, type ProviderStatus } from './states'

export interface ProviderStatusIconProps {
  status?: ProviderStatus
  size?: number
  /** Provider display name — folded into the aria-label when provided. */
  name?: string
  className?: string
}

/** Provider state (Ollama / DeepSeek / …). Replaces the old static "ok" dot. */
export function ProviderStatusIcon({
  status = 'online',
  size = 16,
  name,
  className,
}: ProviderStatusIconProps) {
  const { t } = useT()
  const label = name
    ? t('morph.aria.provider', { name, state: t(PROVIDER_KEY(status)) })
    : t(PROVIDER_KEY(status))
  return (
    <MorphIcon
      state={PROVIDER_TO_BASE[status]}
      size={size}
      label={label}
      className={className ? `morph--provider ${className}` : 'morph--provider'}
    />
  )
}
