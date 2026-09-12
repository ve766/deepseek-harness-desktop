import type { KnowledgeNode, KnowledgeEdge, SourceRef, AgentId } from '../../types'
import type { LightRAGEntity, LightRAGRelation } from './lightragClient'

// Pure mappings between the LightRAG graph model and the core `Knowledge*`
// domain types. These functions are the ONLY place the two vocabularies meet;
// LightRAG types never escape into `../../types` (R6 isolation).

/** Side-channel key we use to carry the owner reference on a LightRAG entity
 *  (LightRAG has no native owner field). Mirrors D3's side-map design. */
const OWNER_META_KEY = 'owner_agent'

export function entityToNode(
  e: LightRAGEntity,
  opts: { position?: { x: number; y: number }; ownerAgent?: AgentId },
): KnowledgeNode {
  const ownerAgent = opts.ownerAgent ?? (e.meta?.[OWNER_META_KEY] as AgentId | undefined)
  const node: KnowledgeNode = {
    id: e.entity_name,
    kind: mapEntityTypeToNodeKind(e.entity_type),
    title: e.entity_name,
    meta: { ...(e.meta ?? {}) },
    aiStatus: e.entity_type === 'document' ? 'confirmed' : 'auto',
    position: opts.position ?? { x: 0, y: 0 },
  }
  if (ownerAgent) node.ownerAgent = ownerAgent
  if (e.source_ids.length > 0) {
    node.source = sourceIdAsRef(e.source_ids[0])
  }
  return node
}

export function relationToEdge(r: LightRAGRelation): KnowledgeEdge {
  return {
    id: `edge:${r.src_id}->${r.tgt_id}`,
    from: r.src_id,
    to: r.tgt_id,
    kind: 'ai-auto',
    reason: r.description,
  }
}

/** Stable source node id for a SourceRef (returned by importSource). */
export function sourceRefToId(src: SourceRef): string {
  return `src:${hash(src.uri)}`
}

/** Attach an owner to a LightRAG entity's metadata (side-map, D3 / R6). */
export function withOwnerMetadata(
  meta: Record<string, string> | undefined,
  owner?: AgentId,
): Record<string, string> | undefined {
  if (!owner) return meta
  return { ...(meta ?? {}), [OWNER_META_KEY]: owner }
}

// --- helpers ---

function mapEntityTypeToNodeKind(type: string): KnowledgeNode['kind'] {
  switch (type) {
    case 'document':
      return 'document'
    case 'video':
      return 'video'
    case 'conversation':
    case 'chat':
      return 'conversation'
    case 'project':
      return 'project'
    default:
      return 'concept'
  }
}

function sourceIdAsRef(id: string): SourceRef {
  // Source id is `src:<hash>` (or a raw uri). We only stored the hash id, so the
  // reconstructed SourceRef carries it as `uri`; a real backend would recover
  // the original SourceRef from the side-map.
  return { type: 'url', uri: id }
}

/** Small dependency-free FNV-1a hash -> hex (deterministic source ids). */
function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}
