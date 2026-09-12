import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AgentId, KnowledgeNode, RelationType } from '../types'
import { useT } from '../i18n'
import { store, useNodes, useRelationships, useSelection } from '../store/canvasStore'
import { bindEmployeeAccess } from '../knowledge/knowledgeUniverse'
import { AGENT_MAP } from '../domain/agents'
import { AgentAvatar } from './AgentAvatar'
import './SharedKnowledgeSpace.css'

/* ============================================================
 * Shared Knowledge Space · Stage 5 (knowledge-graph visualization).
 *
 * This is the identity layer for the Shared Knowledge Universe — the single
 * shared, read-only knowledge asset pool that ALL employees participate in.
 * It wraps (does NOT rewrite) the existing canvas and adds four read-only
 * overlays:
 *   1. Space identity header      — names the universe, marks it shared.
 *   2. Knowledge graph layer      — legend of node/edge/relationship/source/
 *                                   contributor (reference only, no statistics).
 *   3. Inspector                  — selected node's source + contributor chip +
 *                                   relationships (read-only).
 *   4. Employee readonly lens     — lists contributing employees; clicking
 *                                   highlights (selects) their nodes. Never
 *                                   creates a private space, never mutates data.
 *
 * Hard red lines (Stage 5 D1-D5):
 *   - D1 wraps the canvas; does NOT rewrite it; no second graph renderer.
 *   - D3 read-only: no weight scoring / AI reco / auto-analysis / statistics.
 *   - D4 employee lens is a read-only projection; highlight = store.setSelection
 *     (existing canvas capability) — no node ownership move, no knowledge edit.
 *   - D5 boundaries: Memory = user context, Capability = employee ability,
 *     Knowledge = shared universe. This surface carries Knowledge ONLY.
 *   - Uses the KnowledgeBackend interface only (via store + getSharedUniverse);
 *     never bypasses the seam or touches a real KG database.
 * ============================================================ */

const RELATION_TYPES: RelationType[] = ['related', 'prerequisite', 'derived', 'partOf', 'sequence']

const SOURCE_TYPES: { type: 'pdf' | 'url' | 'video' | 'github' | 'chat'; icon: string }[] = [
  { type: 'pdf', icon: '📄' },
  { type: 'url', icon: '🔗' },
  { type: 'video', icon: '🎬' },
  { type: 'github', icon: '🐙' },
  { type: 'chat', icon: '💬' },
]

