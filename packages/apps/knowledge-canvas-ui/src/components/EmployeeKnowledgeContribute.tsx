// Stage 11 (D1-B / D2 / D3 / D5 / D7): controlled contribution entry.
//
// Rendered inside the Employee Detail Knowledge section (D2). The write entry is
// GATED by permission (D7): read-only agents (assistant/task) never see it. On
// submit it performs ONE controlled write through `useEmployeeKnowledgeContribute`
// and shows the real `ContributionResult` — status is always 'draft' and we NEVER
// invent review/confirmed transitions (D5). No Workflow Runtime, no Chat (D3).

import { useEffect, useState } from 'react'
import type { AgentId, KnowledgeNode, SourceRef } from '../types'
import { useT } from '../i18n'
import { useEmployeeKnowledgeContribute } from './useEmployeeKnowledgeContribute'
import { useEmployeeKnowledgeAccess, emitKnowledgeContribution } from './useEmployeeKnowledgeAccess'
import { AGENT_MAP } from '../domain/agents'

// G7 (Stage 12 D4): the dropdown may ONLY offer SourceRef types that the
// ingestion registry actually supports (chat/url/pdf/video/github). 'text' is
// NOT a registered SourceRef type (see types.ts + ingestion.ts registry), so it
// was an illegal option — removed. Free-form text can still be pasted via the
// 'chat' type (ChatIngestion passes content through unchanged).
const SOURCE_TYPES: SourceRef['type'][] = ['url', 'pdf', 'video', 'github', 'chat']

export function EmployeeKnowledgeContribute({ agentId }: { agentId: AgentId }) {
  const { t } = useT()
  const { canContribute, contribute, submitting, result, reset } =
    useEmployeeKnowledgeContribute(agentId)
  // D4: read the same owned projection so we can surface the just-created node's
  // real title + status. All data flows through EmployeeKnowledgeAccess (seam),
  // never the backend directly (dataFromAccessOnly).
  const k = useEmployeeKnowledgeAccess(agentId)

  // D4: when a contribution succeeds, signal the shared universe so this panel
  // AND EmployeeKnowledgeDetail's owned list refresh (ownedProjectionRefresh).
  useEffect(() => {
    if (result?.ok) emitKnowledgeContribution(agentId)
  }, [result, agentId])

  // The node we just created, resolved from the owned projection by id.
  const contributedNode: KnowledgeNode | undefined =
    result?.ok ? k.ownedNodes.find(n => n.id === result.nodeId) : undefined

  // D7: no write entry for read-only agents.
  if (!canContribute) return null

  const [type, setType] = useState<SourceRef['type']>('url')
  const [uri, setUri] = useState('')

  const handleSubmit = () => {
    const value = uri.trim()
    if (!value) return
    const src: SourceRef = { type, uri: value }
    void contribute(src)
  }

  const contributor = AGENT_MAP[agentId]

  return (
    <div className="employee-knowledge-contribute" data-knowledge-contribute>
      <h3 className="employee-knowledge-contribute__title">{t('knowledge.contrib.title')}</h3>
      <p className="employee-knowledge-contribute__hint">{t('knowledge.contrib.hint')}</p>

      {!result && (
        <div className="employee-knowledge-contribute__form">
          <label className="employee-knowledge-contribute__field">
            <span className="employee-knowledge-contribute__label">{t('knowledge.contrib.type')}</span>
            <select
              className="employee-knowledge-contribute__select"
              value={type}
              onChange={e => setType(e.target.value as SourceRef['type'])}
            >
              {SOURCE_TYPES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="employee-knowledge-contribute__field">
            <span className="employee-knowledge-contribute__label">{t('knowledge.contrib.uri')}</span>
            <input
              className="employee-knowledge-contribute__input"
              type="text"
              value={uri}
              placeholder={t('knowledge.contrib.uriPlaceholder')}
              onChange={e => setUri(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
              }}
            />
          </label>
          <button
            type="button"
            className="employee-knowledge-contribute__submit"
            disabled={submitting || uri.trim().length === 0}
            onClick={handleSubmit}
          >
            {submitting ? t('knowledge.contrib.submitting') : t('knowledge.contrib.submit')}
          </button>
        </div>
      )}

      {result && (
        <div className="employee-knowledge-contribute__result" data-contribute-result>
          {result.ok ? (
            <div className="employee-knowledge-contribute__result-ok">
              <div className="employee-knowledge-contribute__result-line">
                <strong>{t('knowledge.contrib.success')}</strong>
              </div>
              {contributedNode && (
                <div className="employee-knowledge-contribute__row">
                  <span className="employee-knowledge-contribute__key">{t('knowledge.contrib.node')}</span>
                  <span className="employee-knowledge-contribute__val">{contributedNode.title}</span>
                </div>
              )}
              <div className="employee-knowledge-contribute__row">
                <span className="employee-knowledge-contribute__key">{t('knowledge.contrib.status')}</span>
                <span className="employee-knowledge-contribute__badge employee-knowledge-contribute__badge--draft">
                  {t('knowledge.contrib.draft')}
                </span>
              </div>
              <div className="employee-knowledge-contribute__row">
                <span className="employee-knowledge-contribute__key">{t('knowledge.contrib.ownerAgent')}</span>
                <span className="employee-knowledge-contribute__val">
                  {contributor ? contributor.name : agentId}
                </span>
              </div>
              <div className="employee-knowledge-contribute__row">
                <span className="employee-knowledge-contribute__key">
                  {t('knowledge.contrib.ownerAttribution')}
                </span>
                <span className="employee-knowledge-contribute__badge">
                  {result.ownerAttribution === 'attributed'
                    ? t('knowledge.contrib.attributed')
                    : t('knowledge.contrib.unsupported')}
                </span>
              </div>
              <div className="employee-knowledge-contribute__row">
                <span className="employee-knowledge-contribute__key">{t('knowledge.contrib.nodeId')}</span>
                <span className="employee-knowledge-contribute__val employee-knowledge-contribute__mono">
                  {result.nodeId}
                </span>
              </div>
              <div className="employee-knowledge-contribute__row">
                <span className="employee-knowledge-contribute__key">{t('knowledge.contrib.source')}</span>
                <span className="employee-knowledge-contribute__val employee-knowledge-contribute__mono">
                  {type}:{uri.trim()}
                </span>
              </div>
              <button
                type="button"
                className="employee-knowledge-contribute__again"
                onClick={reset}
              >
                {t('knowledge.contrib.again')}
              </button>
            </div>
          ) : (
            <div className="employee-knowledge-contribute__result-fail">
              <span className="employee-knowledge-contribute__badge employee-knowledge-contribute__badge--fail">
                {result.reason === 'permission-denied'
                  ? t('knowledge.contrib.fail.permission')
                  : result.reason === 'backend-unsupported'
                    ? t('knowledge.contrib.fail.backend')
                    : t('knowledge.contrib.fail.ingest')}
              </span>
              <button
                type="button"
                className="employee-knowledge-contribute__again"
                onClick={reset}
              >
                {t('knowledge.contrib.again')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
