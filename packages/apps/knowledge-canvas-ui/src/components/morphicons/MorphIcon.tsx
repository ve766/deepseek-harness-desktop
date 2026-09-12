import { useEffect, useId, useRef, useState } from 'react'
import { useT } from '../../i18n'
import { MORPH_SHAPES, renderMark, renderRing, type MorphState } from './geometry'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'
import './morphicons.css'

const FALLBACK_DUR = 520

/** Mirrors --dur-morph so JS interpolation and CSS transitions stay in lockstep. */
function readMorphDuration(): number {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return FALLBACK_DUR
  }
  const raw = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue('--dur-morph')
    .trim()
  const n = parseFloat(raw)
  if (!Number.isFinite(n)) return FALLBACK_DUR
  return raw.endsWith('ms') ? n : n * 1000
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Lerps a coordinate array towards `target`.
 *
 * `target` must be referentially stable (it is — shapes are module constants),
 * otherwise this would restart on every render.
 */
function useMorphedPoints(target: number[], animate: boolean): number[] {
  const [pts, setPts] = useState<number[]>(target)
  const current = useRef<number[]>(target)

  useEffect(() => {
    if (!animate || current.current.length !== target.length) {
      current.current = target
      setPts(target)
      return
    }
    const from = current.current
    const duration = readMorphDuration()
    const start = performance.now()
    let raf = 0

    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const e = easeOutCubic(p)
      const next = target.map((v, i) => from[i] + (v - from[i]) * e)
      current.current = next
      setPts(next)
      if (p < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, animate])

  return pts
}

export interface MorphIconProps {
  state?: MorphState
  /** Rendered px. Design scale: 16 / 20 / 28 / 44. */
  size?: number
  className?: string
  /** Overrides the localised default aria-label. */
  label?: string
}

/**
 * The base morphicon: one glyph whose shape continuously morphs between states.
 * Three layers (ring + two marks) always exist and always interpolate — the icon
 * is never unmounted or swapped.
 *
 * Colour is a per-state two-stop gradient (`--morph-c1` → `--morph-c2`). The two
 * stops are registered with `@property` so they cross-fade smoothly when the state
 * changes — this is the "状态间平滑过渡" requirement. The gradient is the status
 * layer's identity and is scoped to Morphicons only.
 */
export function MorphIcon({ state = 'idle', size = 20, className, label }: MorphIconProps) {
  const { t } = useT()
  const reduced = usePrefersReducedMotion()
  // `useId` returns ":r1:"-style strings; strip the colons for a valid id.
  const rawId = useId()
  const gid = 'mg' + rawId.replace(/[^a-zA-Z0-9]/g, '')

  const shape = MORPH_SHAPES[state] ?? MORPH_SHAPES.idle
  const ring = useMorphedPoints(shape.ring, !reduced)
  const markA = useMorphedPoints(shape.markA, !reduced)
  const markB = useMorphedPoints(shape.markB, !reduced)

  return (
    <svg
      className={className ? `morph ${className}` : 'morph'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      data-state={state}
      data-spin={shape.spin}
      data-reduced={reduced ? 'true' : 'false'}
      role="img"
      aria-label={label ?? t('morph.state.' + state)}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--morph-c1)' }} />
          <stop offset="1" style={{ stopColor: 'var(--morph-c2)' }} />
        </linearGradient>
      </defs>
      <path
        className="morph__ring"
        d={renderRing(ring)}
        stroke={`url(#${gid})`}
        strokeDasharray={shape.ringDash}
      />
      <path
        className="morph__mark morph__mark--a"
        d={renderMark(markA)}
        stroke={`url(#${gid})`}
        strokeWidth={shape.markAWidth}
        opacity={shape.markAOpacity}
      />
      <path
        className="morph__mark morph__mark--b"
        d={renderMark(markB)}
        stroke={`url(#${gid})`}
        strokeWidth={shape.markBWidth}
        opacity={shape.markBOpacity}
      />
    </svg>
  )
}
