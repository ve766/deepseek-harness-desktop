import { useT } from '../../i18n'
import { MorphIcon } from './MorphIcon'
import { TASK_KEY, TASK_TO_BASE, type TaskStatus } from './states'

export interface TaskStatusIconProps {
  status?: TaskStatus
  size?: number
  className?: string
}

/** Inline task status (queued → running → success / failed / cancelled). */
export function TaskStatusIcon({ status = 'queued', size = 20, className }: TaskStatusIconProps) {
  const { t } = useT()
  return (
    <MorphIcon
      state={TASK_TO_BASE[status]}
      size={size}
      label={t(TASK_KEY(status))}
      className={className ? `morph--task ${className}` : 'morph--task'}
    />
  )
}
