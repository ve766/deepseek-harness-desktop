/**
 * Query entry for the search workspace. Apple-inspired: a single, calm search
 * field with a capsule submit — closer to Spotlight than a CMS filter bar. No
 * dense toolbar, no secondary controls crowding the row.
 * @module @deepseek-ai/dsh-client-ui-search/client/components/SearchBar
 */

import { useState } from 'react'
import { Input, Button } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './SearchBar.module.css'

/** Search bar props. */
export interface SearchBarProps {
  /** Current query text. */
  value: string
  /** Debounced/committed query sink. */
  onSubmit: (text: string) => void
}

/**
 * Render the search entry field.
 * @param props - the query value and its commit sink.
 * @returns the search bar.
 */
export function SearchBar({ value, onSubmit }: SearchBarProps) {
  const [draft, setDraft] = useState(value)

  return (
    <div className={css.root}>
      <Input
        className={css.field}
        value={draft}
        placeholder="搜索你的知识库…"
        onChange={(e) => setDraft((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(draft.trim())
        }}
      />
      <Button
        variant="primary"
        className={css.submit}
        onClick={() => onSubmit(draft.trim())}
      >
        检索
      </Button>
    </div>
  )
}
