import { useEffect, useRef, useState } from 'react'
import {
  store,
  useAiStage,
  useAiState,
  useClusters,
  useConnectFrom,
  useNodes,
} from '../store/canvasStore'
import { clamp } from '../utils'
import { emitUserActivity } from '../activity/activityBus'
import { EdgeLayer } from './EdgeLayer'
import { KnowledgeNode } from './KnowledgeNode'
import { ClusterFrame } from './ClusterFrame'
import { ThinkingRing } from './ThinkingRing'
import { EmptyState } from './EmptyState'
import { STAGE_LABEL } from '../aiStages'
import { GROWTH_KINDS } from '../domain/nodeKinds'
import { useT } from '../i18n'

const isSpaceNode = (n: { kind: string }) => !GROWTH_KINDS.has(n.kind)

interface Marquee {
  x: number
  y: number
  w: number
  h: number
}

export function CanvasViewport() {
  const { t } = useT()
  const containerRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const readoutRef = useRef<HTMLDivElement>(null)
  const spaceDown = useRef(false)
  const panState = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const marqueeRef = useRef<{ x0: number; y0: number } | null>(null)
  const [marquee, setMarquee] = useState<Marquee | null>(null)

  const nodes = useNodes()
  const clusters = useClusters()
  const connectFrom = useConnectFrom()
  const aiState = useAiState()
  const aiStage = useAiStage()

  const spaceNodes = Object.values(nodes).filter(isSpaceNode)
  const spaceEmpty = spaceNodes.length === 0

  // Imperatively apply the camera transform so pan/zoom never re-renders React tree.
  useEffect(() => {
    const apply = () => {
      const { x, y, z } = store.getState().view
      if (worldRef.current) {
        worldRef.current.style.transform = `translate(${x}px, ${y}px) scale(${z})`
      }
      if (readoutRef.current) {
        readoutRef.current.textContent = Math.round(z * 100) + '%'
      }
    }
    apply()
    return store.subscribe(apply)
  }, [])

  // Default to fit-to-content so the canvas is never an empty void at 1920×1080.
  // Only fit Space-owned nodes — Growth nodes live in the same store map but must
  // never influence the Space camera (they are laid out on a separate Galaxy plane).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    store.fitToContentFiltered(isSpaceNode, r.width, r.height)
  }, [])

  // Space-to-pan tracking.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = true
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false
        panState.current = null
        containerRef.current?.classList.remove('is-panning')
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // Esc cancels edge-connect mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') store.setConnectFrom(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Native wheel (passive:false) for zoom-around-cursor + two-finger pan.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const v = store.getState().view
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.0015)
        const nz = clamp(v.z * factor, 0.2, 2.5)
        const cx = e.clientX - rect.left
        const cy = e.clientY - rect.top
        const nx = cx - (cx - v.x) * (nz / v.z)
        const ny = cy - (cy - v.y) * (nz / v.z)
        store.setView({ x: nx, y: ny, z: nz })
      } else {
        store.setView({ x: v.x - e.deltaX, y: v.y - e.deltaY, z: v.z })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    const rect = (containerRef.current as HTMLDivElement).getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    if (spaceDown.current) {
      const v = store.getState().view
      panState.current = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y }
      containerRef.current?.classList.add('is-panning')
      return
    }
    marqueeRef.current = { x0: px, y0: py }
    setMarquee({ x: px, y: py, w: 0, h: 0 })
    store.clearSelection()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (panState.current) {
      const v = store.getState().view
      store.setView({
        x: panState.current.vx + (e.clientX - panState.current.x),
        y: panState.current.vy + (e.clientY - panState.current.y),
        z: v.z,
      })
      return
    }
    if (marqueeRef.current) {
      const rect = (containerRef.current as HTMLDivElement).getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const { x0, y0 } = marqueeRef.current
      setMarquee({
        x: Math.min(x0, px),
        y: Math.min(y0, py),
        w: Math.abs(px - x0),
        h: Math.abs(py - y0),
      })
    }
  }

  const onPointerUp = () => {
    if (panState.current) {
      panState.current = null
      containerRef.current?.classList.remove('is-panning')
    }
    if (marqueeRef.current && marquee) {
      const v = store.getState().view
      const x1 = (marquee.x - v.x) / v.z
      const y1 = (marquee.y - v.y) / v.z
      const x2 = (marquee.x + marquee.w - v.x) / v.z
      const y2 = (marquee.y + marquee.h - v.y) / v.z
      const inside = Object.values(store.getState().nodes)
        .filter(isSpaceNode)
        .filter(
          n =>
            n.position.x > Math.min(x1, x2) &&
            n.position.x < Math.max(x1, x2) &&
            n.position.y > Math.min(y1, y2) &&
            n.position.y < Math.max(y1, y2),
        )
      store.setSelection(inside.map(n => n.id))
      emitUserActivity('node.selected', { nodeIds: inside.map(n => n.id) })
      marqueeRef.current = null
      setMarquee(null)
    }
  }

  return (
    <div
      className={'canvas-viewport' + (connectFrom ? ' is-connecting' : '')}
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="world-layer" ref={worldRef}>
        {Object.values(clusters).map(c => (
          <ClusterFrame key={c.id} cluster={c} />
        ))}
        <EdgeLayer />
        {Object.values(nodes)
          .filter(isSpaceNode)
          .map(n => (
            <KnowledgeNode key={n.id} node={n} />
          ))}
      </div>

      {spaceEmpty && (
        <EmptyState variant="space" title={t('empty.title.space')} description={t('empty.desc.space')} />
      )}
      {marquee && (
        <div
          className="marquee"
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      )}
      {connectFrom && (
        <div className="connect-hint">{t('canvas.connectHint')}</div>
      )}
      {aiStage && aiState === 'inferring' && (
        <div className="stage-banner" role="status">
          <ThinkingRing />
          <span className="stage-banner__label">{t(STAGE_LABEL[aiStage])}</span>
          <span className="stage-banner__dots">
            <i />
            <i />
            <i />
          </span>
        </div>
      )}
      <div className="zoom-readout" ref={readoutRef}>
        {Math.round(store.getState().view.z * 100)}%
      </div>
    </div>
  )
}
