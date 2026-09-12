/**
 * The `knowledge` app.view winner: a three-column Knowledge Center shell
 * (navigation rail + workspace + detail reader). The workspace renders the
 * Dashboard for the
 * built-in seat and otherwise dispatches to the matching `knowledge.workspace`
 * entry, so child surfaces (the import surface today) appear here purely by
 * registering — this shell carries no per-surface knowledge. The injected
 * knowledge face flows to every descendant through {@link KnowledgeContext};
 * no child reaches `ctx.remote`.
 * @module @deepseek-ai/dsh-client-ui-knowledge/client/KnowledgeRoot
 */

import { useState } from 'react'
import type { InjectFace, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: same SlotMap merge as the registration, so the composed props
// resolve `app.view` to the declared root list slot and expose the
// `knowledge.workspace` child render seat.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { KnowledgeContext } from './KnowledgeContext.ts'
import type { KnowledgeInjected } from './slots.ts'
import { Sidebar } from './components/Sidebar.tsx'
import { Dashboard } from './views/Dashboard.tsx'
import css from './KnowledgeRoot.module.css'

/** The built-in workspace seat: rendered directly, never through the slot. */
const DEFAULT_WORKSPACE = 'dashboard'

/** Full component props: the app.view runtime share (empty for a root list
 *  slot), the knowledge.workspace and knowledge.detail child-render seats,
 *  and the injected face. */
export type KnowledgeRootProps =
  & PropsRuntime<'app.view'>
  & PropsRenderSlots<'knowledge.workspace'>
  & PropsRenderSlots<'knowledge.detail'>
  & InjectFace<KnowledgeInjected>

/**
 * Render the Knowledge Center shell.
 * @param props - composed slot props (runtime share + child seat + injected face).
 * @returns the Knowledge Center shell.
 */
export function KnowledgeRoot(props: KnowledgeRootProps) {
  // Navigation state lives here, not in the rail: the workspace needs it to pick
  // which knowledge.workspace entry to render.
  const [active, setActive] = useState(DEFAULT_WORKSPACE)

  return (
    <KnowledgeContext.Provider value={props}>
      <div className={css.root}>
        <Sidebar active={active} onSelect={setActive} />
        <main className={css.workspace}>
          {active === DEFAULT_WORKSPACE
            ? <Dashboard />
            : props.renderSlot('knowledge.workspace', {}, {
                // Only the entry whose id matches the active row renders.
                only: active,
                // A row with no registered entry falls back to the Dashboard
                // rather than an empty column.
                fallback: <Dashboard />,
              })}
        </main>
        <aside className={css.detail}>
          {props.renderSlot('knowledge.detail', {}, { only: active, fallback: null })}
        </aside>
      </div>
    </KnowledgeContext.Provider>
  )
}
