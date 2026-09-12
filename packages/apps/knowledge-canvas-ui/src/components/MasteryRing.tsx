import { useT } from '../i18n'

interface MasteryRingProps {
  /** 0..1 mastery level. */
  value: number
  size?: number
  /** 'known' | 'learning' | 'gap' — drives the ring colour. */
  status?: 'known' | 'learning' | 'gap'
  /** Optional caption under the percentage (e.g. "成长"). */
  label?: string
}

const COLORS: Record<string, string> = {
  known: '#34c759',
  learning: '#0a84ff',
  gap: '#ff9f0a',
}

export function MasteryRing({ value, size = 40, status = 'learning', label }: MasteryRingProps) {
  const { t } = useT()
  const v = Math.max(0, Math.min(1, value))
  const r = size / 2 - 4
  const c = 2 * Math.PI * r
  const dash = c * v
  const color = COLORS[status] ?? COLORS.learning
  const pct = Math.round(v * 100)
  return (
    <svg
      className="mastery-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={t('mastery.aria', { label: label ?? t('mastery.default'), pct })}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth={3.5} />
      <circle
        key={Math.round(v * 100)}
        className="mastery-ring__fill"
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.2,0.8,0.2,1), stroke 0.3s ease' }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="mastery-ring__label"
        fill="currentColor"
      >
        {pct}
      </text>
      {label && (
        <text
          x="50%"
          y={size - 3}
          textAnchor="middle"
          className="mastery-ring__caption"
        >
          {label}
        </text>
      )}
    </svg>
  )
}
