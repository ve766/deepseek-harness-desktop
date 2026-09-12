import type { AgentProfile } from '../types'
import { useT, resolveEntity } from '../i18n'
import { EmployeeStatusIcon } from './morphicons/EmployeeStatusIcon'
import type { EmployeeStatus } from './morphicons/states'

export function AgentAvatar({
  agent,
  size = 32,
  withName = false,
  /** Optional status layer — renders a morphicon badge on the avatar. */
  status,
}: {
  agent: AgentProfile
  size?: number
  withName?: boolean
  status?: EmployeeStatus
}) {
  const { lang } = useT()
  const name = resolveEntity(agent.name, agent.nameLoc, lang)
  const badgeSize = Math.max(12, Math.round(size * 0.34))
  return (
    <div className={'agent-avatar' + (withName ? ' agent-avatar--row' : '')}>
      <span
        className="agent-avatar__circle"
        style={{ width: size, height: size, position: 'relative' }}
      >
        {agent.avatarUrl ? (
          <img src={agent.avatarUrl} alt={name} width={size} height={size} />
        ) : (
          <span
            className="agent-avatar__ph"
            style={{ background: agent.color, fontSize: size * 0.42 }}
          >
            {name.slice(0, 1)}
          </span>
        )}
        {status && (
          <span className="agent-avatar__status" title={name}>
            <EmployeeStatusIcon status={status} size={badgeSize} name={name} />
          </span>
        )}
      </span>
      {withName && (
        <span className="agent-avatar__meta">
          <span className="agent-avatar__name">{name}</span>
          <span className="agent-avatar__role">
            {resolveEntity(agent.role, agent.roleLoc, lang)}
          </span>
        </span>
      )}
    </div>
  )
}
