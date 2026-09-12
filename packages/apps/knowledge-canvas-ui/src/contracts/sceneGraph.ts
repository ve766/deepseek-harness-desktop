// P2-2.1 contract — SceneGraph IR
//
// Part of the system ABI layer: type-level declarations only. No runtime imports,
// no values, no side effects, no implementation.
//
// The IR is deliberately technology-agnostic: it carries NO CSS, shader or DOM
// concepts. Renderers (SVG today, Canvas2D / WebGL particle galaxy / 3D city later)
// consume the same IR and are ADDED, never a rewrite of the business layer.
//
// Animation is expressed as INTENT, not implementation: SVG maps it to a CSS
// transition, WebGL maps it to a shader uniform. Semantics live here; the
// rendering strategy lives in the renderer.

import type { AgentId } from '../types'

export interface Vec2 {
  readonly x: number
  readonly y: number
}

export interface BBox {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export type SceneNodeState =
  | 'idle'
  | 'draft'
  | 'confirmed'
  | 'highlighted'
  | 'dimmed'
  | 'error'

export type SceneAnimationKind =
  | 'appear'
  | 'grow'
  | 'pulse'
  | 'move'
  | 'connect'
  | 'fade'

export type SceneEasing = 'linear' | 'easeOut' | 'spring'

/** Reference into the Morphicons symbol layer. Symbols are NOT renderers. */
export interface SymbolRef {
  readonly id: string
  readonly variant?: string
}

/** A design-token name, never a hard-coded colour value. */
export interface PaletteHint {
  readonly token: string
  readonly emphasis?: number
}

export interface VisualIntent {
  readonly state: SceneNodeState
  readonly emphasis?: number
  readonly symbol?: SymbolRef
  readonly palette?: PaletteHint
}

export interface AnimationIntent {
  readonly kind: SceneAnimationKind
  readonly durationMs: number
  readonly easing?: SceneEasing
  readonly staggerMs?: number
}

/**
 * Domain metadata. Renderers must not make rendering decisions from it.
 *
 * EXTENSION RULE (P2-3 ruling): no catch-all `extra` bag. When a real need
 * appears, add a NAMED field via contract review -- do not smuggle arbitrary
 * payloads through the IR, because that erases the type constraint this layer
 * exists to provide.
 */
export interface SceneNodeMetadata {
  readonly label?: string
  readonly kindLabel?: string
}

export interface SceneEdgeMetadata {
  readonly label?: string
}

export interface SceneMetadata {
  readonly mode?: 'space' | 'growth'
}

export interface SceneNode {
  readonly id: string
  readonly kind: string
  /** Produced by layoutGalaxy, which stays a pure function (boundary F9). */
  readonly position: Vec2
  readonly radius: number
  readonly metadata: SceneNodeMetadata
  readonly visual: VisualIntent
  readonly animation?: AnimationIntent
  readonly ownerAgent?: AgentId
}

export interface SceneEdge {
  readonly id: string
  readonly from: string
  readonly to: string
  readonly kind: string
  readonly weight?: number
  readonly metadata: SceneEdgeMetadata
  /** Explainability: why these two nodes are connected. */
  readonly reason?: string
  readonly visual: VisualIntent
  readonly animation?: AnimationIntent
}

export interface SceneGroup {
  readonly id: string
  readonly memberIds: readonly string[]
  readonly label?: string
  readonly kind?: string
}

export interface SceneOverlay {
  readonly kind: string
  readonly text?: string
  readonly targetNodeId?: string
}

export interface SceneGraph {
  readonly version: number
  readonly nodes: ReadonlyMap<string, SceneNode>
  readonly edges: ReadonlyMap<string, SceneEdge>
  readonly groups: readonly SceneGroup[]
  readonly overlay?: SceneOverlay
  readonly metadata: SceneMetadata
}

export type SceneOp =
  | { readonly op: 'upsert'; readonly nodes?: readonly SceneNode[]; readonly edges?: readonly SceneEdge[] }
  | { readonly op: 'remove'; readonly nodeIds?: readonly string[]; readonly edgeIds?: readonly string[] }
  | {
    readonly op: 'visual'
    readonly nodeIds?: readonly string[]
    readonly edgeIds?: readonly string[]
    readonly visual: Partial<VisualIntent>
  }
  | {
    readonly op: 'animate'
    readonly nodeIds?: readonly string[]
    readonly edgeIds?: readonly string[]
    readonly animation: AnimationIntent
  }

/** Lets a renderer repaint only what changed. Required for large graphs. */
export interface DirtyRegion {
  readonly bbox?: BBox
  readonly nodeIds?: readonly string[]
}

export interface ScenePatch {
  readonly ops: readonly SceneOp[]
  readonly dirty?: DirtyRegion
}
