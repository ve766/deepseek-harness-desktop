// Deterministic layered layout for the Galaxy / Growth canvas.
// Concepts are arranged by "tier" (prerequisite depth) so a learning path reads
// top-to-bottom. Pure function → same input always yields the same coordinates.

import type { KnowledgeNode } from './types'
import { NODE_W } from './utils'

const GAP_X = 280
const GAP_Y = 220
const ORIGIN_X = 160
const ORIGIN_Y = 140

function computeTier(
  id: string,
  byId: Record<string, KnowledgeNode>,
  memo: Record<string, number>,
  stack: Set<string>,
): number {
  if (memo[id] !== undefined) return memo[id]
  const n = byId[id]
  const prereqs = n?.concept?.prerequisites ?? []
  if (prereqs.length === 0) {
    memo[id] = 0
    return 0
  }
  if (stack.has(id)) {
    // cycle guard
    memo[id] = 0
    return 0
  }
  stack.add(id)
  let max = 0
  for (const p of prereqs) {
    if (byId[p]) max = Math.max(max, computeTier(p, byId, memo, stack) + 1)
  }
  stack.delete(id)
  memo[id] = max
  return max
}

export function layoutGalaxy(nodes: KnowledgeNode[]): Record<string, { x: number; y: number }> {
  const byId: Record<string, KnowledgeNode> = {}
  nodes.forEach((n) => (byId[n.id] = n))
  const memo: Record<string, number> = {}
  const tiers: Record<number, KnowledgeNode[]> = {}
  for (const n of nodes) {
    const t = computeTier(n.id, byId, memo, new Set())
    ;(tiers[t] ??= []).push(n)
  }
  const out: Record<string, { x: number; y: number }> = {}
  const tierKeys = Object.keys(tiers)
    .map(Number)
    .sort((a, b) => a - b)
  for (const t of tierKeys) {
    const row = tiers[t].slice().sort((a, b) => a.id.localeCompare(b.id))
    const totalW = (row.length - 1) * GAP_X
    const x0 = ORIGIN_X + (t % 2 === 0 ? 0 : GAP_X / 2) - totalW / 2 + 360
    row.forEach((n, i) => {
      out[n.id] = { x: x0 + i * GAP_X, y: ORIGIN_Y + t * GAP_Y }
    })
  }
  return out
}

/** Centre point of a node in world coordinates (used by edge/track overlays). */
export function nodeCenter(pos: { x: number; y: number }): { x: number; y: number } {
  return { x: pos.x + NODE_W / 2, y: pos.y + 54 }
}
