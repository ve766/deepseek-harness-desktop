import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { KnowledgeNode as NodeT } from '../types'
import { store, useConnectFrom, useSelection } from '../store/canvasStore'
import { AGENT_MAP } from '../domain/agents'
import { useT } from '../i18n'
import { emitUserActivity } from '../activity/activityBus'
import { AgentAvatar } from './AgentAvatar'

const KIND_META: Record<NodeT['kind'], { icon: string; accent: string }> = {
  document: { icon: '📄', accent: '#2f6df6' },
  video: { icon: '🎬', accent: '#8b5cf6' },
  conversation: { icon: '💬', accent: '#30b0c7' },
  project: { icon: '🗂', accent: '#f5a623' },
  concept: { icon: '✸', accent: '#5e5ce6' },
  skill: { icon: '✦', accent: '#0a84ff' },
  memory: { icon: '❖', accent: '#34c759' },
  task: { icon: '✓', accent: '#ff9f0a' },
  learningPath: { icon: '⟿', accent: '#ff375f' },
}

export function KnowledgeNode({ node }: { node: NodeT }) {
  const { t } = useT()
  const selection = useSelection()
  const connectFrom = useConnectFrom()
  const selected = selection.has(node.id)
  const meta = KIND_META[node.kind]
  const owner = node.ownerAgent ? AGENT_MAP[node.ownerAgent] : undefined
  const connecting = connectFrom === node.id
  const kindLabel = t(('kind.' + node.kind) as Parameters<typeof t>[0])

  const onPointerDown = (e: ReactPointerEvent) => {
    e.stopPropagation()
    if (connectFrom && connectFrom !== node.id) {
      store.addEdge({
        id: 'e-' + Math.random().toString(36).slice(2, 9),
        from: connectFrom,
        to: node.id,
        kind: 'manual',
        reason: 'node.manualReason',
      })
      store.setConnectFrom(null)
      return
    }
    store.setSelection([node.id])
    emitUserActivity('node.clicked', { nodeIds: [node.id] })
    const startX = e.clientX
    const startY = e.clientY
    const orig = { ...node.position }
    const z = store.getState().view.z
    const move = (ev: PointerEvent) => {
      store.updateNodePosition(
        node.id,
        orig.x + (ev.clientX - startX) / z,
        orig.y + (ev.clientY - startY) / z,
      )
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div
      className={
        'knode knode--' +
        node.kind +
        (selected ? ' is-selected' : '') +
        (connecting ? ' is-connecting' : '')
      }
      style={
        {
          left: node.position.x,
          top: node.position.y,
          '--accent': meta.accent,
        } as CSSProperties
      }
      onPointerDown={onPointerDown}
      onDoubleClick={() => store.removeNode(node.id)}
      title={t('node.moveTip')}
    >
      <div className="knode__head">
        <span className="knode__icon">{meta.icon}</span>
        <span className="knode__kind">{kindLabel}</span>
        {node.aiStatus === 'auto' && <span className="knode__badge knode__badge--ai">AI</span>}
        {node.aiStatus === 'draft' && <span className="knode__badge knode__badge--draft">{t('node.badgeDraft')}</span>}
      </div>
      <div className="knode__title">{node.title}</div>
      <div className="knode__meta">
        {Object.values(node.meta).map((v, i) => (
          <span key={i} className="knode__chip">
            {v}
          </span>
        ))}
      </div>
      <div className="knode__foot">
        {owner && <AgentAvatar agent={owner} size={20} />}
        <button
          className="knode__connect"
          title={t('node.connectTip')}
          onPointerDown={(e) => {
            e.stopPropagation()
            store.setConnectFrom(connectFrom ? null : node.id)
          }}
        >
          ⤴
        </button>
      </div>
    </div>
  )
}
