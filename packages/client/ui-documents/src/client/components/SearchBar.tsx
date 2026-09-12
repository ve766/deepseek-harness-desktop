/**
 * Search box for the documents workspace. Thin wrapper over the platform
 * `Input` primitive; the controlled value is owned by the workspace view.
 * @module @deepseek-ai/dsh-client-ui-documents/client/components/SearchBar
 */

import { Input } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './SearchBar.module.css'

/** Search box props. */
export interface SearchBarProps {
  /** Current query text. */
  value: string
  /** Called with the next text on every keystroke. */
  onChange: (value: string) => void
}

/**
 * Render the documents search box.
 * @param props - the controlled value and its change sink.
 * @returns the search box.
 */
export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className={css.root}>
      <Input
        className={css.input}
        placeholder="搜索文档标题、正文或标签…"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}
