import { bindStore, createStore, store } from '../store/canvasStore'
import { getSharedUniverse } from '../knowledge/knowledgeUniverse'
import { SEED_CLUSTERS } from './data'
import { seedGalaxy } from '../demo/galaxy'
import { startDemo } from '../demo/sequencer'

// Dev-only capture probe (Stage 5 verification): expose the canvas store on
// `window` so scripts/capture-showcase.cjs can assert sharedBackendIdentity
// (store.backend === getSharedUniverse()). No UI/observable app effect.
declare global {
  interface Window {
    __kcuStore?: import('../store/canvasStore').CanvasStore
  }
}

/** Construct the backend + store, bind the module-level singleton, seed data. */
export async function bootstrap(): Promise<void> {
  // Stage 5 D2: the canvas store and the employee lens MUST share ONE backend
  // instance. We pull it from the Shared Knowledge Universe seam instead of
  // constructing a second MockBackend() — so canvas + lens are truly unified.
  const backend = getSharedUniverse()
  const s = createStore(backend)
  bindStore(s)
  window.__kcuStore = s
  const [nodes, edges] = await Promise.all([backend.listNodes(), backend.listEdges()])

  // Dev-only verification hook: force an empty surface for EmptyState screenshots.
  // Absent in normal runs — zero effect on product behavior.
  const emptyParam = new URLSearchParams(location.search).get('kcuEmpty')
  const spaceEmpty = emptyParam === 'space' || emptyParam === 'welcome' || emptyParam === 'all'
  const growthEmpty = emptyParam === 'growth' || emptyParam === 'welcome' || emptyParam === 'all'

  if (!spaceEmpty) {
    s.setNodes(nodes)
    s.setEdges(edges)
    // Seed the pre-built cluster so the frame is visible before any AI action.
    const clusters: Record<string, (typeof SEED_CLUSTERS)[number]> = {}
    SEED_CLUSTERS.forEach(c => (clusters[c.id] = c))
    s.setClusters(clusters)
  }
  // Seed the Galaxy / Growth knowledge graph (v1.3).
  if (!growthEmpty) {
    seedGalaxy(s)
  }

  // Dev-only verification hook: auto-start the Demo Flow for headless screenshots.
  // Absent in normal runs — zero effect on product behavior.
  const demoParam = new URLSearchParams(location.search).get('kcuDemo')
  if (demoParam === '1') {
    startDemo()
  }
}

// Re-export for callers that want a handle, but the canonical access is `store`.
export { store }
