import { useNodes, useRelationships } from '../store/canvasStore'
import { nodeCenter } from '../galaxyLayout'
import { useT } from '../i18n'

/** Faint explainable edges between Galaxy concepts (relationships). */
export function GalaxyEdgeLayer() {
  const { t } = useT()
  const nodes = useNodes()
  const rels = useRelationships()
  return (
    <svg className="gedge-layer" width={1} height={1}>
      {Object.values(rels).map((r) => {
        const a = nodes[r.source]
        const b = nodes[r.target]
        if (!a || !b) return null
        const p1 = nodeCenter(a.position)
        const p2 = nodeCenter(b.position)
        const mx = (p1.x + p2.x) / 2
        const my = (p1.y + p2.y) / 2 - 26
        const d = `M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`
        return (
          <g key={r.id} className={'gedge gedge--' + r.type}>
            <path className="gedge__line" d={d} />
            {r.reason && (
              <text className="gedge__reason" x={mx} y={my - 4}>
                {t(r.reason as Parameters<typeof t>[0])}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
