import { useEffect, useRef, useState } from 'react'
import {
  store,
  useActivePath,
  useLearningPaths,
  useNodes,
} from '../store/canvasStore'
import { clamp } from '../utils'
import { GalaxyNode } from './GalaxyNode'
import { GalaxyEdgeLayer } from './GalaxyEdgeLayer'
import { LearningPathTrack } from './LearningPathTrack'
import { EmptyState } from './EmptyState'
import { LearningOverview } from './LearningOverview'
import { GROWTH_KINDS } from '../domain/nodeKinds'
import { useT } from '../i18n'

export function GalaxyCanvas() {
  const { t } = useT()
  const containerRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const readoutRef = useRef<HTMLDivElement>(null)
  const spaceDown = useRef(false)
  const panState = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const [hud, setHud] = useState(false)

  const allNodes = useNodes()
  const paths = useLearningPaths()
  const activePathId = useActivePath()
  const growthNodes = Object.values(allNodes).filter(n => GROWTH_KINDS.has(n.kind))
  const growthEmpty = growthNodes.length === 0

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

  // Fit the camera to growth nodes only (never the Space seed).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    store.fitToContentFiltered(n => GROWTH_KINDS.has(n.kind), r.width, r.height)
  }, [])

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
    store.clearSelection()
    setHud(true)
    void px
    void py
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (panState.current) {
      const v = store.getState().view
      store.setView({
        x: panState.current.vx + (e.clientX - panState.current.x),
        y: panState.current.vy + (e.clientY - panState.current.y),
        z: v.z,
      })
    }
  }
  const onPointerUp = () => {
    if (panState.current) {
      panState.current = null
      containerRef.current?.classList.remove('is-panning')
    }
  }

  return (
    <div
      className="galaxy-viewport"
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="galaxy-starfield" aria-hidden />
      <div className="world-layer" ref={worldRef}>
        <GalaxyEdgeLayer />
        <svg className="lptrack-layer" width={1} height={1}>
          {Object.values(paths).map(p => (
            <LearningPathTrack key={p.id} path={p} active={p.id === activePathId} />
          ))}
        </svg>
        {growthNodes.map((n, i) => (
          <GalaxyNode key={n.id} node={n} index={i} />
        ))}
      </div>

      {growthEmpty && (
        <EmptyState variant="growth" title={t('empty.title.growth')} description={t('empty.desc.growth')} />
      )}

      <LearningOverview />

      {hud && (
        <div className="galaxy-hint">{t('hud.galaxy')}</div>
      )}
      <div className="zoom-readout" ref={readoutRef}>
        {Math.round(store.getState().view.z * 100)}%
      </div>
    </div>
  )
}
