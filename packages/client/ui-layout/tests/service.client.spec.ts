/**
 * LayoutController behavior: the cross-plugin panel-action face. Geometry
 * lives in the entry store (layout-store.spec.ts) — here we assert the
 * delegation contract: attachPanels wiring, the action forwarding, the
 * unwired fail-loud, re-attach overwriting a stale action set, and the view
 * switch's store-forward/mirror/notification triple.
 */
import { describe, expect, it, vi } from 'vitest'
import { LayoutController } from '@deepseek-ai/dsh-client-ui-layout/src/client/service.ts'
import type { PanelActions } from '@deepseek-ai/dsh-client-ui-layout/src/client/service.ts'

function fakePanels(): PanelActions {
  return {
    setSidebar: vi.fn(),
    setDetails: vi.fn(),
    toggleSidebar: vi.fn(),
    setNarrow: vi.fn(),
    openDetails: vi.fn(),
    closeDetails: vi.fn(),
    setView: vi.fn(),
  }
}

describe('LayoutController', () => {
  it('forwards the three panel actions to the attached set', () => {
    const service = new LayoutController()
    const panels = fakePanels()
    service.attachPanels(panels)

    service.toggleSidebar()
    service.openDetails()
    service.closeDetails()

    expect(panels.toggleSidebar).toHaveBeenCalledTimes(1)
    expect(panels.openDetails).toHaveBeenCalledTimes(1)
    expect(panels.closeDetails).toHaveBeenCalledTimes(1)
    expect(panels.setSidebar).not.toHaveBeenCalled()
    expect(panels.setDetails).not.toHaveBeenCalled()
  })

  it('fails loud before the root entry wired its actions', () => {
    const service = new LayoutController()
    expect(() => { service.toggleSidebar() }).toThrow(/panel actions not wired/)
    expect(() => { service.openDetails() }).toThrow(/panel actions not wired/)
    expect(() => { service.closeDetails() }).toThrow(/panel actions not wired/)
    expect(() => { service.setView('knowledge') }).toThrow(/panel actions not wired/)
  })

  it('setView forwards to the store, mirrors the id, and notifies the listener', () => {
    const seen: string[] = []
    const service = new LayoutController(view => { seen.push(view) })
    const panels = fakePanels()
    service.attachPanels(panels)

    expect(service.getView()).toBe('chat')
    service.setView('knowledge')
    expect(panels.setView).toHaveBeenCalledWith('knowledge')
    expect(service.getView()).toBe('knowledge')
    expect(seen).toEqual(['knowledge'])

    // Same-id switch is a no-op: no store write, no notification.
    service.setView('knowledge')
    expect(panels.setView).toHaveBeenCalledTimes(1)
    expect(seen).toEqual(['knowledge'])
  })

  it('re-attach overwrites the stale action set (entry re-register)', () => {
    const service = new LayoutController()
    const stale = fakePanels()
    const fresh = fakePanels()
    service.attachPanels(stale)
    service.attachPanels(fresh)

    service.toggleSidebar()

    expect(stale.toggleSidebar).not.toHaveBeenCalled()
    expect(fresh.toggleSidebar).toHaveBeenCalledTimes(1)
  })

  it('re-attach resets the view mirror: a fresh entry means a fresh transient store (init chat)', () => {
    const service = new LayoutController()
    service.attachPanels(fakePanels())
    service.setView('knowledge')
    expect(service.getView()).toBe('knowledge')

    service.attachPanels(fakePanels())
    expect(service.getView()).toBe('chat')
  })
})
