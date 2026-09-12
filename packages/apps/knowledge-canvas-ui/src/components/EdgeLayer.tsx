import { useEdges, useNodes } from '../store/canvasStore'
import { useT } from '../i18n'
import { NODE_H, NODE_W } from '../utils'

export function EdgeLayer() {
  const { t } = useT()
  const edges = useEdges()
  const nodes = useNodes()
  return (
    <svg className="edge-layer">
      {Object.values(edges).map((e) => {
        const a = nodes[e.from]
        const b = nodes[e.to]
        if (!a || !b) return null
        const x1 = a.position.x + NODE_W / 2
        const y1 = a.position.y + NODE_H / 2
        const x2 = b.position.x + NODE_W / 2
        const y2 = b.position.y + NODE_H / 2
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2 - 24
        return (
          <g key={e.id} className={'edge' + (e.kind === 'ai-auto' ? ' edge--ai' : '')}>
            <path className="edge__line" d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} />
            <title>{t(e.reason ?? 'edge.related')}</title>
          </g>
        )
      })}
    </svg>
  )
}
