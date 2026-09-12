/**
 * App view switcher plugin, browser half: contributes one sidebar footer
 * action that reads the `app.view` slot registry live and renders a switch
 * button per registered view (plus the built-in chat row — the conversation
 * fallback that never registers). The plugin owns no state: the active view
 * lives in ui-layout's layout store behind ctx.layout, the view list is the
 * slot registry itself, and future modules surface here purely by
 * registering an `app.view` entry — no change to this package.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { ViewSwitcher, type ViewEntry } from './ViewSwitcher.tsx'
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: ui-layout merges 'app.view' into SlotMap (the registry keys the
// injected hook sources read); ui-sidebar merges 'sidebar.footer.action'.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import { en, NS, zh, type ViewKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** App view switcher copy. */
    'view': ViewKey
  }
}

export { CHAT_VIEW, ViewSwitcher } from './ViewSwitcher.tsx'
export type { ViewEntry, ViewSwitcherInjected, ViewSwitcherProps } from './ViewSwitcher.tsx'

/** Required services: the slot registry, the locale face, and ctx.layout. */
export const inject = ['slots', 'locale', 'layout']

/**
 * Build the `app.view` winners projection as a uSES-compatible source: the
 * snapshot is version-cached (stable identity between mutations, required by
 * getSnapshot's render-identity contract) and re-derived only when the
 * registry version moves.
 * @param ctx - client root context.
 * @returns the HostObservable handed to the component as `useViewEntries`.
 */
function viewEntriesSource(ctx: ClientContext): HostObservable<readonly ViewEntry[]> {
  let version = -1
  let snapshot: readonly ViewEntry[] = []
  return {
    getSnapshot: () => {
      const current = ctx.slots.getVersion('app.view')
      if (current !== version) {
        version = current
        // Winners per id cell, in ledger (display) sequence. entriesOfSlot
        // builds a fresh array per call, which is exactly why the version
        // cache exists — the projection must be referentially stable between
        // mutations for uSES to compare snapshots.
        snapshot = ctx.slots.entriesOfSlot('app.view').flatMap(entry =>
          entry.options.id === undefined ? [] : [{
            id: entry.options.id,
            label: entry.options.label,
            order: entry.options.order ?? 0,
          }])
      }
      return snapshot
    },
    subscribe: (fn: () => void) => ctx.slots.subscribe('app.view', fn),
  }
}

/**
 * Client plugin body: register the dictionaries, then contribute the footer
 * action once ui-sidebar's 'sidebar' entry declares the seat.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-app-views: dictionaries')
  ctx.slots.inject(
    'sidebar.footer.action',
    () => ctx.slots.register({
      name: 'sidebar.footer.action',
      id: 'view-switcher',
      locale: NS,
      // The business face closes over the plugin ctx: the hooks compartment
      // binds to the component's useView/useViewEntries selector hooks, and
      // setView delegates to the layout service — the component itself never
      // touches ctx, the store, or the registry.
      inject: () => ({
        hooks: {
          view: {
            getSnapshot: () => ctx.layout.getView(),
            subscribe: (fn: () => void) => ctx.on('layout/view-change', () => { fn() }),
          },
          viewEntries: viewEntriesSource(ctx),
        },
        setView: (view: string) => { ctx.layout.setView(view) },
      }),
    }, ViewSwitcher),
  )
}
