/**
 * Module-level selection store shared between the workspace list and the detail
 * reader. The two entries are rendered by separate `renderSlot` calls in
 * KnowledgeRoot, so they live in two independent React subtrees that cannot
 * share React context across the slot boundary. A tiny external store bridges
 * them without a Cordis service or any cross-plugin channel (per the 6-B-3
 * design). The selected id persists for the package lifetime, so leaving and
 * returning to the `文档` row keeps the last-read document open (C3).
 * @module @deepseek-ai/dsh-client-ui-documents/client/selectionStore
 */

import { useSyncExternalStore } from 'react'

/** Currently selected knowledge item id, or null when nothing is open. */
let selectedId: string | null = null

/** Subscribers notified whenever {@link selectedId} changes. */
const listeners = new Set<() => void>()

/** Read the current selection without subscribing. */
export function getSelectedId(): string | null {
  return selectedId
}

/**
 * Replace the current selection and notify subscribers.
 * @param id - the newly selected item id, or null to clear.
 */
export function setSelectedId(id: string | null): void {
  if (selectedId === id) return
  selectedId = id
  for (const listener of listeners) listener()
}

/**
 * Subscribe to selection changes.
 * @param cb - invoked after every change.
 * @returns a disposer removing the subscription.
 */
export function subscribeSelection(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

/**
 * React binding for the selection store.
 * @returns the current selected id.
 */
export function useSelectedId(): string | null {
  return useSyncExternalStore(subscribeSelection, getSelectedId)
}
