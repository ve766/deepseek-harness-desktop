import { useT } from '../../i18n'
import { MorphIcon } from './MorphIcon'
import { EMPLOYEE_KEY, EMPLOYEE_TO_BASE, type EmployeeStatus } from './states'

export interface EmployeeStatusIconProps {
  status?: EmployeeStatus
  size?: number
  /** Employee display name — folded into the aria-label when provided. */
  name?: string
  className?: string
}

/** Employee state. Used on the avatar badge and the employee card. */
export function EmployeeStatusIcon({
  status = 'idle',
  size = 20,
  name,
  className,
}: EmployeeStatusIconProps) {
  const { t } = useT()
  const label = name
    ? t('morph.aria.employee', { name, state: t(EMPLOYEE_KEY(status)) })
    : t(EMPLOYEE_KEY(status))
  return (
    <MorphIcon
      state={EMPLOYEE_TO_BASE[status]}
      size={size}
      label={label}
      className={className ? `morph--employee ${className}` : 'morph--employee'}
    />
  )
}
