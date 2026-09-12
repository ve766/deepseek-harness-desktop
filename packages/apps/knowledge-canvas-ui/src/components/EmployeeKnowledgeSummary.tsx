// Stage 10 (D1): read-only Knowledge summary entry for the Employee Center card.
//
// Shows ONLY a contribution count + knowledge-access permission badge. It does NOT
// expose any search / retrieval / graph UI (per D1). Data comes exclusively from
// `useEmployeeKnowledgeAccess` → EmployeeKnowledgeAccess → SharedKnowledgeUniverse.
//
// This component does not modify <EmployeeCard> or the EmployeeIdentity contract —
// it is rendered *next to* the card (in the card foot), consuming the same AgentId.

import type { AgentId } from '../types'
import { useT } from '../i18n'
import { useEmployeeKnowledgeAccess } from './useEmployeeKnowledgeAccess'

export function EmployeeKnowledgeSummary({ agentId }: { agentId: AgentId }) {
  const { t } = useT()
  const k = useEmployeeKnowledgeAccess(agentId)

  return (
    <div className="employee-knowledge-summary" data-knowledge-summary={agentId}>
      <span className="employee-knowledge-summary__label">{t('knowledge.empSummaryTitle')}</span>
      <span className="employee-knowledge-summary__count">
        {t('knowledge.empOwnedCount', { n: k.ownedCount })}
      </span>
      <span
        className={'employee-knowledge-summary__perm employee-knowledge-summary__perm--' + k.permission}
        data-knowledge-permission={k.permission}
      >
        {t('knowledge.empPermission')}: {t(('knowledge.perm.' + k.permission) as Parameters<typeof t>[0])}
      </span>
    </div>
  )
}
