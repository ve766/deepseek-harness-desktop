import type { AgentProfile, LocText } from '../types'
import type { EmployeeStatus } from './morphicons/states'
import { useT, resolveLoc, resolveEntity } from '../i18n'
import { EmployeeCard, EmployeeIcon } from './EmployeeCard'
import type { CCAction } from './CommandCenter'
import './Home.css'

/* ============================================================
 * AI Employee Home (A) — presentation-only contract.
 *
 * Home is the AI Employee "lounge" — NOT a Dashboard.
 * First visual focus = AI Employee Presence (the hero card).
 * The Dock is an AI Crew Switcher (Apple Dock + visionOS roster feel).
 *
 * A1 scope (per Mini Plan §9.3):
 *   ✅ Primary Character Stage · Employee Dock · base layout · E0 tokens
 *   ❌ Task status (A2) · Command Center linkage (A3) · Workflow (BWL)
 *      · file upload (BWL) · prompt input (BWL)
 *
 * HARD RED LINES:
 *   - No chat bubble / prompt input / conversation history.
 *   - No new identity component — reuses <EmployeeCard>/<EmployeeIcon>.
 *   - Single glass layer (the Dock only); the root is transparent.
 *   - mock LocText only; no Agent/Task/Memory runtime.
 * ============================================================ */

export interface HomeEmployee {
  profile: AgentProfile
  status: EmployeeStatus
  statusPhrase?: LocText
  level?: number
  /** Reservation: notification indicator on the Dock tile (visual only in A1). */
  notification?: boolean
}

export interface HomeContext {
  primary: HomeEmployee
  roster: HomeEmployee[]
  /** A2: quick actions (reuses B's CCAction grading). primary ≤1, context ≤3. */
  quickActions?: CCAction[]
}

/* ---------- AI Crew Switcher (the Dock) ---------- */
function HomeDock({ roster, activeId }: { roster: HomeEmployee[]; activeId: string }) {
  const { t, lang } = useT()
  return (
    <nav className="home-dock" aria-label={t('home.dock')}>
      <span className="home-dock__label">{t('home.dock')}</span>
      <div className="home-dock__tiles">
        {roster.map((e) => {
          const name = (e.profile.nameLoc ? resolveLoc(undefined, e.profile.nameLoc, lang) : '') || e.profile.name
          const active = e.profile.id === activeId
          const offline = e.status === 'offline'
          const cls =
            'home-dock__tile' +
            (active ? ' is-active' : '') +
            (offline ? ' is-offline' : '') +
            (e.status === 'working' ? ' is-working' : '')
          return (
            <button
              type="button"
              key={e.profile.id}
              className={cls}
              data-employee-id={e.profile.id}
              aria-label={t('home.switch') + ': ' + name}
              onClick={() => {
                /* mock only — no real employee switch in A1 */
              }}
            >
              <span className="home-dock__avatar">
                <EmployeeIcon agent={e.profile} size={48} status={e.status} />
                {e.notification && <span className="home-dock__badge" aria-hidden />}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/* ============================================================
 * Home — the lounge shell (transparent root, no glass shell).
 * ============================================================ */
export function Home({ ctx }: { ctx: HomeContext }) {
  const { t, lang } = useT()
  const name = resolveEntity(
    ctx.primary.profile.name,
    ctx.primary.profile.nameLoc,
    lang,
  )
  const phrase = ctx.primary.statusPhrase
    ? resolveLoc(undefined, ctx.primary.statusPhrase, lang)
    : ''
  const narrative = phrase ? `${name} ${phrase}` : name
  const actions = ctx.quickActions || []
  const hasActions = actions.length > 0

  return (
    <section className="home" aria-label={t('home.title')}>
      <div className="home__title">{t('home.title')}</div>

      {/* Priority 1: Employee Presence (dominant focal) */}
      <div className="home__stage">
        <div className="home__primary">
          <div className="home__primary-label">{t('home.section.primary')}</div>
          <EmployeeCard
            agent={ctx.primary.profile}
            status={ctx.primary.status}
            level={ctx.primary.level}
            variant="hero"
          />
        </div>
      </div>

      {/* Priority 2: one-sentence status narrative (AI Employee Status Narrative,
          NOT a PM task view — no list / progress / table / dashboard). */}
      <div className="home__readout" data-readout="narrative">
        <div className="home__readout-label">{t('home.section.tasks')}</div>
        {narrative ? (
          <p className="home__narrative">
            <span className="home__narrative-dot" data-status={ctx.primary.status} aria-hidden />
            <span className="home__narrative-text">{narrative}</span>
          </p>
        ) : (
          <p className="home__narrative home__narrative--empty">{t('home.empty.tasks')}</p>
        )}
      </div>

      {/* Priority 3: quick actions (entry points, not a toolbar).
          primary ≤1, context ≤3 — reuses B's CCAction grading. */}
      {hasActions && (
        <div className="home__actions-wrap" data-actions="quick">
          <div className="home__actions-label">{t('home.section.actions')}</div>
          <div className="home__actions">
            {actions.map(a => (
              <button
                type="button"
                key={a.actionId}
                className={'home-action home-action--' + a.kind}
                data-action-kind={a.kind}
                onClick={() => {
                  /* mock only — no real action dispatch in A2 */
                }}
              >
                <span className="home-action__icon" aria-hidden>{a.icon}</span>
                <span className="home-action__label">
                  {resolveLoc(undefined, a.label, lang)}
                </span>
                {a.shortcut && <span className="home-action__shortcut">{a.shortcut}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <HomeDock roster={ctx.roster} activeId={ctx.primary.profile.id} />
    </section>
  )
}
