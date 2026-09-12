import type { Cluster, KnowledgeEdge, KnowledgeNode } from '../types'

// Seed graph — user-owned (aiStatus 'confirmed') so the "clear AI generated" action
// never touches them. Positions are world coordinates (pre-zoom). The four project
// nodes are laid out compactly so the seeded "AI 创业项目" frame reads as intentional.
export const SEED_NODES: KnowledgeNode[] = [
  {
    id: 'doc-product-spec',
    kind: 'document',
    title: '产品需求文档 v2',
    meta: { pages: '32', owner: '产品' },
    aiStatus: 'confirmed',
    position: { x: 240, y: 120 },
    ownerAgent: 'knowledge',
  },
  {
    id: 'video-onboarding',
    kind: 'video',
    title: '新用户引导录屏',
    titleLoc: { 'en-US': 'New User Onboarding Recording' },
    meta: { duration: '12:40', size: '240MB' },
    aiStatus: 'confirmed',
    position: { x: 300, y: 380 },
    ownerAgent: 'task',
  },
  {
    id: 'chat-design-sync',
    kind: 'conversation',
    title: '设计评审对话',
    meta: { messages: '58' },
    aiStatus: 'confirmed',
    position: { x: 560, y: 440 },
    ownerAgent: 'nox',
  },
  {
    id: 'proj-launch-q3',
    kind: 'project',
    title: 'Q3 发布项目',
    meta: { branch: 'main', tasks: '24' },
    aiStatus: 'confirmed',
    position: { x: 520, y: 240 },
    ownerAgent: 'assistant',
    isHub: true,
  },
  {
    id: 'doc-research-notes',
    kind: 'document',
    title: '竞品调研笔记',
    meta: { pages: '11' },
    aiStatus: 'confirmed',
    position: { x: 860, y: 120 },
    ownerAgent: 'nox',
  },
  {
    id: 'doc-market-analysis',
    kind: 'document',
    title: '市场分析报告',
    meta: { pages: '19' },
    aiStatus: 'confirmed',
    position: { x: 1120, y: 150 },
    ownerAgent: 'knowledge',
  },
  {
    id: 'video-competitor-demo',
    kind: 'video',
    title: '竞品 Demo 录屏',
    meta: { duration: '08:12' },
    aiStatus: 'confirmed',
    position: { x: 1160, y: 380 },
    ownerAgent: 'task',
  },
]

export const SEED_EDGES: KnowledgeEdge[] = [
  {
    id: 'e-seed-1',
    from: 'doc-product-spec',
    to: 'proj-launch-q3',
    kind: 'manual',
    reason: 'edge.rel1',
  },
  {
    id: 'e-seed-2',
    from: 'chat-design-sync',
    to: 'doc-product-spec',
    kind: 'manual',
    reason: 'edge.rel2',
  },
  {
    id: 'e-seed-3',
    from: 'doc-research-notes',
    to: 'doc-product-spec',
    kind: 'manual',
    reason: 'edge.rel3',
  },
  {
    id: 'e-seed-4',
    from: 'doc-market-analysis',
    to: 'doc-research-notes',
    kind: 'manual',
    reason: 'edge.rel4',
  },
]

/** Pre-built cluster so the canvas shows a real frame on first entry
 *  (not just a right-panel hint). `auto` = user/hand-seeded, kept on undo. */
export const SEED_CLUSTERS: Cluster[] = [
  {
    id: 'cl-seed-project',
    title: 'cluster.seedProject',
    kind: 'auto',
    memberIds: [
      'doc-product-spec',
      'video-onboarding',
      'chat-design-sync',
      'proj-launch-q3',
    ],
  },
]

// ===========================================================================
// Demo Flow seed (P4-1/4) — independent `demo-*` ids, never touching SEED_*/GROWTH_*.
// Only used by startDemo(); fully cleared on endDemo() via snapshot restore.
// ===========================================================================
export const DEMO_SPACE_NODES: KnowledgeNode[] = [
  {
    id: 'demo-video',
    kind: 'video',
    title: '产品演示录屏',
    meta: { duration: '06:20' },
    aiStatus: 'confirmed',
    position: { x: 300, y: 160 },
    ownerAgent: 'task',
  },
  {
    id: 'demo-doc',
    kind: 'document',
    title: '竞品分析报告',
    meta: { pages: '14' },
    aiStatus: 'confirmed',
    position: { x: 560, y: 300 },
    ownerAgent: 'nox',
  },
  {
    id: 'demo-project',
    kind: 'project',
    title: 'AI 员工计划',
    meta: { branch: 'main' },
    aiStatus: 'confirmed',
    position: { x: 520, y: 140 },
    ownerAgent: 'assistant',
    isHub: true,
  },
]

