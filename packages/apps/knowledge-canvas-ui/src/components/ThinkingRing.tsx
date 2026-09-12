import { useT } from '../i18n'
import { AIStatusIcon } from './morphicons/AIStatusIcon'
import type { AIStatus } from './morphicons/states'

/**
 * AI working-state indicator. Upgraded from a plain spinner into the morphicon
 * AI status layer so the user sees *what the AI is doing* (analyzing / discovering
 * links / building map / done / failed), not just "loading".
 *
 * `status` defaults to 'thinking' so existing call-sites keep working unchanged.
 */
export function ThinkingRing({
  status = 'thinking',
  size = 44,
}: {
  status?: AIStatus
  size?: number
}) {
  const { t } = useT()
  return (
    <div className="ai-status" role="status" aria-label={t('status.ai.' + status)}>
      <AIStatusIcon status={status} size={size} />
    </div>
  )
}
