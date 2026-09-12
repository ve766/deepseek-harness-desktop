// Stage 11 (D1-A / D4): read-only related-knowledge suggestions.
//
// Given a seed node id (one of the employee's owned contributions), surfaces the
// top related nodes from the shared universe via `useEmployeeKnowledgeSuggestions`.
// PURELY READ-ONLY: no write-back, no recommendation Runtime, no Agent behavior
// (D4). Rendered only when a seed exists (the employee has at least one owned
// node) — otherwise returns null.

import type { AgentId } from '../types'
import { useT, resolveLoc } from '../i18n'
import { useEmployeeKnowledgeSuggestions } from './useEmployeeKnowledgeSuggestions'

export function EmployeeKnowledgeSuggestions({
  agentId,
  seedNodeId,
}: {
  agentId: AgentId
  seedNodeId: string | null
}) {
  const { t, lang } = useT()
  const { suggestions, loading, error } = useEmployeeKnowledgeSuggestions(agentId, seedNodeId)

  if (!seedNodeId) return null

  return (
    <div className="employee-knowledge-suggestions" data-knowledge-suggestions>
      <h3 className="employee-knowledge-suggestions__title">{t('knowledge.suggest.title')}</h3>
      <p className="employee-knowledge-suggestions__hint">{t('knowledge.suggest.hint')}</p>
      {loading && (
        <div className="employee-knowledge-suggestions__loading">{t('knowledge.suggest.loading')}</div>
      )}
      {!loading && suggestions.length === 0 && (
        <div className="employee-knowledge-suggestions__empty">{t('knowledge.suggest.empty')}</div>
      )}
      {!loading && suggestions.length > 0 && (
        <ul className="employee-knowledge-suggestions__list">
          {suggestions.map(s => (
            <li
              className="employee-knowledge-suggestions__item"
              key={s.node.id}
              data-suggest-node={s.node.id}
            >
              <span className="employee-knowledge-suggestions__node-title">
                {resolveLoc(s.node.title, s.node.titleLoc, lang)}
              </span>
              <span className="employee-knowledge-suggestions__reason">
                {t('knowledge.suggest.reason', { reason: s.reason })}
              </span>
              <span className="employee-knowledge-suggestions__score">
                {t('knowledge.suggest.score', { score: Math.round(s.score * 100) / 100 })}
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <div className="employee-knowledge-suggestions__empty">{error}</div>}
    </div>
  )
}
