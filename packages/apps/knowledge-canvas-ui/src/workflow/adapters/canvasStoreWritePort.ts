// CanvasStore write port — the ONLY file that writes knowledge into the UI store
// (P2-5 route A1, rulings D2/D3).
//
// BOUNDARY
//   The store remains the UI's in-memory display model (ruling D3). Routing
//   governed writes through this port does NOT promote it to a long-term
//   knowledge source: that question stays open and belongs with a future
//   persistence target (SQLite / vector db). What this file buys us is that the
//   governance chain finally has a real target instead of a test double, and that
//   exactly ONE file knows how the store is mutated.
//
// CASCADE NOTE
//   `CanvasStore.removeNode` also drops every edge touching that node. That is
//   the store's own domain rule, so a `node.delete` op removes relations as well
//   -- a documented consequence of delegating to the store rather than a surprise
//   of this adapter.
//
// Dependency: this file imports the store by TYPE plus an injected instance. It
// never reaches for a module-level singleton, so binding stays the caller's job
// (see `bindStore` in the store module).

import type { CanvasStore } from '../../store/canvasStore'
import type { KnowledgeEdge, KnowledgeNode } from '../../types'
import type { EdgePatch, KnowledgeWritePort, NodePatch, WriteOutcome } from '../knowledgeWritePort'

function cloneNode(node: KnowledgeNode): KnowledgeNode {
  return { ...node, position: { ...node.position } }
}

function cloneEdge(edge: KnowledgeEdge): KnowledgeEdge {
  return { ...edge }
}

export function createCanvasStoreWritePort(store: CanvasStore): KnowledgeWritePort {
  const state = () => store.getState()

  return {
    nodeCount(): number {
      return Object.keys(state().nodes).length
    },

    createNode(node: KnowledgeNode): WriteOutcome<KnowledgeNode> {
      const existing = state().nodes[node.id]
      if (existing !== undefined) return { existed: true, before: cloneNode(existing) }
      store.addNode(cloneNode(node))
      return { existed: false }
    },

    updateNode(id: string, patch: NodePatch): WriteOutcome<KnowledgeNode> {
      const current = state().nodes[id]
      if (current === undefined) return { existed: false }
      const before = cloneNode(current)
      const next: KnowledgeNode = {
        ...current,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.meta !== undefined ? { meta: { ...patch.meta } } : {}),
        ...(patch.aiStatus !== undefined ? { aiStatus: patch.aiStatus } : {}),
        ...(patch.ownerAgent !== undefined ? { ownerAgent: patch.ownerAgent } : {}),
      }
      store.setNodes(Object.values(state().nodes).map(node => (node.id === id ? next : node)))
      return { existed: true, before }
    },

    deleteNode(id: string): WriteOutcome<KnowledgeNode> {
      const current = state().nodes[id]
      if (current === undefined) return { existed: false }
      const before = cloneNode(current)
      store.removeNode(id)
      return { existed: true, before }
    },

    createEdge(edge: KnowledgeEdge): WriteOutcome<KnowledgeEdge> {
      const existing = state().edges[edge.id]
      if (existing !== undefined) return { existed: true, before: cloneEdge(existing) }
      store.addEdge(cloneEdge(edge))
      return { existed: false }
    },

    updateEdge(id: string, patch: EdgePatch): WriteOutcome<KnowledgeEdge> {
      const current = state().edges[id]
      if (current === undefined) return { existed: false }
      const before = cloneEdge(current)
      const next: KnowledgeEdge = {
        ...current,
        ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
        ...(patch.reason !== undefined ? { reason: patch.reason } : {}),
        ...(patch.from !== undefined ? { from: patch.from } : {}),
        ...(patch.to !== undefined ? { to: patch.to } : {}),
      }
      store.setEdges(Object.values(state().edges).map(edge => (edge.id === id ? next : edge)))
      return { existed: true, before }
    },

    deleteEdge(id: string): WriteOutcome<KnowledgeEdge> {
      const current = state().edges[id]
      if (current === undefined) return { existed: false }
      const before = cloneEdge(current)
      store.removeEdge(id)
      return { existed: true, before }
    },
  }
}
