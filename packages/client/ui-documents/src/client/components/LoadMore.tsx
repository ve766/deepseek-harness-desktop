/**
 * "Load more" pager button, rendered with the platform `Button` primitive.
 * @module @deepseek-ai/dsh-client-ui-documents/client/components/LoadMore
 */

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './LoadMore.module.css'

/** Load more button props. */
export interface LoadMoreProps {
  /** Whether a fetch is in flight. */
  loading: boolean
  /** Request the next page. */
  onLoadMore: () => void
}

/**
 * Render the load-more button.
 * @param props - the loading flag and the click sink.
 * @returns the pager button.
 */
export function LoadMore({ loading, onLoadMore }: LoadMoreProps) {
  return (
    <div className={css.root}>
      <Button variant="outline" disabled={loading} onClick={onLoadMore}>
        {loading ? '加载中…' : '加载更多'}
      </Button>
    </div>
  )
}
