/**
 * Package-local selection store. Lives inside ui-explore (not ui-primitives)
 * because the workspace and detail entries of this package share it directly —
 * no cross-plugin sharing is required, so no extraction to a shared package is
 * needed (per the Phase 6-B-4 shared-components decision).
 * @module @deepseek-ai/dsh-client-ui-explore/client/selectionStore
 */

import { useSyncExternalStore } from 'react'

let selectedId: string | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

/** Set the currently selected item id (null clears the selection). */
export function setSelectedId(id: string | null): void {
  if (selectedId === id) return
  selectedId = id
  emit()
}

/** Subscribe to the selected id from the explore surface. */
export function useSelectedId(): string | null {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback)
      return () => { listeners.delete(callback) }
    },
    () => selectedId,
  )
}
