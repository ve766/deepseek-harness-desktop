import { useT } from '../i18n'
import { ProviderStatusIcon, type ProviderStatus } from './morphicons/ProviderStatusIcon'

export interface ProviderView {
  name: string
  /** Raw override text (legacy / P1 demo). */
  sub?: string
  /** i18n key resolved via t() — preferred for localized mocks. */
  subKey?: string
  status: ProviderStatus
}

/** Mock provider fleet — superseded by real backend status when available. */
const DEFAULT_PROVIDERS: ProviderView[] = [
  { name: 'Ollama', subKey: 'provider.ollamaSub', status: 'online' },
  { name: 'DeepSeek Cloud', subKey: 'provider.deepseekSub', status: 'online' },
  { name: 'OpenRouter', subKey: 'provider.openrouterSub', status: 'warning' },
  { name: 'Anthropic', subKey: 'provider.anthropicSub', status: 'error' },
]

export function ProviderStatusCard({
  providers = DEFAULT_PROVIDERS,
}: {
  providers?: ProviderView[]
}) {
  const { t } = useT()
  return (
    <div className="provider-card">
      <div className="provider-card__title">{t('provider.title')}</div>
      {providers.map((p) => (
        <div className="provider-row" key={p.name}>
          <ProviderStatusIcon status={p.status} size={18} name={p.name} />
          <span className="provider-name">{p.name}</span>
          <span className="provider-sub">{p.subKey ? t(p.subKey) : p.sub}</span>
        </div>
      ))}
      <div className="provider-note">{t('provider.note')}</div>
    </div>
  )
}
