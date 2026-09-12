/**
 * The sidebar's app-view switcher: one footer action projecting the live
 * `app.view` slot registry into a row of buttons. The registry itself is the
 * single source of truth — a future module's view appears here the moment it
 * registers (no hardcoded view list, no change to this package), and the
 * switcher stays out of the footer entirely while only the chat fallback
 * exists. Clicking a row goes through ctx.layout.setView; the active-view
 * highlight follows the layout service's `layout/view-change` event, so this
 * component never touches the layout store directly.
 */
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime, SlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls ui-sidebar's SlotMap merge (the 'sidebar.footer.action'
// entry) into the program, so PropsRuntime<'sidebar.footer.action'> resolves.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { NS } from './locales.ts'
import css from './ViewSwitcher.module.css'

/**
 * The chat view id. THE one special case in this package: chat is the
 * conversation fallback the frame renders when no `app.view` entry matches,
 * so it never registers — the switcher contributes its row locally and every
 * other row comes from the registry.
 */
export const CHAT_VIEW = 'chat'

/** One `app.view` list entry projected for the switcher (id/label/order only). */
export interface ViewEntry {
  /** List-cell id — the value ctx.layout.setView switches on. */
  readonly id: string
  /** Registrant-declared display label (may be a locale-following thunk). */
  readonly label: SlotLabel | undefined
  /** Declared display order (ascending; the registry ledger arrives sorted). */
  readonly order: number
}

/**
 * Registrant-injected share (arrives via the register inject factory, closing
 * over the plugin ctx): the `hooks` compartment binds to `useView` /
 * `useViewEntries` selector hooks on the component props, and `setView`
 * delegates to ctx.layout.
 */
export interface ViewSwitcherInjected {
  hooks: {
    /** Active view id mirror (getSnapshot = ctx.layout.getView). */
    view: HostObservable<string>
    /** app.view winners projection, version-cached for stable snapshots. */
    viewEntries: HostObservable<readonly ViewEntry[]>
  }
  /** Switch the center column (ctx.layout.setView). */
  setView: (view: string) => void
}

/** Full component props: owner share + injected face + the locale `t` seat. */
export type ViewSwitcherProps =
  PropsRuntime<'sidebar.footer.action'>
  & InjectFace<ViewSwitcherInjected>
  & PropsLocale<typeof NS>

/**
 * Render the app-view switcher row.
 * @param props - composed slot props (runtime share + injected face + t seat).
 * @returns the switcher buttons, or null while only the chat fallback exists.
 */
export function ViewSwitcher({ wide, useView, useViewEntries, setView, t }: ViewSwitcherProps) {
  const view = useView(v => v)
  const entries = useViewEntries(all => all)

  // Nothing registered means nothing to switch between: chat alone needs no
  // entry (it is the always-present fallback), so the footer stays clean.
  if (entries.length === 0) return null

  // Registry sequence is the display sequence (the ledger keeps list entries
  // sorted by order). A 'chat' registration would duplicate the built-in row —
  // the frame's contract says chat never registers, so this is a defensive
  // skip, not a branch a well-formed composition can reach.
  const rows = [
    { id: CHAT_VIEW, label: t('chat.label') },
    ...entries.flatMap(entry => entry.id === CHAT_VIEW
      ? []
      : [{ id: entry.id, label: resolveSlotLabel(entry.label) ?? entry.id }]),
  ]

  return (
    <nav className={wide ? css.root : `${css.root} ${css.rail}`} aria-label={t('switcher.aria')}>
      {rows.map(row => (
        <button
          key={row.id}
          type="button"
          className={view === row.id ? `${css.item} ${css.itemActive}` : css.item}
          aria-current={view === row.id ? 'page' : undefined}
          title={row.label}
          onClick={() => { setView(row.id) }}
        >
          {row.label}
        </button>
      ))}
    </nav>
  )
}
