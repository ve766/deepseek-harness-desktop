import type {
  AgentId,
  KnowledgeBackend,
  KnowledgeEdge,
  KnowledgeNode,
  MemoryEntry,
  SourceRef,
} from '../types'
import { SEED_EDGES, SEED_NODES } from './data'
import { uid } from '../utils'
import { ingestSource } from '../knowledge/ingestion/ingestion'

// In-memory mock. No network, no embedding, no agent, no router.
// The store seeds from listNodes()/listEdges(); the demo sequencer calls
// importSource()/getNeighbors() to drive its scripted flow.
export class MockBackend implements KnowledgeBackend {
  private nodes: KnowledgeNode[] = SEED_NODES.map(n => ({ ...n }))
  private edges: KnowledgeEdge[] = SEED_EDGES.map(e => ({ ...e }))
  private memory: MemoryEntry[] = [
    {
      id: 'm1',
      category: 'user',
      text: {
        'zh-CN': '用户偏好稳定优先于功能多',
        'en-US': 'User prefers stability over more features',
      },
    },
    {
      id: 'm2',
      category: 'project',
      text: {
        'zh-CN': 'Q3 发布聚焦 Knowledge OS 桌面端',
        'en-US': 'Q3 release focuses on the Knowledge OS desktop',
      },
    },
    {
      id: 'm3',
      category: 'habit',
      text: {
        'zh-CN': '每天上午同步一次知识库索引',
        'en-US': 'Sync the knowledge index every morning',
      },
    },
    {
      id: 'm4',
      category: 'task',
      text: {
        'zh-CN': '视频理解任务默认交给 Nox 处理',
        'en-US': 'Video-understanding tasks default to Nox',
      },
    },
  ]

  async listNodes(): Promise<KnowledgeNode[]> {
    return this.nodes.map(n => ({ ...n }))
  }
  async listEdges(): Promise<KnowledgeEdge[]> {
    return this.edges.map(e => ({ ...e }))
  }
  async importSource(src: SourceRef): Promise<{ nodeId: string }> {
    const id = uid('node')
    this.nodes.push({
      id,
      kind: src.type === 'video' ? 'video' : src.type === 'chat' ? 'conversation' : 'document',
      title: '导入：' + src.uri.split('/').pop(),
      meta: { source: src.type },
      source: src,
      aiStatus: 'draft',
      position: { x: 0, y: 0 },
    })
    return { nodeId: id }
  }
  /**
   * Interface-external extension (Stage 12 D2): tag the imported source with an
   * owner WITHOUT changing the `KnowledgeBackend` 5-method contract. Mirrors
   * `LightRAGBackend.importSourceAs` so both backends share the same seam:
   *   SourceRef → ingestion layer (ingestSource) → attributed node.
   * `ownerAgent` is written onto the resulting `KnowledgeNode` so the seam's
   * `listOwned(agentId)` (filter `ownerAgent === agentId`) closes the loop.
   */
  async importSourceAs(src: SourceRef, ownerAgent?: AgentId): Promise<{ nodeId: string }> {
    // Stage 8/12: route through the ingestion layer (SourceRef → normalized text).
    // Scrapling/PDF/GitHub extraction happens there, never in this mock adapter.
    const doc = await ingestSource(src, { ownerAgent })
    const id = uid('node')
    this.nodes.push({
      id,
      kind: src.type === 'video' ? 'video' : src.type === 'chat' ? 'conversation' : 'document',
      title: '导入：' + src.uri.split('/').pop(),
      meta: { source: src.type, content: doc.content },
      source: src,
      ownerAgent,
      aiStatus: 'draft',
      position: { x: 0, y: 0 },
    })
    return { nodeId: id }
  }
  async getNeighbors(
    _nodeId: string,
    _text: string,
  ): Promise<{ nodeId: string; score: number; reason: string }[]> {
    // Mock similarity: return a couple of seed nodes with plausible reasons.
    return this.nodes
      .filter(n => n.id !== _nodeId)
      .slice(0, 2)
      .map((n, i) => ({
        nodeId: n.id,
        score: 0.7 - i * 0.15,
        reason: i === 0 ? 'edge.reason1' : 'edge.reason2',
      }))
  }
  async getMemory(): Promise<MemoryEntry[]> {
    return this.memory.map(m => ({ ...m }))
  }
}
