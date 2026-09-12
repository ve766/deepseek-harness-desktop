// Moved from `mock/sequencer.ts` in P2-1 (demo driver, not fixture data).
// UI must not import `mock/*`; layering is now Component → demo/ → mock/ (data).
import { useSyncExternalStore } from 'react'
import { store } from '../store/canvasStore'
import type { KnowledgeNode } from '../types'
import { dist, freePosition, uid } from '../utils'
import { DEMO_SPACE_CLUSTER, DEMO_SPACE_EDGES, DEMO_SPACE_NODES } from '../mock/data'

const REASONS = ['edge.reason1', 'edge.reason2', 'edge.reason3']

/**
 * Scripted "Import PDF → stages → Node Generation → AIConnection Reveal → AI Cluster"
 * flow, driven entirely by mock data. Every AI action is explainable (reason on the
 * edge), observable (stage banner + thinking ring + insight panel), and undoable
 * (clearAiGenerated removes the draft node and its AI cluster).
 *
 * Stage machine: import → analyze → scan → relate → map → done
 */
export function runImportDemo(): void {
  if (store.getState().aiState !== 'idle') return

  store.setAiState('inferring')
  store.setAiStage('import')
  store.setInsight({ tone: 'info', text: 'insight.seqImport' })

  window.setTimeout(() => {
    store.setAiStage('analyze')
    store.setInsight({ tone: 'info', text: 'insight.seqAnalyze' })
  }, 600)

  window.setTimeout(() => {
    store.setAiStage('scan')
    store.setInsight({ tone: 'info', text: 'insight.seqScan' })
  }, 1200)

  window.setTimeout(() => {
    store.setAiStage('relate')
    const pos = freePosition(store.getState().view)
    const id = uid('doc')
    const node: KnowledgeNode = {
      id,
      kind: 'document',
      title: 'Q3 产品规划.pdf',
      meta: { pages: '24', size: '1.8MB' },
      source: { type: 'pdf', uri: 'mock://uploads/q3.pdf' },
      aiStatus: 'draft',
      position: pos,
      ownerAgent: 'assistant',
    }
    store.addNode(node)
    store.setInsight({ tone: 'success', text: 'insight.seqNode' })

    const others = Object.values(store.getState().nodes).filter(n => n.id !== id)
    const near = others.filter(n => dist(n.position, pos) < 360).slice(0, 2)
    if (near.length) {
      near.forEach((n, i) => {
        store.addEdge({
          id: uid('e'),
          from: id,
          to: n.id,
          kind: 'ai-auto',
          reason: REASONS[i % REASONS.length],
        })
      })
      // AI-created cluster carries the special marker (undoable).
      store.addCluster([id, ...near.map(n => n.id)], 'cluster.aiTitle', 'ai')
    }
  }, 1800)

  window.setTimeout(() => {
    store.setAiStage('map')
    store.setInsight({ tone: 'info', text: 'insight.seqMap' })
  }, 2400)

  window.setTimeout(() => {
    store.setAiStage('done')
    store.autoClusterIfNeeded()
  }, 3000)

  window.setTimeout(() => {
    store.setAiState('idle')
    store.setAiStage(null)
    store.setInsight({ tone: 'info', text: 'insight.seqDoneMap' })
  }, 3400)
}

// ---------------------------------------------------------------------------
// Demo Flow (P4-1/4): a scripted, fully-mock showcase of
// "import assets → AI organize → discover growth". Reuses runImportDemo() for the
// Space phase. No real Agent Core / LLM Router / Embedding / KG / Memory involved.
// ---------------------------------------------------------------------------

/** Inject the independent demo-* subset into the current graph (idempotent-ish: adds only). */
function seedDemo(): void {
  store.setNodes([...Object.values(store.getState().nodes), ...DEMO_SPACE_NODES])
  store.setEdges([...Object.values(store.getState().edges), ...DEMO_SPACE_EDGES])
  const clusters = { ...store.getState().clusters }
  DEMO_SPACE_CLUSTER.forEach(c => (clusters[c.id] = c))
  store.setClusters(clusters)
}

/** Pre-demo snapshot so endDemo() can restore the exact prior graph. */
let demoSnapshot: ReturnType<typeof store.getState> | null = null

/** Demo Flow active flag (P4-1/4), held at module scope to avoid touching the store.
 *  Exposed via useDemoActive(), which re-renders on any store change — the demo always
 *  mutates the store, so the flag is observed live without a dedicated store field. */
let demoActiveFlag = false

export function useDemoActive(): boolean {
  return useSyncExternalStore(
    cb => store.subscribe(cb),
    () => demoActiveFlag,
    () => demoActiveFlag,
  )
}

/** Start the Demo Flow: snapshot, flag active, seed demo data, enter Space, run Nox. */
export function startDemo(): void {
  if (demoActiveFlag) return
  const s = store.getState()
  demoSnapshot = {
    nodes: { ...s.nodes },
    edges: { ...s.edges },
    clusters: { ...s.clusters },
    mode: s.mode,
    relationships: { ...s.relationships },
    learningPaths: { ...s.learningPaths },
    progress: { ...s.progress },
    recommendations: { ...s.recommendations },
  }
  demoActiveFlag = true
  seedDemo()
  store.setMode('space')
  runImportDemo()
}

/** Full UI entry point (Welcome "体验示例知识库"). Equivalent to startDemo(). */
export function runDemoFlow(): void {
  startDemo()
}

/** End the Demo Flow: restore the pre-demo snapshot, reset AI state, clear the flag. */
export function endDemo(): void {
  const snap = demoSnapshot
  if (snap) {
    store.setNodes(Object.values(snap.nodes))
    store.setEdges(Object.values(snap.edges))
    store.setClusters(snap.clusters)
    store.setRelationships(Object.values(snap.relationships))
    store.setLearningPaths(Object.values(snap.learningPaths))
    store.setProgress(Object.values(snap.progress))
    store.setRecommendations(Object.values(snap.recommendations))
    store.setMode(snap.mode)
  }
  store.clearAiGenerated()
  demoActiveFlag = false
  demoSnapshot = null
  store.setInsight({ tone: 'info', text: 'demo.done' })
}
