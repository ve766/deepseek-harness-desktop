import { useSyncExternalStore } from 'react'
import type {
  AiStage,
  AiState,
  AgentId,
  CanvasAppearance,
  Cluster,
  ClusterKind,
  InsightMessage,
  KnowledgeEdge,
  KnowledgeNode,
  LearningPath,
  Progress,
  AIRecommendation,
  Relationship,
  SpaceMode,
  ViewTransform,
} from '../types'
import type { KnowledgeBackend } from '../backend'
import { clamp, NODE_H, NODE_W, uid } from '../utils'

const DEFAULT_APPEARANCE: CanvasAppearance = {
  backgroundType: 'default',
  blur: 0,
  overlayOpacity: 0.28,
  backgroundFit: 'fill',
}

interface StoreState {
  // ---- Space (v1.1, untouched behavior) ----
  nodes: Record<string, KnowledgeNode>
  edges: Record<string, KnowledgeEdge>
  view: ViewTransform
  selection: Set<string>
  clusters: Record<string, Cluster>
  aiState: AiState
  aiStage: AiStage
  insight: InsightMessage | null
  connectFrom: string | null

  // ---- Galaxy / Growth (v1.3 additions) ----
  mode: SpaceMode
  relationships: Record<string, Relationship>
  learningPaths: Record<string, LearningPath>
  progress: Record<string, Progress>
  recommendations: Record<string, AIRecommendation>
  appearance: CanvasAppearance
  /** Currently highlighted learning path (Galaxy mode). */
  activePathId: string | null
}

class CanvasStore {
  private state: StoreState
  private listeners = new Set<() => void>()
  readonly backend: KnowledgeBackend

  constructor(backend: KnowledgeBackend) {
    this.backend = backend
    this.state = {
      nodes: {},
      edges: {},
      view: { x: 0, y: 0, z: 1 },
      selection: new Set(),
      clusters: {},
      aiState: 'idle',
      aiStage: null,
      insight: null,
      connectFrom: null,
      // Galaxy defaults
      mode: 'space',
      relationships: {},
      learningPaths: {},
      progress: {},
      recommendations: {},
      appearance: { ...DEFAULT_APPEARANCE },
      activePathId: null,
    }
  }

  getState = (): StoreState => this.state
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
  private set(patch: Partial<StoreState>): void {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }

  // ---- view (high frequency; applied imperatively by CanvasViewport) ----
  setView(v: ViewTransform): void {
    this.state = { ...this.state, view: v }
    this.listeners.forEach((l) => l())
  }

  // ---- mode ----
  setMode(m: SpaceMode): void {
    this.set({ mode: m })
  }

  // ---- nodes ----
  setNodes(nodes: KnowledgeNode[]): void {
    const map: Record<string, KnowledgeNode> = {}
    nodes.forEach((n) => (map[n.id] = n))
    this.set({ nodes: map })
  }
  addNode(n: KnowledgeNode): void {
    this.set({ nodes: { ...this.state.nodes, [n.id]: n } })
  }
  setEdges(edges: KnowledgeEdge[]): void {
    const map: Record<string, KnowledgeEdge> = {}
    edges.forEach((e) => (map[e.id] = e))
    this.set({ edges: map })
  }
  updateNodePosition(id: string, x: number, y: number): void {
    const n = this.state.nodes[id]
    if (!n) return
    this.set({ nodes: { ...this.state.nodes, [id]: { ...n, position: { x, y } } } })
  }
  removeNode(id: string): void {
    const nodes = { ...this.state.nodes }
    delete nodes[id]
    const edges = { ...this.state.edges }
    Object.values(edges).forEach((e) => {
      if (e.from === id || e.to === id) delete edges[e.id]
    })
    const selection = new Set(this.state.selection)
    selection.delete(id)
    const clusters = { ...this.state.clusters }
    Object.values(clusters).forEach((c) => {
      c.memberIds = c.memberIds.filter((m) => m !== id)
    })
    this.set({ nodes, edges, selection, clusters })
  }

  // ---- edges ----
  addEdge(e: KnowledgeEdge): void {
    this.set({ edges: { ...this.state.edges, [e.id]: e } })
  }
  removeEdge(id: string): void {
    const edges = { ...this.state.edges }
    delete edges[id]
    this.set({ edges })
  }

  // ---- relationships (Galaxy explainable edges) ----
  setRelationships(arr: Relationship[]): void {
    const map: Record<string, Relationship> = {}
    arr.forEach((r) => (map[r.id] = r))
    this.set({ relationships: map })
  }
  addRelationship(r: Relationship): void {
    this.set({ relationships: { ...this.state.relationships, [r.id]: r } })
  }

  // ---- selection ----
  setSelection(ids: string[]): void {
    this.set({ selection: new Set(ids) })
  }
  toggleSelection(id: string): void {
    const s = new Set(this.state.selection)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    this.set({ selection: s })
  }
  clearSelection(): void {
    if (this.state.selection.size) this.set({ selection: new Set() })
  }

