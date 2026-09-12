import { useT } from '../i18n'
import './NavigationRail.css'

/* ============================================================
 * A3 · AI Employee OS Navigation Rail — system-level "go where".
 *
 * Hard red lines (A3):
 *   - NOT a traditional Sidebar: narrow, icon-forward, flat, non-glass.
 *   - Carries NO tasks / chat / prompt / content. Navigation only.
 *   - Does NOT modify Home / CommandCenter / SideNav / App.
 *   - Single glass-layer budget preserved: Rail is FLAT (opaque
 *     --bg-base), never uses --aios-glass-* / backdrop-filter.
 *   - Command Center invoke is a reserved, no-op affordance, clearly
 *     separated from the 7 NavRoute items.
 *   - activeRoute is a mock (useState in the showcase) — only drives
 *     highlight, never mounts/switches a surface.
 *
 * D8 adjustment: `icon` is a placeholder slot (emoji/unicode for A3
 * structure validation). The `.nav-rail__icon` span is the reserved
 * slot for a future SF-Symbols-style MorphIcon / SVG asset — swap the
 * glyph for a component without touching the rail layout.
 * ============================================================ */

export type NavRoute =
  | 'home'
  | 'employees'
  | 'knowledge'
  | 'memory'
  | 'projects'
  | 'marketplace'
  | 'settings'

export interface NavigationRailProps {
  activeRoute: NavRoute
  /** A3: mock no-op (drives highlight only); real routing is future Shell. */
  onNavigate?: (r: NavRoute) => void
  /** A3: reserved CC invoke affordance, no-op; future toggles CC docked/floating. */
  onCommandCenter?: () => void
}

interface NavItemDef {
  route: NavRoute
  key: string
  /** Placeholder glyph — reserved slot for SVG/MorphIcon (D8). */
  icon: string
  disabled?: boolean
}

// Component-local constant (NOT a global registry). Future route additions
// only edit this array + the NavRoute union; the rail layout is untouched.
const NAV: NavItemDef[] = [
  { route: 'home', key: 'nav.home', icon: '🏠' },
  { route: 'employees', key: 'nav.employees', icon: '🐾' },
  { route: 'knowledge', key: 'nav.knowledge', icon: '◎' },
  { route: 'memory', key: 'nav.memory', icon: '💾' },
  { route: 'projects', key: 'nav.projects', icon: '📁' },
  { route: 'marketplace', key: 'nav.marketplace', icon: '🛒', disabled: true }, // future
  { route: 'settings', key: 'nav.settings', icon: '⚙' },
]

function NavRailItem({
  item,
  active,
  onNavigate,
}: {
  item: NavItemDef
  active: boolean
  onNavigate?: (r: NavRoute) => void
}) {
  const { t } = useT()
  const label = t(item.key)
  const disabled = !!item.disabled
  return (
    <button
      type="button"
      className={
        'nav-rail__item' +
        (active ? ' nav-rail__item--active' : '') +
        (disabled ? ' nav-rail__item--disabled' : '')
      }
      data-route={item.route}
      aria-current={active ? 'page' : undefined}
      aria-disabled={disabled || undefined}
      aria-label={label}
      title={label}
      onClick={() => {
        if (!disabled) onNavigate?.(item.route)
      }}
    >
      {/* D8: icon slot — replace glyph with SVG/MorphIcon later */}
      <span className="nav-rail__icon" aria-hidden>
        {item.icon}
      </span>
      {disabled && (
        <span className="nav-rail__soon" aria-hidden>
          {t('nav.marketplace.soon')}
        </span>
      )}
    </button>
  )
}

export function NavigationRail({
  activeRoute,
  onNavigate,
  onCommandCenter,
}: NavigationRailProps) {
  const { t } = useT()
  return (
    <nav className="nav-rail" aria-label={t('nav.title')}>
      <div className="nav-rail__brand" aria-hidden>
        <span className="nav-rail__brand-mark" />
      </div>

      <div className="nav-rail__list">
        {NAV.map(item => (
          <NavRailItem
            key={item.route}
            item={item}
            active={item.route === activeRoute}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <div className="nav-rail__divider" aria-hidden />

      {/* Reserved CC invoke affordance — separated from NavRoute items, no-op in A3 */}
      <button
        type="button"
        className="nav-rail__cc"
        data-cc-invoke="1"
        aria-label={t('nav.commandCenter')}
        title={t('nav.commandCenter.hint')}
        onClick={() => {
          onCommandCenter?.()
        }}
      >
        <span className="nav-rail__icon" aria-hidden>
          ◈
        </span>
      </button>
    </nav>
  )
}