export const DEMO_SPACE_EDGES: KnowledgeEdge[] = [
  { id: 'demo-e1', from: 'demo-doc', to: 'demo-project', kind: 'manual', reason: 'edge.rel1' },
  { id: 'demo-e2', from: 'demo-video', to: 'demo-project', kind: 'manual', reason: 'edge.rel2' },
]

export const DEMO_SPACE_CLUSTER: Cluster[] = [
  {
    id: 'demo-cl',
    title: 'cluster.seedProject',
    kind: 'auto',
    memberIds: ['demo-video', 'demo-doc', 'demo-project'],
  },
]

// ===========================================================================
// Galaxy / Growth seed (v1.3) — abstract knowledge units for the "Growth" mode.
// Positions are computed by layoutGalaxy at bootstrap; placeholders here.
// ===========================================================================
// `GROWTH_KINDS` used to be defined here; P2-1 moved it to
// `src/domain/nodeKinds.ts` (domain vocabulary, not fixture data — boundary F10).

export const GROWTH_NODES: KnowledgeNode[] = [
  {
    id: 'c-llm', kind: 'concept', title: 'LLM 基础',
    titleLoc: { 'en-US': 'LLM Basics' },
    meta: { domain: 'AI' }, aiStatus: 'confirmed',
    position: { x: 0, y: 0 },
    ownerAgent: 'nox',
    concept: {
      mastery: 0.85, relatedCount: 4,
      aiSuggestion: '你已理解 Transformer 推理机制',
      aiSuggestionLoc: { 'en-US': 'You understand Transformer inference' },
      description: '大模型如何理解并生成语言的基础原理',
      descriptionLoc: { 'en-US': 'How large models understand and generate language' },
      nextAction: '复习注意力机制',
      nextActionLoc: { 'en-US': 'Review attention mechanism' },
      prerequisites: [],
    },
  },
  {
    id: 'c-prompt', kind: 'concept', title: 'Prompt Engineering',
    titleLoc: { 'en-US': 'Prompt Engineering' },
    meta: { domain: 'AI' }, aiStatus: 'confirmed',
    position: { x: 0, y: 0 }, ownerAgent: 'nox',
    concept: {
      mastery: 0.8, relatedCount: 3,
      aiSuggestion: 'Few-shot 与结构化提示已熟练',
      aiSuggestionLoc: { 'en-US': 'Few-shot & structured prompting mastered' },
      description: '用清晰的提示词引导模型产出稳定结果',
      descriptionLoc: { 'en-US': 'Guide models to stable output with clear prompts' },
      nextAction: '练习函数调用描述',
      nextActionLoc: { 'en-US': 'Practice function-call descriptions' },
      prerequisites: [],
    },
  },
  {
    id: 'c-tool', kind: 'concept', title: 'Tool Calling',
    titleLoc: { 'en-US': 'Tool Calling' },
    meta: { domain: 'AI' }, aiStatus: 'confirmed',
    position: { x: 0, y: 0 }, ownerAgent: 'nox',
    concept: {
      mastery: 0.7, relatedCount: 2,
      aiSuggestion: '工具描述与解析基本掌握',
      aiSuggestionLoc: { 'en-US': 'Tool description & parsing grasped' },
      description: '让模型调用外部函数与工具完成任务',
      descriptionLoc: { 'en-US': 'Let models call external functions & tools' },
      nextAction: '实现 Router Plugin 串联工具',
      nextActionLoc: { 'en-US': 'Wire tools via a Router Plugin' },
      prerequisites: ['c-llm', 'c-prompt'],
    },
  },
  {
    id: 'c-memory', kind: 'concept', title: 'Memory Architecture',
    titleLoc: { 'en-US': 'Memory Architecture' },
    meta: { domain: 'AI' }, aiStatus: 'confirmed',
    position: { x: 0, y: 0 }, ownerAgent: 'nox',
    concept: {
      mastery: 0.2, relatedCount: 2,
      aiSuggestion: '⚠️ 你在此存在明显知识缺口',
      aiSuggestionLoc: { 'en-US': '⚠️ Clear knowledge gap here' },
      description: '让模型跨会话记住上下文与知识',
      descriptionLoc: { 'en-US': 'Let models remember context & knowledge across sessions' },
      nextAction: '学习 RAG 与向量记忆',
      nextActionLoc: { 'en-US': 'Learn RAG & vector memory' },
      prerequisites: ['c-llm'],
    },
  },
  {
    id: 'skill-rag', kind: 'skill', title: 'RAG',
    titleLoc: { 'en-US': 'RAG' },
    meta: { domain: 'AI' }, aiStatus: 'confirmed',
    position: { x: 0, y: 0 }, ownerAgent: 'knowledge',
    concept: {
      mastery: 0.4, relatedCount: 2,
      description: '检索外部知识再交给模型生成回答',
      descriptionLoc: { 'en-US': 'Retrieve external knowledge then generate' },
      nextAction: '搭建检索增强管线',
      nextActionLoc: { 'en-US': 'Build a retrieval-augmented pipeline' },
      prerequisites: ['c-memory'],
    },
  },
  {
    id: 'skill-embed', kind: 'skill', title: 'Embedding',
    titleLoc: { 'en-US': 'Embedding' },
    meta: { domain: 'AI' }, aiStatus: 'confirmed',
    position: { x: 0, y: 0 }, ownerAgent: 'knowledge',
    concept: {
      mastery: 0.5, relatedCount: 2,
      description: '把文字变成可比较的向量',
      descriptionLoc: { 'en-US': 'Turn text into comparable vectors' },
      nextAction: '对比稠密与稀疏向量',
      nextActionLoc: { 'en-US': 'Compare dense vs sparse vectors' },
      prerequisites: [],
    },
  },
  {
    id: 'c-agentfw', kind: 'concept', title: 'Agent Framework',
    titleLoc: { 'en-US': 'Agent Framework' },
    meta: { domain: 'AI' }, aiStatus: 'confirmed',
    position: { x: 0, y: 0 }, ownerAgent: 'nox',
    concept: {
      mastery: 0.3, relatedCount: 3,
      aiSuggestion: '规划/反思循环尚未打通',
      aiSuggestionLoc: { 'en-US': 'Plan/reflect loop not yet connected' },
      description: '让模型自主规划并调度工具完成任务',
      descriptionLoc: { 'en-US': 'Let models plan & orchestrate tools autonomously' },
      nextAction: '阅读 ReAct 范式',
      nextActionLoc: { 'en-US': 'Read the ReAct paradigm' },
      prerequisites: ['c-tool', 'c-memory'],
    },
  },
  {
    id: 'c-multi', kind: 'concept', title: 'Multi-Agent',
    titleLoc: { 'en-US': 'Multi-Agent' },
    meta: { domain: 'AI' }, aiStatus: 'confirmed',
    position: { x: 0, y: 0 }, ownerAgent: 'nox',
    concept: {
      mastery: 0, relatedCount: 2,
      description: '多个模型分工协作完成复杂目标',
      descriptionLoc: { 'en-US': 'Multiple models divide work to reach complex goals' },
      nextAction: '理解角色分工与消息总线',
      nextActionLoc: { 'en-US': 'Understand role split & message bus' },
      prerequisites: ['c-agentfw'],
    },
  },
  {
    id: 'c-employee', kind: 'concept', title: 'AI Employee',
    titleLoc: { 'en-US': 'AI Employee' },
    meta: { domain: 'AI' }, aiStatus: 'confirmed',
    position: { x: 0, y: 0 }, ownerAgent: 'nox',
    concept: {
      mastery: 0, relatedCount: 1,
      aiSuggestion: '这是你的终极目标：让 AI 像员工一样协作',
      aiSuggestionLoc: { 'en-US': 'Your ultimate goal: AI collaborating like employees' },
      description: '让 AI 像员工一样长期承担职责',
      descriptionLoc: { 'en-US': 'Let AI take on responsibilities like an employee' },
      nextAction: '定义员工职责边界',
      nextActionLoc: { 'en-US': 'Define employee responsibility boundaries' },
      prerequisites: ['c-multi'],
    },
  },
]

