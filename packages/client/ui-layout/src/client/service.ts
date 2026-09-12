/**
 * LayoutController: the cross-plugin panel-action face behind ctx.layout.
 * Panel geometry itself lives in the root entry's layout store (stores.ts);
 * the current-session selection lives with the runtime sessions service, and
 * the per-session active view dissolved into ui-conversation's session store
 * (its only consumer). What remains here is the contract other plugins'
 * apply worlds reach for panel transitions (sidebar toggle from ui-sidebar,
 * details open/close from ui-conversation) — writes stay inside the store's
 * declared action set, delivered as the registration's bound actions.
 */
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { createLayoutStore } from './stores.ts'

/** The layout store's bound action set (framework-baked, draft params peeled). */
export type PanelActions = BoundActions<ReturnType<typeof createLayoutStore>>

/**
 * The outward layout face (`ctx.layout`): the panel transitions other
 * plugins may trigger — and exactly what a test fake must supply. The
 * attachPanels wiring hook stays on the concrete class (root-entry assembly
 * only).
 */
export interface ILayout {
  /** Toggle the sidebar panel (closed ⟷ contract default width). */
  toggleSidebar(): void
  /** Open the details panel (no-op when already open). */
  openDetails(): void
  /** Close the details panel. */
  closeDetails(): void
  /**
   * Switch the center column to the 'app.view' entry with this id. Open
   * registry: any string; an id no entry matches (including 'chat') renders
   * the conversation fallback, so unknown ids degrade to chat, never a blank.
   */
  setView(view: string): void
  /** The current active view id ('chat' until something switches it). */
  getView(): string
}

/** Cross-plugin panel-action face (ctx.layout). */
export class LayoutController implements ILayout {
  #panels: PanelActions | undefined
  #view: string = 'chat'
  #notifyViewChange: ((view: string) => void) | undefined

  /**
   * @param notifyViewChange - optional listener invoked after a successful
   * setView (the plugin body wires it to the `layout/view-change` event so
   * sidebar occupants can highlight without reaching into the store).
   */
  constructor(notifyViewChange?: (view: string) => void) {
    this.#notifyViewChange = notifyViewChange
  }

  /**
   * Adopt the root entry's bound store actions. Called from the root
   * registration's inject hook (a sanctioned assembly side effect), so the
   * face is live from the entry's first render; on entry re-register the
   * fresh actions overwrite the stale set. A fresh entry also means a fresh
   * store instance — the view is transient (init 'chat'), so the mirror
   * resets with it rather than stranding a stale id in the service face.
   * @param actions - bound actions of the entry's layout store instance.
   */
  attachPanels(actions: PanelActions): void {
    this.#panels = actions
    this.#view = 'chat'
  }

  /** Toggle the sidebar panel (closed ⟷ contract default width). */
  toggleSidebar(): void {
    this.#require().toggleSidebar()
  }

  /** Open the details panel (no-op when already open). */
  openDetails(): void {
    this.#require().openDetails()
  }

  /** Close the details panel. */
  closeDetails(): void {
    this.#require().closeDetails()
  }

  /** Switch the center column's active view (see ILayout.setView). */
  setView(view: string): void {
    if (view === this.#view) return
    this.#require().setView(view)
    this.#view = view
    this.#notifyViewChange?.(view)
  }

  /** The current active view id. */
  getView(): string {
    return this.#view
  }

  #require(): PanelActions {
    // Callers are UI gestures, which cannot fire before the root entry
    // rendered (the inject hook runs in its first render) — reaching this
    // unwired is a boot-order bug, not a race to tolerate.
    if (this.#panels === undefined) throw new Error('layout: panel actions not wired (root entry not mounted)')
    return this.#panels
  }
}
