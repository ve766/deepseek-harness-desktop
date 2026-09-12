// Stage 10 (D2): read-only Knowledge section for the Employee Detail drill-down.
//
// Shows ONLY (per D2):
//   - owned contributions  → listOwned() projection (title + source + contributor)
//   - related count        → total nodes in the shared universe (read breadth)
//   - source / provenance  → node.source + ownerAgent contributor chip
//
// Explicitly does NOT show (per D2 red lines):
//   - agent private knowledge space (there is none; universe is shared)
//   - Memory (Memory stays user-level; never rendered here)
//   - Capability data (capabilities are rendered in a separate, decoupled panel)
//
// Data chain: useEmployeeKnowledgeAccess (→ EmployeeKnowledgeAccess → Universe).

import type { AgentId, SourceRef } from '../types'
import { useT, resolveLoc } from '../i18n'
import { useEmployeeKnowledgeAccess } from './useEmployeeKnowledgeAccess'
import { EmployeeKnowledgeContribute } from './EmployeeKnowledgeContribute'
import { EmployeeKnowledgeSuggestions } from './EmployeeKnowledgeSuggestions'
import { AGENT_MAP } from '../domain/agents'
import { AgentAvatar } from './AgentAvatar'

const SOURCE_ICON: Record<SourceRef['type'], string> = {
  pdf: '📄',
  url: '🔗',
  video: '🎬',
  github: '🐙',
  chat: '💬',
}

export function EmployeeKnowledgeDetail({ agentId }: { agentId: AgentId }) {
  const { t, lang } = useT()
  const k = useEmployeeKnowledgeAccess(agentId)

  return (
    <section
      className="employee-knowledge-detail"
      data-employee-knowledge
      aria-label={t('knowledge.empSection')}
    >
      <h2 className="employee-detail__section-title">{t('knowledge.empSection')}</h2>

      <div className="employee-knowledge-detail__related">
        {t('knowledge.empRelated', { n: k.relatedCount })}
      </div>

      <div className="employee-knowledge-detail__owned">
        <div className="employee-knowledge-detail__owned-title">{t('knowledge.empOwned')}</div>
        {k.ownedNodes.length === 0 ? (
          <div className="employee-knowledge-detail__empty">{t('knowledge.empEmpty')}</div>
        ) : (
          <ul className="employee-knowledge-detail__list">
            {k.ownedNodes.map((n) => {
              const contributor = n.ownerAgent ? AGENT_MAP[n.ownerAgent] : undefined
              return (
                <li className="employee-knowledge-detail__item" key={n.id} data-knowledge-node={n.id}>
                  <span className="employee-knowledge-detail__node-title">
                    {resolveLoc(n.title, n.titleLoc, lang)}
                  </span>
                  {n.source && (
                    <span className="employee-knowledge-detail__source" data-knowledge-source>
                      <span aria-hidden>{SOURCE_ICON[n.source.type]}</span>
                      <span className="employee-knowledge-detail__source-uri">{n.source.uri}</span>
                    </span>
                  )}
                  {contributor && (
                    <span className="employee-knowledge-detail__contributor" data-knowledge-contributor>
                      <AgentAvatar agent={contributor} size={16} />
                      <span>{contributor.name}</span>
                    </span>
                  )}
                  {n.aiStatus && (
                    <span
                      className={`employee-knowledge-detail__status employee-knowledge-detail__status--${n.aiStatus}`}
                      data-knowledge-status={n.aiStatus}
                    >
                      {t(
                        n.aiStatus === 'draft'
                          ? 'knowledge.status.draft'
                          : n.aiStatus === 'confirmed'
                            ? 'knowledge.status.confirmed'
                            : 'knowledge.status.auto',
                      )}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <EmployeeKnowledgeSuggestions
        agentId={agentId}
        seedNodeId={k.ownedNodes[0]?.id ?? null}
      />

      <EmployeeKnowledgeContribute agentId={agentId} />
    </section>
  )
}
