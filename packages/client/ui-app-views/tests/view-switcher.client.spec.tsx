// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import {
  CHAT_VIEW,
  ViewSwitcher,
  type ViewEntry,
  type ViewSwitcherProps,
} from '../src/client/ViewSwitcher.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const t: ViewSwitcherProps['t'] = makeTranslate(zh)

/** Registry-sequence entry with an optional declared label. */
function entry(id: string, label?: ViewEntry['label']): ViewEntry {
  return { id, label, order: 0 }
}

/** Fake injected face over plain values: hooks read straight from closure state. */
function props(view: string, entries: readonly ViewEntry[], setView = vi.fn()): ViewSwitcherProps {
  return {
    wide: true,
    useView: (sel: (v: string) => unknown) => sel(view),
    useViewEntries: (sel: (v: readonly ViewEntry[]) => unknown) => sel(entries),
    setView,
    t,
  } as unknown as ViewSwitcherProps
}

describe('ViewSwitcher visibility', () => {
  it('renders nothing while only the chat fallback exists', () => {
    const { container } = render(<ViewSwitcher {...props(CHAT_VIEW, [])} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('ViewSwitcher rows', () => {
  it('renders the built-in chat row plus one row per registered view, in registry sequence', () => {
    render(<ViewSwitcher {...props(CHAT_VIEW, [
      entry('knowledge', '知识中心'),
      entry('import', '导入'),
    ])} />)
    const labels = screen.getByRole('navigation', { name: zh['switcher.aria'] })
      .querySelectorAll('button')
    expect([...labels].map(node => node.textContent)).toEqual(['对话', '知识中心', '导入'])
  })

  it('falls back to the entry id when the registrant declared no label', () => {
    render(<ViewSwitcher {...props(CHAT_VIEW, [entry('dashboard')])} />)
    expect(screen.getByRole('button', { name: 'dashboard' })).toBeDefined()
  })

  it('skips a registered entry whose id collides with the built-in chat row', () => {
    render(<ViewSwitcher {...props(CHAT_VIEW, [entry('knowledge', '知识中心'), entry(CHAT_VIEW, '假对话')])} />)
    const buttons = screen.getByRole('navigation').querySelectorAll('button')
    expect([...buttons].map(node => node.textContent)).toEqual(['对话', '知识中心'])
  })

  it('resolves thunk labels at render time so they follow the active locale', () => {
    render(<ViewSwitcher {...props(CHAT_VIEW, [entry('knowledge', () => '知识中心')])} />)
    expect(screen.getByRole('button', { name: '知识中心' })).toBeDefined()
  })
})

describe('ViewSwitcher selection', () => {
  it('marks the active view row with aria-current and leaves the others unmarked', () => {
    const { rerender } = render(<ViewSwitcher {...props(CHAT_VIEW, [entry('knowledge', '知识中心')])} />)
    expect(screen.getByRole('button', { name: '对话' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: '知识中心' }).getAttribute('aria-current')).toBeNull()

    rerender(<ViewSwitcher {...props('knowledge', [entry('knowledge', '知识中心')])} />)
    expect(screen.getByRole('button', { name: '对话' }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('button', { name: '知识中心' }).getAttribute('aria-current')).toBe('page')
  })

  it('clicking a row switches through setView with that row id', () => {
    const setView = vi.fn()
    render(<ViewSwitcher {...props(CHAT_VIEW, [entry('knowledge', '知识中心')], setView)} />)
    fireEvent.click(screen.getByRole('button', { name: '知识中心' }))
    expect(setView).toHaveBeenCalledWith('knowledge')
  })

  it('clicking the chat row switches back to the fallback id', () => {
    const setView = vi.fn()
    render(<ViewSwitcher {...props('knowledge', [entry('knowledge', '知识中心')], setView)} />)
    fireEvent.click(screen.getByRole('button', { name: '对话' }))
    expect(setView).toHaveBeenCalledWith(CHAT_VIEW)
  })
})
