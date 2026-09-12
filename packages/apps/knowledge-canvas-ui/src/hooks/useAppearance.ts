import { useEffect, useState } from 'react'
import { store, useAppearance } from '../store/canvasStore'
import type { CanvasAppearance } from '../types'

const KEY = 'kcu-appearance'

function load(): CanvasAppearance | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as CanvasAppearance
  } catch {
    return null
  }
}

/** Read + persist canvas appearance. Stored only in localStorage — never uploaded. */
export function useAppearanceSettings(): {
  appearance: CanvasAppearance
  update: (patch: Partial<CanvasAppearance>) => void
  reset: () => void
} {
  const appearance = useAppearance()
  const [, force] = useState(0)

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    const saved = load()
    if (saved) store.setAppearance(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = (next: CanvasAppearance) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* ignore quota / private-mode errors */
    }
    force((n) => n + 1)
  }

  const update = (patch: Partial<CanvasAppearance>) => {
    const next = { ...store.getState().appearance, ...patch }
    store.setAppearance(next)
    persist(next)
  }
  const reset = () => {
    const def: CanvasAppearance = { backgroundType: 'default', blur: 0, overlayOpacity: 0.28, backgroundFit: 'fill' }
    store.setAppearance(def)
    persist(def)
  }
  return { appearance, update, reset }
}