  // ---- clusters / frames ----
  addCluster(ids: string[], label: string, kind: ClusterKind = 'auto'): string {
    const members = ids.filter((id) => this.state.nodes[id])
    if (members.length < 1) return ''
    const cid = uid('cl')
    const clusters = {
      ...this.state.clusters,
      [cid]: { id: cid, title: label, kind, memberIds: members } as Cluster,
    }
    const nodes = { ...this.state.nodes }
    members.forEach((id) => {
      if (nodes[id]) nodes[id] = { ...nodes[id], groupId: cid }
    })
    this.set({ clusters, nodes })
    return cid
  }
  /** User "group" action — always an `auto` (hand-made) cluster. */
  groupNodes(ids: string[], label: string): string {
    return this.addCluster(ids, label, 'auto')
  }
  removeCluster(id: string): void {
    const clusters = { ...this.state.clusters }
    delete clusters[id]
    const nodes = { ...this.state.nodes }
    Object.values(nodes).forEach((n) => {
      if (n.groupId === id) {
        const { groupId: _drop, ...rest } = n
        nodes[n.id] = rest
      }
    })
    this.set({ clusters, nodes })
  }
  /** Replace the whole cluster map (used to seed the pre-built frame). */
  setClusters(map: Record<string, Cluster>): void {
    const nodes = { ...this.state.nodes }
    Object.values(map).forEach((c) => {
      c.memberIds.forEach((id) => {
        if (nodes[id]) nodes[id] = { ...nodes[id], groupId: c.id }
      })
    })
    this.set({ clusters: map, nodes })
  }

  // ---- edge connection mode ----
  setConnectFrom(id: string | null): void {
    this.set({ connectFrom: id })
  }

  // ---- AI demo state ----
  setAiState(s: AiState): void {
    this.set({ aiState: s })
  }
  setAiStage(s: AiStage): void {
    this.set({ aiStage: s })
  }
  setInsight(m: InsightMessage | null): void {
    this.set({ insight: m })
  }

  /** Remove AI-generated artifacts: draft/auto nodes + their edges + AI clusters. */
  clearAiGenerated(): void {
    const nodes: Record<string, KnowledgeNode> = {}
    Object.values(this.state.nodes).forEach((n) => {
      if (n.aiStatus === 'draft' || n.aiStatus === 'auto') return
      nodes[n.id] = n
    })
    const edges: Record<string, KnowledgeEdge> = {}
    Object.values(this.state.edges).forEach((e) => {
      if (nodes[e.from] && nodes[e.to]) edges[e.id] = e
    })
    const clusters: Record<string, Cluster> = {}
    Object.values(this.state.clusters).forEach((c) => {
      if (c.kind === 'ai') return // AI clusters are fully undoable
      const memberIds = c.memberIds.filter((m) => nodes[m])
      if (memberIds.length > 1) clusters[c.id] = { ...c, memberIds }
    })
    // Also drop AI-generated learning paths & recommendations (explainable + undoable).
    const learningPaths: Record<string, LearningPath> = {}
    Object.values(this.state.learningPaths).forEach((p) => {
      if (p.aiGenerated) return
      learningPaths[p.id] = p
    })
    const recommendations: Record<string, AIRecommendation> = {}
    Object.values(this.state.recommendations).forEach((r) => {
      if (r.accepted === false && r.agentId) return // AI-generated, undoable
      recommendations[r.id] = r
    })
    this.set({
      nodes,
      edges,
      clusters,
      learningPaths,
      recommendations,
      selection: new Set(),
      insight: null,
      aiState: 'idle',
      aiStage: null,
    })
  }

  /** Centre + zoom the camera so all nodes fit within the given viewport size.
   *  Honours a `isHub` node as the focal point when present. */
  fitToContent(width: number, height: number): void {
    this.fitToContentFiltered(() => true, width, height)
  }

