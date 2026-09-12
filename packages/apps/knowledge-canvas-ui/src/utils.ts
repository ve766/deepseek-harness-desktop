export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** Knowledge node footprint in world coordinates (must match .knode CSS width). */
export const NODE_W = 200
export const NODE_H = 108

export function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function uid(prefix: string): string {
  return prefix + '-' + Math.random().toString(36).slice(2, 9)
}

/** Pick a roughly empty spot near the centre of the current view for new nodes. */
export function freePosition(view: { x: number; y: number; z: number }): {
  x: number
  y: number
} {
  const cx = (window.innerWidth / 2 - 260 - view.x) / view.z
  const cy = (window.innerHeight / 2 - 200 - view.y) / view.z
  return { x: cx + (Math.random() - 0.5) * 160, y: cy + (Math.random() - 0.5) * 120 }
}
