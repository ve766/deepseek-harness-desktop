import type { AgentProfile, LocText } from '../types'
import { useT, resolveEntity, resolveLoc } from '../i18n'
import { EmployeeStatusIcon } from './morphicons/EmployeeStatusIcon'
import type { EmployeeStatus } from './morphicons/states'
import './EmployeeCard.css'

/**
 * AI Employee Identity Unit — the shared identity component for every employee
 * surface (Home / Employee Center / Marketplace / Switcher / Agent Showcase).
 *
 * Three layers, composed (not one giant card):
 *   - EmployeeIcon     : the system-level App-Icon layer (squircle tile + accent
 *                        gradient + mascot iconArt + status badge)
 *   - EmployeeIdentity : the Character-AI layer (name / role / status / phrase /
 *                        level / capability hints)
 *   - EmployeeCard     : thin convenience wrapper (defaults to `card` variant)
 *
 * Design constraints (C1):
 *   - Consumes ONLY E0 `--aios-*` tokens. No new tokens.
 *   - No backdrop-filter glass here (Liquid Glass is a Phase-2 visual language).
 *   - No loop animations; transitions only (reduced-motion folds them to ~0).
 *   - `level` / `capabilities` / `statusPhrase` / `growth` are DISPLAY-ONLY mock
 *     props — they never touch `AgentProfile` or the data layer.
 */

/* ---------- EmployeeIcon : App-Icon layer ---------- */
export function EmployeeIcon({
  agent,
  size = 64,
  status,
}: {
  agent: AgentProfile
  size?: number
  status?: EmployeeStatus
}) {
  const { lang } = useT()
  const name = resolveEntity(agent.name, agent.nameLoc, lang)
  const hasImg = !!agent.avatarUrl
  const mono = name.slice(0, 1) || '?'
  const badge = Math.max(12, Math.round(size * 0.32))
  const style = { width: size, height: size } as Record<string, unknown>
  style['--emp-color'] = agent.color
  return (
    <span
      className={'employee-icon' + (hasImg ? '' : ' employee-icon--fallback')}
      style={style as Record<string, string | number>}
      role="img"
      aria-label={name}
    >
      <span className="employee-icon__tile">
        {hasImg ? (
          <img className="employee-icon__img" src={agent.avatarUrl} alt={name} />
        ) : (
          <span className="employee-icon__mono" style={{ fontSize: Math.round(size * 0.4) }} aria-hidden>
            {mono}
          </span>
        )}
      </span>
      {status && (
        <span className="employee-icon__status" style={{ width: badge, height: badge }}>
          <EmployeeStatusIcon status={status} size={badge} name={name} />
        </span>
      )}
    </span>
  )
}

/* ---------- EmployeeIdentity : Character-AI layer ---------- */
export interface EmployeeIdentityProps {
  agent: AgentProfile
  /** Display-only status (mock in C1). Reuses the canonical EmployeeStatus set. */
  status?: EmployeeStatus
  /** Display-only status phrase (mock in C1). Bilingual LocText. */
  statusPhrase?: LocText
  /** Display-only capability hints (mock in C1). Bilingual LocText[]. */
  capabilities?: LocText[]
  /** Display-only mastery 0..1 (mock in C1). Drives the level bar. */
  level?: number
  /** Display-only growth label (mock in C1). Bilingual LocText. */
  growth?: LocText
  variant?: 'compact' | 'card' | 'hero'
  /** Icon size for `card`; hero forces 160, compact forces 40. */
  size?: number
}

export function EmployeeIdentity({
  agent,
  status,
  statusPhrase,
  capabilities,
  level,
  growth,
  variant = 'card',
  size = 96,
}: EmployeeIdentityProps) {
  const { t, lang } = useT()
  const name = resolveEntity(agent.name, agent.nameLoc, lang)
  const role = resolveEntity(agent.role, agent.roleLoc, lang)
  const phrase = statusPhrase ? resolveLoc(undefined, statusPhrase, lang) : undefined
  const caps = (capabilities || []).map(c => resolveLoc(undefined, c, lang))
  const growthText = growth ? resolveLoc(undefined, growth, lang) : undefined
  const pct = Math.round(
    (typeof level === 'number' ? Math.max(0, Math.min(1, level)) : 0) * 100,
  )
  const iconSize = variant === 'hero' ? 160 : variant === 'compact' ? 40 : size
  const showLevel = typeof level === 'number' || !!growthText
  const style = { width: iconSize } as Record<string, unknown>
  style['--emp-color'] = agent.color
  const placeholder = !agent.avatarUrl

  return (
    <div className={'employee-card employee-card--' + variant + (placeholder ? ' employee-card--placeholder' : '')}>
      <div className="employee-card__top">
        <EmployeeIcon agent={agent} size={iconSize} status={status} />
        <div className="employee-card__id">
          <div className="employee-card__name" title={name}>
            {name}
          </div>
          <div className="employee-card__role" title={role}>
            {role}
          </div>
          {status && (
            <div className="employee-card__status" data-status={status}>
              <EmployeeStatusIcon status={status} size={15} name={name} />
              <span className="employee-card__status-label">{t('status.employee.' + status)}</span>
            </div>
          )}
          {phrase && <div className="employee-card__phrase">{phrase}</div>}
        </div>
      </div>

      {showLevel && (
        <div className="employee-card__level">
          <span className="employee-card__level-track">
            <span className="employee-card__level-fill" style={{ width: pct + '%' }} />
          </span>
          <span className="employee-card__level-text">
            {growthText ? growthText : `Lv ${pct}`}
          </span>
        </div>
      )}

      {caps.length > 0 && (
        <div className="employee-card__caps">
          {caps.map((c, i) => (
            <span className="employee-card__cap" key={i}>
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- EmployeeCard : convenience wrapper ---------- */
export function EmployeeCard(props: EmployeeIdentityProps) {
  return <EmployeeIdentity {...props} variant={props.variant ?? 'card'} />
}
