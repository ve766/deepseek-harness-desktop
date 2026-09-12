// Domain model for the Knowledge Canvas prototype.
// Shapes mirror (loosely) what the future cordis knowledge-remote / memory-remote
// will expose, so swapping MockBackend -> real backend needs zero UI changes.

import type { LocaleCode, LocText } from './i18n/types'

export type SpaceNodeKind = 'document' | 'video' | 'conversation' | 'project'
export type GrowthNodeKind = 'memory' | 'task' | 'concept' | 'skill' | 'learningPath'
export type NodeKind = SpaceNodeKind | GrowthNodeKind

export type SpaceMode = 'space' | 'growth'

export type AiStatus = 'draft' | 'confirmed' | 'auto'

export type AgentId = 'assistant' | 'nox' | 'knowledge' | 'task'

export interface SourceRef {
  type: 'pdf' | 'url' | 'video' | 'github' | 'chat'
  uri: string
}

export interface KnowledgeNode {
  id: string
  kind: NodeKind
  title: string
  /** Free-form metadata shown under the title (pages / duration / messages / branch). */
  meta: Record<string, string>
  source?: SourceRef
  /** Draft = AI generated, unconfirmed; auto = AI auto-linked; confirmed = user-owned. */
  aiStatus?: AiStatus
  position: { x: number; y: number }
  groupId?: string
  /** Which employee produced / owns this node (drives the small avatar badge). */
  ownerAgent?: AgentId
  /** Hub nodes stay centred when the view auto-fits (e.g. the flagship project). */
  isHub?: boolean
  /** Multilingual node title (UI language overrides the base `title`). */
  titleLoc?: LocText

  // ---- Galaxy / Growth-mode fields (optional) ----
  /** Concept / skill metadata shown in Growth mode. */
  concept?: ConceptMeta
  /** Learning-path membership: which path + ordinal position along it. */
  pathId?: string
  pathOrder?: number
}

/** Growth-mode concept metadata (understanding & mastery of a knowledge unit). */
export interface ConceptMeta {
  /** 0..1 mastery level (shown as a ring on the node + in the overview). */
  mastery?: number
  /** Number of related knowledge units (display only). */
  relatedCount?: number
  /** Short AI suggestion text. */
  aiSuggestion?: string
  /** Multilingual version of `aiSuggestion`. */
  aiSuggestionLoc?: LocText
  /** Human-readable one-liner shown on the node (the "大白话" layer). */
  description?: string
  /** Multilingual version of `description`. */
  descriptionLoc?: LocText
  /** Recommended next action. */
  nextAction?: string
  /** Multilingual version of `nextAction`. */
  nextActionLoc?: LocText
  /** Prerequisite concept ids (used for the learning-path DAG). */
  prerequisites?: string[]
}

/** Alias so components can read `Mode` without the "Space"-prefixed name. */
export type Mode = SpaceMode

/** Weighted, explainable link between two knowledge units (Galaxy edges). */
export type RelationType = 'related' | 'prerequisite' | 'derived' | 'partOf' | 'sequence'
export interface Relationship {
  id: string
  source: string
  target: string
  type: RelationType
  confidence: number
  reason?: string
}

/** An AI (or user) generated learning path: an ordered set of concept nodes. */
export interface LearningPath {
  id: string
  title: string
  goal: string
  titleLoc?: LocText
  goalLoc?: LocText
  nodeIds: string[]
  ownerAgent?: AgentId
  createdAt?: number
  aiGenerated?: boolean
}

/** Per-concept mastery / gap status. */
export interface Progress {
  nodeId: string
  mastery: number // 0..1
  status: 'known' | 'learning' | 'gap'
  updatedAt?: number
}

/** A proactive AI recommendation surfaced by an employee (Nox). */
export interface AIRecommendation {
  id: string
  kind: 'gap' | 'path' | 'next'
  title: string
  description: string
  titleLoc?: LocText
  descriptionLoc?: LocText
  agentId?: AgentId
  relatedNodeIds?: string[]
  pathId?: string
  accepted?: boolean
  createdAt?: number
}

/** Canvas background personalization (stored locally; never uploaded). */
export interface CanvasAppearance {
  backgroundType: 'default' | 'image'
  /** Local image as a data URL / object URL — never leaves the browser. */
  backgroundImage?: string
  /** How the image is positioned within the canvas. */
  backgroundFit?: 'fill' | 'fit' | 'center'
  /** 0..20 px blur applied to the background layer. */
  blur: number
  /** 0..0.8 dark overlay opacity for node readability. */
  overlayOpacity: number
  /** Optional per-surface overrides (Space vs Growth vs Desktop). */
  space?: Partial<CanvasAppearance>
  growth?: Partial<CanvasAppearance>
  desktop?: Partial<CanvasAppearance>
}

export interface KnowledgeEdge {
  id: string
  from: string
  to: string
  kind: 'manual' | 'ai-auto'
  /** Why these two are related (shown in Explorer / insight, satisfies "explainable"). */
  reason?: string
}

/** Visual group on the canvas — like a m3e-canvas frame. `ai` clusters are created
 *  by the AI during a demo and carry a special marker + are removed on undo. */
export type ClusterKind = 'auto' | 'ai'
export interface Cluster {
  id: string
  title: string
  kind: ClusterKind
  memberIds: string[]
}

export type MemoryCategory = 'user' | 'project' | 'habit' | 'task'

export interface MemoryEntry {
  id: string
  category: MemoryCategory
  /** Localized memory text (zh-CN canonical source, en-US translation). */
  text: LocText
}

export interface KnowledgeBackend {
  listNodes(): Promise<KnowledgeNode[]>
  listEdges(): Promise<KnowledgeEdge[]>
  importSource(src: SourceRef): Promise<{ nodeId: string }>
  getNeighbors(
    nodeId: string,
    text: string,
  ): Promise<{ nodeId: string; score: number; reason: string }[]>
  getMemory(): Promise<MemoryEntry[]>
}

/** Camera transform for the infinite canvas (same model as m3e-canvas View). */
export interface ViewTransform {
  x: number
  y: number
  z: number
}

export interface AgentProfile {
  id: AgentId
  name: string
  role: string
  nameLoc?: LocText
  roleLoc?: LocText
  color: string
  /** Public URL of the mascot avatar PNG; undefined -> render a CSS placeholder. */
  avatarUrl?: string
}

export type AiState = 'idle' | 'inferring' | 'arrived' | 'clustering'

/** Stage machine for the visible AI reasoning flow (drives the stage banner + ring). */
export type AiStage =
  | 'import'
  | 'analyze'
  | 'scan'
  | 'relate'
  | 'map'
  | 'done'
  | null

export interface InsightMessage {
  tone: 'info' | 'success' | 'warn'
  text: string
}
