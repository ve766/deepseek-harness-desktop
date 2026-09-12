// Galaxy / Growth demo logic. Pure front-end demo data + a scripted "Nox generates
// a learning path" flow. No network, no embedding, no agent core — matches the
// "MockBackend only" constraint. All AI actions remain explainable + undoable.
// Moved from `mock/galaxy.ts` in P2-1 (demo driver, not fixture data).
import { store } from '../store/canvasStore'
import type { CanvasStore } from '../store/canvasStore'
import {
  GROWTH_NODES,
  GROWTH_PATHS,
  GROWTH_PROGRESS,
  GROWTH_RECOMMENDATIONS,
  GROWTH_RELATIONSHIPS,
} from '../mock/data'
import { layoutGalaxy } from '../galaxyLayout'

/** Seed the Growth-mode knowledge graph into the store (positions via layoutGalaxy). */
export function seedGalaxy(s: CanvasStore): void {
  const layout = layoutGalaxy(GROWTH_NODES)
  const positioned = GROWTH_NODES.map(n => ({ ...n, position: layout[n.id] ?? n.position }))
  const merged = { ...s.getState().nodes }
  positioned.forEach(n => (merged[n.id] = n))
  s.setNodes(Object.values(merged))

  s.setRelationships(GROWTH_RELATIONSHIPS)
  s.setLearningPaths(GROWTH_PATHS)
  s.setProgress(GROWTH_PROGRESS)
  s.setRecommendations(GROWTH_RECOMMENDATIONS)
  s.setActivePath(GROWTH_PATHS[0]?.id ?? null)
}

/** Scripted Nox demo: light up the chosen learning path by filling mastery in order. */
export function runLearningPathDemo(pathId?: string): void {
  const id = pathId ?? store.getState().activePathId ?? 'path-agent'
  const path = store.getState().learningPaths[id]
  if (!path) return

  store.setActivePath(id)
  store.setAiState('inferring')
  store.setInsight({ tone: 'info', text: 'nox.genPath' })

  window.setTimeout(() => {
    store.setAiState('idle')
    store.setInsight({ tone: 'success', text: 'nox.pathLit' })
  }, 1200)

  // Sequentially raise each node's mastery so the rings visibly fill.
  path.nodeIds.forEach((nid, i) => {
    window.setTimeout(() => {
      const cur = store.getState().progress[nid]?.mastery ?? 0
      store.setMastery(nid, Math.min(0.95, cur + 0.55))
    }, 1300 + i * 520)
  })
}
