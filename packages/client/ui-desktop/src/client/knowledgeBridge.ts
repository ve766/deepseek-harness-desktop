/**
 * P2/Commit7 — bridge wiring `ctx.remote.knowledge.import` into the Desktop.
 *
 * Same discipline as `sessionBridge`: the component layer never touches `ctx`
 * directly; the real verb is captured once at plugin registration and exposed
 * through a safe no-op-until-wired call. This keeps the bundle purity surface at
 * zero and the semantics explicit.
 *
 * v0.1 uses ONLY `import` (always-insert). No update / delete / search.
 *
 * @module @deepseek-ai/dsh-client-ui-desktop/client/knowledgeBridge
 */

import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { KnowledgeItem } from '@deepseek-ai/dsh-knowledge-storage'
import type { KnowledgeDraftView } from './workspaceKnowledge.ts'

/** The save verb: turns a derived draft into a persisted KnowledgeItem. */
type SaveKnowledgeFn = (draft: KnowledgeDraftView) => Promise<RemoteResult<KnowledgeItem>>

let impl: SaveKnowledgeFn | null = null

/** Wire the real `ctx.remote.knowledge.import` (called once at plugin registration). */
export function setSaveKnowledge(fn: SaveKnowledgeFn): void {
  impl = fn
}

/**
 * Persist a derived knowledge draft into the Personal Knowledge OS.
 * @returns the remote result, or a closed `ok:false` when unwired.
 */
export async function saveKnowledge(draft: KnowledgeDraftView): Promise<RemoteResult<KnowledgeItem>> {
  if (impl === null) {
    return { ok: false, error: { code: 'unwired', message: 'knowledge remote not wired', details: {} } }
  }
  return impl(draft)
}