export const GROWTH_RELATIONSHIPS: Relationship[] = [
  { id: 'r-1', source: 'c-llm', target: 'c-prompt', type: 'related', confidence: 0.7, reason: 'edge.rel5' },
  { id: 'r-2', source: 'c-llm', target: 'c-tool', type: 'prerequisite', confidence: 0.9, reason: 'edge.rel6' },
  { id: 'r-3', source: 'c-prompt', target: 'c-tool', type: 'prerequisite', confidence: 0.85, reason: 'edge.rel7' },
  { id: 'r-4', source: 'c-llm', target: 'c-memory', type: 'prerequisite', confidence: 0.8, reason: 'edge.rel8' },
  { id: 'r-5', source: 'c-memory', target: 'c-agentfw', type: 'prerequisite', confidence: 0.8, reason: 'edge.rel9' },
  { id: 'r-6', source: 'c-tool', target: 'c-agentfw', type: 'prerequisite', confidence: 0.8, reason: 'edge.rel10' },
  { id: 'r-7', source: 'c-memory', target: 'skill-rag', type: 'partOf', confidence: 0.9, reason: 'edge.rel11' },
  { id: 'r-8', source: 'skill-embed', target: 'c-memory', type: 'related', confidence: 0.75, reason: 'edge.rel12' },
  { id: 'r-9', source: 'c-agentfw', target: 'c-multi', type: 'prerequisite', confidence: 0.85, reason: 'edge.rel13' },
  { id: 'r-10', source: 'c-multi', target: 'c-employee', type: 'prerequisite', confidence: 0.9, reason: 'edge.rel14' },
]

