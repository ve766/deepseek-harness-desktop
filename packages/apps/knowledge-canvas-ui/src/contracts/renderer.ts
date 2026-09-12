// P2-2.1 contract — Renderer interface
//
// Part of the system ABI layer: type-level declarations only. No runtime imports,
// no values, no side effects, no implementation.
//
// Hard rules carried by this interface:
//   R-4  a Renderer consumes ScenePatch only; it must NOT read store / backend / bus
//   R-4b a Renderer must NOT decide semantics (the IR does)
//   R-4c capability probing fails silently and falls back
//   R-4d new engines are ADDED (SVG today, Canvas2D / WebGL / WebGPU later)
//        -- never by rewriting the business layer

import type { ScenePatch } from './sceneGraph'

export type RenderCapability = 'svg' | 'canvas2d' | 'webgl2' | 'webgpu'

export interface Viewport {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

/** Abstracts the concrete output target (DOM node, canvas, WebGL/WebGPU context). */
export interface RenderSurface {
  readonly kind: RenderCapability
  readonly target: unknown
}

export interface Renderer {
  readonly id: string
  readonly capability: RenderCapability
  mount(surface: RenderSurface): void
  unmount(): void
  /** Incremental only. Rebuilding the whole scene per frame is forbidden. */
  apply(patch: ScenePatch): void
  setViewport(viewport: Viewport): void
  hitTest(point: { readonly x: number; readonly y: number }): string | null
  /** Must release GPU resources. */
  dispose(): void
}

export interface RendererProbe {
  detect(): readonly RenderCapability[]
  /** Fallback chain: webgpu -> webgl2 -> canvas2d -> svg. */
  select(preferred?: RenderCapability): Renderer
}
