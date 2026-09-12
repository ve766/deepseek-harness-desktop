/**
 * Morphicon geometry — zero-dependency path math for true shape morphing.
 *
 * Every state is described by the SAME number of coordinates, so a morph is a
 * plain element-wise lerp. No icon swapping, no external library, no SMIL.
 *
 *   ring  : closed circle, 4 cubic segments  -> 2 + 4 * 6 = 26 numbers
 *   mark  : open stroke,   2 cubic segments  -> 2 + 2 * 6 = 14 numbers
 *
 * Because the command structure is identical across states we never have to
 * guess how to interpolate — we just lerp the numbers and re-render `d`.
 */

export type MorphState =
  | 'idle'
  | 'thinking'
  | 'searching'
  | 'learning'
  | 'completed'
  | 'warning'
  | 'error'

/** Spin direction of the ring for a given state. */
export type MorphSpin = 'none' | 'cw' | 'ccw'

const KAPPA = 0.5522847498
const CX = 12
const CY = 12
const R = 8
const CIRC = 2 * Math.PI * R // ≈ 50.27

/** Circle as 4 cubic segments starting at 12 o'clock, drawn clockwise. */
export function circlePath(r: number): number[] {
  const k = KAPPA * r
  return [
    CX, CY - r,
    CX + k, CY - r, CX + r, CY - k, CX + r, CY,
    CX + r, CY + k, CX + k, CY + r, CX, CY + r,
    CX - k, CY + r, CX - r, CY + k, CX - r, CY,
    CX - r, CY - k, CX - k, CY - r, CX, CY - r,
  ]
}

export function renderRing(p: number[]): string {
  return (
    `M${p[0]} ${p[1]}` +
    ` C${p[2]} ${p[3]} ${p[4]} ${p[5]} ${p[6]} ${p[7]}` +
    ` C${p[8]} ${p[9]} ${p[10]} ${p[11]} ${p[12]} ${p[13]}` +
    ` C${p[14]} ${p[15]} ${p[16]} ${p[17]} ${p[18]} ${p[19]}` +
    ` C${p[20]} ${p[21]} ${p[22]} ${p[23]} ${p[24]} ${p[25]} Z`
  )
}

export function renderMark(p: number[]): string {
  return (
    `M${p[0]} ${p[1]}` +
    ` C${p[2]} ${p[3]} ${p[4]} ${p[5]} ${p[6]} ${p[7]}` +
    ` C${p[8]} ${p[9]} ${p[10]} ${p[11]} ${p[12]} ${p[13]}`
  )
}

/** A cubic segment that renders as a straight line (control points at 1/3, 2/3). */
function seg(x0: number, y0: number, x1: number, y1: number): number[] {
  const dx = (x1 - x0) / 3
  const dy = (y1 - y0) / 3
  return [x0 + dx, y0 + dy, x0 + 2 * dx, y0 + 2 * dy, x1, y1]
}

/** Zero-length segment. With `stroke-linecap: round` this paints a dot. */
function dotAt(x: number, y: number): number[] {
  return [x, y, x, y, x, y]
}

function mark(x0: number, y0: number, s1: number[], s2: number[]): number[] {
  return [x0, y0, ...s1, ...s2]
}

/** An invisible mark parked at the centre — keeps array length stable. */
function hidden(): number[] {
  return mark(CX, CY, dotAt(CX, CY), dotAt(CX, CY))
}

// Ring dash patterns. All are 2-value so CSS can interpolate between them.
const SOLID = '60 0' // dash longer than the circumference -> unbroken ring
const ARC_75 = '38 14'
const ARC_45 = '22 28'
const DASHED = '4 6'
const GAP_TOP = '42 8.3'

export interface MorphShape {
  ring: number[]
  ringDash: string
  markA: number[]
  markB: number[]
  markAWidth: number
  markBWidth: number
  markAOpacity: number
  markBOpacity: number
  spin: MorphSpin
}

export const MORPH_SHAPES: Record<MorphState, MorphShape> = {
  // Small resting ring, nothing else — breathes.
  idle: {
    ring: circlePath(3.4),
    ringDash: SOLID,
    markA: hidden(),
    markB: hidden(),
    markAWidth: 2,
    markBWidth: 2,
    markAOpacity: 0,
    markBOpacity: 0,
    spin: 'none',
  },
  // Long open arc, rotating — reasoning.
  thinking: {
    ring: circlePath(R),
    ringDash: ARC_75,
    markA: hidden(),
    markB: hidden(),
    markAWidth: 2,
    markBWidth: 2,
    markAOpacity: 0,
    markBOpacity: 0,
    spin: 'cw',
  },
  // Short sweeping arc + centre dot — a scan in progress.
  searching: {
    ring: circlePath(R),
    ringDash: ARC_45,
    markA: mark(CX, CY, dotAt(CX, CY), dotAt(CX, CY)),
    markB: hidden(),
    markAWidth: 3.4,
    markBWidth: 2,
    markAOpacity: 1,
    markBOpacity: 0,
    spin: 'cw',
  },
  // Ring broken into particles, rotating inward, + rising chevron — absorbing.
  learning: {
    ring: circlePath(R),
    ringDash: DASHED,
    markA: mark(9, 13, seg(9, 13, 12, 10), seg(12, 10, 15, 13)),
    markB: hidden(),
    markAWidth: 2,
    markBWidth: 2,
    markAOpacity: 1,
    markBOpacity: 0,
    spin: 'ccw',
  },
  // Closed ring + check.
  completed: {
    ring: circlePath(R),
    ringDash: SOLID,
    markA: mark(8.5, 12.3, seg(8.5, 12.3, 11, 14.8), seg(11, 14.8, 15.5, 9.6)),
    markB: hidden(),
    markAWidth: 2.2,
    markBWidth: 2,
    markAOpacity: 1,
    markBOpacity: 0,
    spin: 'none',
  },
  // Ring with a gap + exclamation (bar and dot).
  warning: {
    ring: circlePath(R),
    ringDash: GAP_TOP,
    markA: mark(12, 7.8, seg(12, 7.8, 12, 13.2), dotAt(12, 13.2)),
    markB: mark(12, 15.8, dotAt(12, 15.8), dotAt(12, 15.8)),
    markAWidth: 2.2,
    markBWidth: 3.4,
    markAOpacity: 1,
    markBOpacity: 1,
    spin: 'none',
  },
  // Closed ring + cross.
  error: {
    ring: circlePath(R),
    ringDash: SOLID,
    markA: mark(9.2, 9.2, seg(9.2, 9.2, 14.8, 14.8), dotAt(14.8, 14.8)),
    markB: mark(14.8, 9.2, seg(14.8, 9.2, 9.2, 14.8), dotAt(9.2, 14.8)),
    markAWidth: 2.2,
    markBWidth: 2.2,
    markAOpacity: 1,
    markBOpacity: 1,
    spin: 'none',
  },
}

export const MORPH_STATES: MorphState[] = [
  'idle',
  'thinking',
  'searching',
  'learning',
  'completed',
  'warning',
  'error',
]

/** States that settle on their own: they hold, then fall back to `idle`. */
const TERMINAL: MorphState[] = ['completed', 'warning', 'error']

export function isTerminal(s: MorphState): boolean {
  return TERMINAL.indexOf(s) !== -1
}

/** Circumference of the full-size ring — exposed for dashed-pattern maths. */
export const RING_CIRCUMFERENCE = CIRC
