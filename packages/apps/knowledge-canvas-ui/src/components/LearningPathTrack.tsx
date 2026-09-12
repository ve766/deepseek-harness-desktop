import type { LearningPath } from '../types'
import { useNodes } from '../store/canvasStore'
import { nodeCenter } from '../galaxyLayout'

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1]
    const p1 = pts[i]
    const mx = (p0.x + p1.x) / 2
    const my = (p0.y + p1.y) / 2
    d += ` Q ${p0.x} ${p0.y} ${mx} ${my}`
    if (i === pts.length - 1) d += ` T ${p1.x} ${p1.y}`
  }
  return d
}

export function LearningPathTrack({
  path,
  active,
}: {
  path: LearningPath
  active: boolean
}) {
  const nodes = useNodes()
  const pts = path.nodeIds
    .map((id) => nodes[id])
    .filter(Boolean)
    .map((n) => nodeCenter(n.position))
  if (pts.length < 2) return null
  const d = smoothPath(pts)
  return (
    <g className={'lptrack' + (active ? ' lptrack--active' : '')}>
      <path className="lptrack__line" d={d} />
      <path className="lptrack__glow" d={d} />
      {active && (
        <circle className="lptrack__comet" r={6}>
          <animateMotion dur="3.2s" repeatCount="indefinite" path={d} rotate="auto" />
        </circle>
      )}
      {pts.map((p, i) => (
        <g
          key={i}
          className="lptrack__step"
          style={active ? { animationDelay: `${0.25 + i * 0.13}s` } : undefined}
        >
          <circle cx={p.x} cy={p.y} r={11} className="lptrack__dot" />
          <text x={p.x} y={p.y + 4} className="lptrack__num">
            {i + 1}
          </text>
        </g>
      ))}
    </g>
  )
}