export const GROWTH_PATHS: LearningPath[] = [
  {
    id: 'path-agent', title: '30 分钟 · AI Agent 入门', titleLoc: { 'en-US': '30 min · AI Agent 101' },
    goal: '系统理解 AI Agent 知识体系', goalLoc: { 'en-US': 'Understand the AI Agent knowledge system' },
    nodeIds: ['c-llm', 'c-prompt', 'c-tool', 'c-memory', 'c-agentfw', 'c-multi', 'c-employee'],
    ownerAgent: 'nox', aiGenerated: true, createdAt: Date.now(),
  },
  {
    id: 'path-rag', title: 'RAG 专项路线', titleLoc: { 'en-US': 'RAG Deep Dive' },
    goal: '掌握检索增强生成', goalLoc: { 'en-US': 'Master retrieval-augmented generation' },
    nodeIds: ['skill-embed', 'c-memory', 'skill-rag'],
    ownerAgent: 'knowledge', aiGenerated: true, createdAt: Date.now(),
  },
]

export const GROWTH_PROGRESS: Progress[] = GROWTH_NODES.map((n) => {
  const m = n.concept?.mastery ?? 0
  return {
    nodeId: n.id,
    mastery: m,
    status: m >= 0.8 ? 'known' : m > 0 ? 'learning' : 'gap',
    updatedAt: Date.now(),
  }
})

export const GROWTH_RECOMMENDATIONS: AIRecommendation[] = [
  {
    id: 'rec-gap-memory', kind: 'gap',
    title: '记忆架构', titleLoc: { 'en-US': 'Memory Architecture' },
    description: '你的 Agent 知识缺少记忆架构，建议优先补齐',
    descriptionLoc: { 'en-US': 'Your Agent knowledge lacks a memory architecture — prioritize this' },
    agentId: 'nox', relatedNodeIds: ['c-memory'], createdAt: Date.now(),
  },
  {
    id: 'rec-path', kind: 'path',
    title: '30 分钟 · AI Agent Memory 入门', titleLoc: { 'en-US': '30 min · AI Agent Memory 101' },
    description: '从记忆架构到 RAG 的速通路线',
    descriptionLoc: { 'en-US': 'A fast route from memory architecture to RAG' },
    agentId: 'nox', pathId: 'path-agent', createdAt: Date.now(),
  },
  {
    id: 'rec-next', kind: 'next',
    title: '下一步行动', titleLoc: { 'en-US': 'Next action' },
    description: '实现 Router Plugin 以串联工具调用',
    descriptionLoc: { 'en-US': 'Implement a Router Plugin to wire tool calls' },
    agentId: 'nox', relatedNodeIds: ['c-tool'], createdAt: Date.now(),
  },
]
