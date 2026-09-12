/**
 * WorkspaceTimeline — the Execution Timeline surface of the Employee Workspace
 * (P2/Commit4).
 *
 * Renders a turn-grouped, Xcode-Build-Timeline style projection of what the
 * employee actually did. It is intentionally narrower than a transcript: no
 * message bodies, no user turns, no compaction markers.
 *
 * Two platform rules are honoured here:
 *   - In-flight rows get a start marker, never a fabricated width (ui-trajectory
 *     "In-flight Time stays blank").
 *   - History that is not loaded is announced neutrally (`hasEarlier`) and never
 *     rendered as invented spans.
 * @module @deepseek-ai/dsh-client-ui-desktop/client/components/WorkspaceTimeline
 */

import { useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ExecutionTimelineView, TimelineEntry } from '../workspaceTimeline.ts'
import css from './WorkspaceTimeline.module.css'

/** Rows kept visible before the rest fold away. */
const DEFAULT_VISIBLE = 6

export interface WorkspaceTimelineProps {
  /** Derived projection (see `deriveExecutionTimeline`). */
  timeline: ExecutionTimelineView
  /** Rows visible before folding; defaults to 6. */
  defaultVisible?: number | undefined
}

/**
 * Format one millisecond span for compact display.
 * @param ms - duration in milliseconds.
 * @returns a short human duration.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * Render the execution timeline for one employee session.
 * @param props.timeline - derived projection.
 * @param props.defaultVisible - visible row budget before folding.
 * @returns the timeline section, or null when there is nothing to show.
 */
export function WorkspaceTimeline({
  timeline,
  defaultVisible = DEFAULT_VISIBLE,
}: WorkspaceTimelineProps) {
  const [expanded, setExpanded] = useState(false)

  if (timeline.totalCount === 0) return null

  const domain = timeline.domain
  const span = domain === null ? 0 : domain.end - domain.start
  const safeSpan = span > 0 ? span : 1

  // Fold from the front: the most recent rows stay visible, older ones hide.
  const allKeys = timeline.turns.flatMap((group) => group.entries.map((entry) => entry.key))
  const totalHidden = Math.max(0, allKeys.length - defaultVisible)
  const visibleKeys = new Set(
    expanded || totalHidden === 0 ? allKeys : allKeys.slice(allKeys.length - defaultVisible),
  )

  const renderRow = (entry: TimelineEntry) => {
    const start = entry.start
    const positioned = start !== null && domain !== null
    const offset = positioned ? ((start - domain.start) / safeSpan) * 100 : 0
    const width =
      positioned && entry.duration !== null && entry.duration > 0
        ? (entry.duration / safeSpan) * 100
        : 0
    const durationText =
      entry.duration !== null
        ? formatDuration(entry.duration)
        : entry.status === 'running'
          ? '进行中'
          : '—'

    return (
      <div key={entry.key} className={css.row} data-status={entry.status} data-kind={entry.kind}>
        <span className={css.label} title={entry.label}>{entry.label}</span>
        <span className={css.track}>
          {positioned && (width > 0
            ? (
              <span
                className={css.bar}
                style={{ left: `${offset}%`, width: `${width}%` }}
              />
            )
            : <span className={css.marker} style={{ left: `${offset}%` }} />)}
        </span>
        <span className={css.duration}>{durationText}</span>
      </div>
    )
  }

  return (
    <section className={css.root}>
      <div className={css.head}>
        <span className={css.title}>执行时间线</span>
        <span className={css.count}>{timeline.totalCount} 步</span>
      </div>

      {timeline.hasEarlier && (
        <div className={css.earlier}>更早的记录尚未加载</div>
      )}

      {timeline.turns.map((group) => {
        const entries = group.entries.filter((entry) => visibleKeys.has(entry.key))
        if (entries.length === 0) return null
        return (
          <div key={group.turn} className={css.turn}>
            <div className={css.turnHead}>
              <span className={css.turnLabel}>Turn {group.turn}</span>
              {group.duration !== null && (
                <span className={css.turnDuration}>{formatDuration(group.duration)}</span>
              )}
            </div>
            {entries.map(renderRow)}
          </div>
        )
      })}

      {totalHidden > 0 && (
        <Button
          className={css.more}
          size="sm"
          variant="ghost"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '收起' : `显示更早的 ${totalHidden} 步`}
        </Button>
      )}
    </section>
  )
}