export function SharedKnowledgeSpace({ children }: { children: ReactNode }) {
  const { t } = useT()
  const nodes = useNodes()
  const relationships = useRelationships()
  const selection = useSelection()
  const [lensAgent, setLensAgent] = useState<AgentId | null>(null)
  // Stage 10 (D3): read-only owned-node projection for the selected employee lens.
  // Sourced exclusively via EmployeeKnowledgeAccess (→ SharedKnowledgeUniverse);
  // never reads KnowledgeBackend / LightRAG* directly. Canvas architecture untouched.
  const [lensNodes, setLensNodes] = useState<KnowledgeNode[]>([])

  useEffect(() => {
    if (!lensAgent) {
      setLensNodes([])
      return
    }
    let cancelled = false
    bindEmployeeAccess(lensAgent)
      .listOwned()
      .then((owned) => {
        if (!cancelled) setLensNodes(owned)
      })
      .catch(() => {
        if (!cancelled) setLensNodes([])
      })
    return () => {
      cancelled = true
    }
  }, [lensAgent])

  // Contributors = agents that own >= 1 node — a read-only derivation from the
  // shared store. No counts (D3: no statistics), just WHO participates.
  const contributors = useMemo(() => {
    const ids = new Set<AgentId>()
    Object.values(nodes).forEach((n) => {
      if (n.ownerAgent) ids.add(n.ownerAgent)
    })
    return [...ids]
  }, [nodes])

  // D4: clicking an employee highlights (selects) the nodes they contributed.
  // Reuses the canvas selection capability — no new mutation path, no private
  // space, no ownership change.
  const onLensClick = (id: AgentId) => {
    setLensAgent(id)
    const owned = Object.values(nodes)
      .filter(n => n.ownerAgent === id)
      .map(n => n.id)
    store.setSelection(owned)
  }

  const selectedId = selection.size === 1 ? [...selection][0] : null
  const selectedNode = selectedId ? nodes[selectedId] : null
  const selectedRels = selectedId
    ? Object.values(relationships).filter(r => r.source === selectedId || r.target === selectedId)
    : []

  // All agents (for the contributor legend) — reference, not a statistic.
  const allAgents = useMemo(() => Object.values(AGENT_MAP), [])

  return (
    <section className="sks" aria-label={t('knowledge.space.title')}>
      {/* 1. Space identity header */}
      <header className="sks__header">
        <h1 className="sks__title">{t('knowledge.space.title')}</h1>
        <p className="sks__subtitle">{t('knowledge.space.subtitle')}</p>
      </header>

      <div className="sks__body">
        {/* Reused canvas (D1) */}
        <div className="sks__canvas">{children}</div>

        {/* 2. Knowledge graph layer — read-only legend (D3, no statistics) */}
        <div className="sks__graph-layer" aria-label={t('knowledge.graph.title')}>
          <div className="sks__legend-block">
            <div className="sks__legend-title">{t('knowledge.graph.relationship')}</div>
            {RELATION_TYPES.map(rt => (
              <div className="sks__legend-row" key={rt}>
                <span className="sks__legend-icon">⟿</span>
                <span>{t(('edge.' + rt) as Parameters<typeof t>[0])}</span>
              </div>
            ))}
          </div>
          <div className="sks__legend-block">
            <div className="sks__legend-title">{t('knowledge.graph.source')}</div>
            {SOURCE_TYPES.map(s => (
              <div className="sks__legend-row" key={s.type}>
                <span className="sks__legend-icon">{s.icon}</span>
                <span>{t(('source.' + s.type) as Parameters<typeof t>[0])}</span>
              </div>
            ))}
          </div>
          <div className="sks__legend-block">
            <div className="sks__legend-title">{t('knowledge.graph.contributor')}</div>
            <div className="sks__contrib-row">
              {allAgents.map(a => (
                <AgentAvatar key={a.id} agent={a} size={22} />
              ))}
            </div>
          </div>
        </div>

        {/* 3 + 4: Inspector + Employee readonly lens (right sidebar) */}
        <aside className="sks__side">
          <div className="sks__lens">
            <div className="sks__section-title">{t('knowledge.lens.title')}</div>
            {contributors.length === 0 ? (
              <div className="sks__lens-empty">{t('knowledge.lens.empty')}</div>
            ) : (
              <>
                <div className="sks__lens-list">
                  {contributors.map((id) => {
                    const agent = AGENT_MAP[id]
                    if (!agent) return null
                    const active = lensAgent === id
                    return (
                      <button
                        type="button"
                        key={id}
                        className={'sks__lens-item' + (active ? ' is-active' : '')}
                        data-lens-agent={id}
                        onClick={() => onLensClick(id)}
                      >
                        <AgentAvatar agent={agent} size={24} />
                        <span className="sks__lens-meta">
                          <span className="sks__lens-name">{agent.name}</span>
                          <span className="sks__lens-role">{agent.role}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="sks__lens-hint">{t('knowledge.lens.hint')}</p>
                {lensNodes.length > 0 && (
                  <div className="sks__lens-projection" data-lens-projection={lensAgent ?? ''}>
                    <div className="sks__lens-projection-title">{t('knowledge.lens.projection')}</div>
                    <ul className="sks__lens-projection-list">
                      {lensNodes.map((n) => {
                        const contributor = n.ownerAgent ? AGENT_MAP[n.ownerAgent] : undefined
                        return (
                          <li className="sks__lens-projection-item" key={n.id} data-knowledge-node={n.id}>
                            <span className="sks__lens-projection-name">{n.title}</span>
                            {n.source && (
                              <span className="sks__chip sks__lens-projection-source">
                                {SOURCE_TYPES.find(s => s.type === n.source?.type)?.icon}
                                {n.source?.uri}
                              </span>
                            )}
                            {contributor && (
                              <span className="sks__lens-projection-contributor">
                                <AgentAvatar agent={contributor} size={16} />
                                {contributor.name}
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="sks__inspector">
            <div className="sks__section-title">{t('knowledge.inspector.title')}</div>
            {!selectedNode ? (
              <div className="sks__lens-empty">{t('knowledge.inspector.empty')}</div>
            ) : (
              <div className="sks__inspector-body">
                <div className="sks__inspector-row">
                  <span className="sks__inspector-key">{t('knowledge.inspector.nodeTitle')}</span>
                  {selectedNode.title}
                </div>
                {selectedNode.source && (
                  <div className="sks__inspector-row">
                    <span className="sks__inspector-key">{t('knowledge.inspector.source')}</span>
                    <span className="sks__chip">
                      {SOURCE_TYPES.find(s => s.type === selectedNode.source.type)?.icon}
                      {selectedNode.source.uri}
                    </span>
                  </div>
                )}
                {selectedNode.ownerAgent && AGENT_MAP[selectedNode.ownerAgent] && (
                  <div className="sks__inspector-row">
                    <span className="sks__inspector-key">{t('knowledge.inspector.contributor')}</span>
                    <span className="sks__chip">
                      <AgentAvatar agent={AGENT_MAP[selectedNode.ownerAgent]} size={16} />
                      {AGENT_MAP[selectedNode.ownerAgent].name}
                    </span>
                  </div>
                )}
                <div className="sks__inspector-row">
                  <span className="sks__inspector-key">{t('knowledge.inspector.relationships')}</span>
                  {selectedRels.length === 0 ? (
                    <span className="sks__lens-empty">—</span>
                  ) : (
                    <div className="sks__rel-list">
                      {selectedRels.map(r => (
                        <span className="sks__rel" key={r.id}>
                          {t(('edge.' + r.type) as Parameters<typeof t>[0])}
                          {r.reason ? ' · ' + r.reason : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {selection.size > 1 && (
              <div className="sks__inspector-note">{t('knowledge.inspector.multi')}</div>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
