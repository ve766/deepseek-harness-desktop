import type { CSSProperties } from 'react'
import { useNodes } from '../store/canvasStore'
import { NODE_H, NODE_W } from '../utils'
import { useT } from '../i18n'
import type { Cluster } from '../types'

const PAD = 26
const HEADER = 34

/** A m3e-canvas-like frame drawn behind its member nodes. AI clusters get a
 *  distinct dashed gradient border + ✨ marker so the user knows it was
 *  machine-made (and is fully undoable). */
export function ClusterFrame({ cluster }: { cluster: Cluster }) {
  const { t } = useT()
  const nodes = useNodes()
  const members = cluster.memberIds.map((id) => nodes[id]).filter(Boolean)
  if (members.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of members) {
    minX = Math.min(minX, n.position.x)
    minY = Math.min(minY, n.position.y)
    maxX = Math.max(maxX, n.position.x + NODE_W)
    maxY = Math.max(maxY, n.position.y + NODE_H)
  }
  const style: CSSProperties = {
    left: minX - PAD,
    top: minY - PAD - HEADER,
    width: maxX - minX + PAD * 2,
    height: maxY - minY + PAD * 2 + HEADER,
  }

  return (
    <div
      className={'cluster cluster--' + cluster.kind}
      style={style}
      aria-label={t(cluster.title as Parameters<typeof t>[0])}
    >
      <div className="cluster__title">
        <span className="cluster__icon">{cluster.kind === 'ai' ? '✨' : '◳'}</span>
        <span className="cluster__name">{t(cluster.title as Parameters<typeof t>[0])}</span>
        {cluster.kind === 'ai' && <span className="cluster__tag">AI</span>}
        <span className="cluster__count">{members.length}</span>
      </div>
    </div>
  )
}
