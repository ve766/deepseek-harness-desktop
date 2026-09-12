import { AGENTS } from '../domain/agents'
import { AgentAvatar } from './AgentAvatar'
import { useT } from '../i18n'

const NAV = [
  { id: 'knowledge', key: 'sidebar.knowledge', icon: '◎', active: true },
  { id: 'memory', key: 'sidebar.memory', icon: '❖', active: false },
  { id: 'import', key: 'sidebar.import', icon: '⤓', active: false },
  { id: 'settings', key: 'sidebar.settings', icon: '⚙', active: false },
]

export function SideNav() {
  const { t } = useT()
  return (
    <nav className="sidebar">
      <div className="sidebar__brand">{t('app.brand')}</div>
      <ul className="sidebar__nav">
        {NAV.map((n) => (
          <li key={n.id} className={'navitem' + (n.active ? ' navitem--active' : '')}>
            <span className="navitem__icon">{n.icon}</span>
            <span className="navitem__label">{t(n.key)}</span>
          </li>
        ))}
      </ul>
      <div className="sidebar__agents">
        <div className="sidebar__agents-title">{t('sidebar.agents')}</div>
        <div className="agent-stack">
          {AGENTS.map((a) => (
            <AgentAvatar key={a.id} agent={a} size={34} withName />
          ))}
        </div>
      </div>
    </nav>
  )
}