  /** Like fitToContent but only considers nodes matching `pred`. */
  fitToContentFiltered(
    pred: (n: KnowledgeNode) => boolean,
    width: number,
    height: number,
  ): void {
    const nodes = Object.values(this.state.nodes).filter(pred)
    if (nodes.length === 0 || width < 2 || height < 2) {
      this.setView({ x: 40, y: 20, z: 1 })
      return
    }
    const hub = nodes.find((n) => n.isHub)
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of nodes) {
      minX = Math.min(minX, n.position.x)
      minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + NODE_W)
      maxY = Math.max(maxY, n.position.y + NODE_H)
    }
    const pad = 120
    const bw = maxX - minX + NODE_W
    const bh = maxY - minY + NODE_H
    const z = clamp(Math.min((width - pad * 2) / bw, (height - pad * 2) / bh), 0.2, 1.4)
    const boxCx = (minX + maxX) / 2
    const boxCy = (minY + maxY) / 2
    const focalX = hub ? hub.position.x + NODE_W / 2 : boxCx
    const focalY = hub ? hub.position.y + NODE_H / 2 : boxCy
    const x = width / 2 - focalX * z
    const y = height / 2 - focalY * z
    this.setView({ x, y, z })
  }

  /** Latent layout helper: when the graph gets crowded (>= threshold), auto-group
   *  nodes by owning employee so the canvas stays legible. Not triggered by the
   *  current seed/demo sizes, but wired in so density growth is handled. */
  autoClusterIfNeeded(threshold = 20): void {
    const nodes = Object.values(this.state.nodes)
    if (nodes.length < threshold) return
    if (Object.keys(this.state.clusters).length) return
    const byAgent: Record<string, string[]> = {}
    nodes.forEach((n) => {
      const k: AgentId = n.ownerAgent ?? 'assistant'
      ;(byAgent[k] ??= []).push(n.id)
    })
    const clusters: Record<string, Cluster> = { ...this.state.clusters }
    for (const [agent, ids] of Object.entries(byAgent)) {
      if (ids.length < 2) continue
      const id = uid('cl')
      clusters[id] = { id, title: 'cluster.autoSuffix', kind: 'auto', memberIds: ids }
    }
    if (Object.keys(clusters).length !== Object.keys(this.state.clusters).length) {
      this.set({ clusters })
    }
  }

  // ---- learning paths ----
  setLearningPaths(arr: LearningPath[]): void {
    const map: Record<string, LearningPath> = {}
    arr.forEach((p) => (map[p.id] = p))
    this.set({ learningPaths: map })
  }
  addLearningPath(p: LearningPath): void {
    this.set({ learningPaths: { ...this.state.learningPaths, [p.id]: p } })
  }

  // ---- progress / mastery ----
  setProgress(arr: Progress[]): void {
    const map: Record<string, Progress> = {}
    arr.forEach((p) => (map[p.nodeId] = p))
    this.set({ progress: map })
  }
  /** Update a concept's mastery; keeps node.concept.mastery + the progress map in sync. */
  setMastery(nodeId: string, value: number): void {
    const v = clamp(value, 0, 1)
    const node = this.state.nodes[nodeId]
    if (node) {
      const concept = { ...(node.concept ?? {}), mastery: v }
      this.set({
        nodes: { ...this.state.nodes, [nodeId]: { ...node, concept } },
      })
    }
    const prev = this.state.progress[nodeId]
    const status: Progress['status'] = v >= 0.8 ? 'known' : v > 0 ? 'learning' : 'gap'
    this.set({
      progress: {
        ...this.state.progress,
        [nodeId]: {
          nodeId,
          mastery: v,
          status,
          updatedAt: Date.now(),
          ...(prev ? { updatedAt: prev.updatedAt } : {}),
        },
      },
    })
  }

  // ---- AI recommendations (Nox navigator) ----
  setRecommendations(arr: AIRecommendation[]): void {
    const map: Record<string, AIRecommendation> = {}
    arr.forEach((r) => (map[r.id] = r))
    this.set({ recommendations: map })
  }
  addRecommendation(r: AIRecommendation): void {
    this.set({ recommendations: { ...this.state.recommendations, [r.id]: r } })
  }

  // ---- canvas appearance (local only; never uploaded) ----
  setAppearance(a: CanvasAppearance): void {
    this.set({ appearance: { ...this.state.appearance, ...a } })
  }

  // ---- active learning path (Galaxy highlight) ----
  setActivePath(id: string | null): void {
    this.set({ activePathId: id })
  }
}

export type { CanvasStore }
export { uid }
export function createStore(backend: KnowledgeBackend): CanvasStore {
  return new CanvasStore(backend)
}

// ---------------------------------------------------------------------------
// React bindings (selectors return stable references unless their slice changed)
// ---------------------------------------------------------------------------
export function useStore<T>(selector: (s: StoreState) => T): T {
  return useSyncExternalStore(
    (fn) => store.subscribe(fn),
    () => selector(store.getState()),
  )
}
export const useNodes = () => useStore((s) => s.nodes)
export const useEdges = () => useStore((s) => s.edges)
export const useSelection = () => useStore((s) => s.selection)
export const useAiState = () => useStore((s) => s.aiState)
export const useAiStage = () => useStore((s) => s.aiStage)
export const useInsight = () => useStore((s) => s.insight)
export const useConnectFrom = () => useStore((s) => s.connectFrom)
export const useClusters = () => useStore((s) => s.clusters)
export const useGroups = useClusters

// Galaxy bindings
export const useMode = () => useStore((s) => s.mode)
export const useRelationships = () => useStore((s) => s.relationships)
export const useLearningPaths = () => useStore((s) => s.learningPaths)
export const useProgress = () => useStore((s) => s.progress)
export const useRecommendations = () => useStore((s) => s.recommendations)
export const useAppearance = () => useStore((s) => s.appearance)
export const useActivePath = () => useStore((s) => s.activePathId)

// Placeholder; assigned by main.tsx after the backend is constructed.
export let store: CanvasStore

export function bindStore(s: CanvasStore): void {
  store = s
}

// Re-export AgentId + Cluster for convenience in components.
export type { AgentId, Cluster }
