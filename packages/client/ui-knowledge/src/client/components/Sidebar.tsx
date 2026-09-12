/**
 * Knowledge navigation rail. The active row is owned by KnowledgeRoot and
 * passed in, because the workspace reads the same value to pick which
 * `knowledge.workspace` entry to render. Rows stay declared-but-disabled so the
 * navigation surface remains stable when later phases fill them in.
 * @module @deepseek-ai/dsh-client-ui-knowledge/client/components/Sidebar
 */

import css from './Sidebar.module.css'

interface NavItem {
  readonly id: string
  readonly label: string
  readonly enabled: boolean
}

/** Navigation rows; `dashboard` is built-in, `import` is contributed by ui-import. */
const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', label: '概览', enabled: true },
  { id: 'import', label: '导入', enabled: true },
  { id: 'documents', label:  '文档', enabled: true },
  { id: 'explore', label: '探索', enabled: true },
  { id: 'search', label: '检索', enabled: true },
  { id: 'assistant', label: '助手', enabled: false },
  { id: 'graph', label: '图谱', enabled: false },
  { id: 'settings', label: '设置', enabled: false },
]

export interface SidebarProps {
  /** Id of the currently selected row. */
  active: string
  /** Select a different row. */
  onSelect(id: string): void
}

/**
 * Render the Knowledge navigation rail.
 * @param props - the controlled active row and its change sink.
 * @returns the sidebar rail.
 */
export function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <aside className={css.root}>
      <div className={css.brand}>Knowledge</div>
      <nav className={css.nav}>
        {NAV_ITEMS.map(item => {
          const isActive = active === item.id
          const className = isActive ? `${css.item} ${css.itemActive}` : css.item
          return (
            <button
              key={item.id}
              type="button"
              className={className}
              disabled={!item.enabled}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => { if (item.enabled) onSelect(item.id) }}
            >
              <span className={css.itemLabel}>{item.label}</span>
              {!item.enabled && <span className={css.itemBadge}>soon</span>}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
