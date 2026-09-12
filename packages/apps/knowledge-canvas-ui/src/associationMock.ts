// P2 mock association data — strictly a data contract for the explainer.
//
// IMPORTANT (frozen scope):
//  - No graph algorithm, no embedding, no real knowledge graph here.
//  - `reasonKey` points at the ALREADY-EXISTING `edge.*` i18n keys (authored for
//    the Galaxy edges), so the explainer reuses the same localization the product
//    uses. `confidence`/`relationship` are mock values surfaced by MockBackend.
//  - This file is an inert data module; it never imports React or the canvas store.

import type { NodeKind, RelationType } from './types'
import type { LocText } from './i18n/types'

/** A minimal knowledge unit shown inside the explainer (no canvas node needed). */
export interface MiniNode {
  title: string
  kind: NodeKind
  /** Bilingual title; UI language overrides the base `title`. */
  titleLoc?: LocText
}

/** One explainable AI association between two knowledge units. */
export interface Association {
  id: string
  source: MiniNode
  target: MiniNode
  relationship: RelationType
  /** Mock confidence 0..1 (would come from a real scorer in production). */
  confidence: number
  /** i18n key already present in zh-CN / en-US (an existing `edge.*` reason). */
  reasonKey: string
}

export const SAMPLE_ASSOCIATIONS: Association[] = [
  {
    id: 'a-llm-memory',
    source: { title: 'LLM 基础', kind: 'concept', titleLoc: { 'en-US': 'LLM Basics' } },
    target: { title: 'Memory Architecture', kind: 'concept', titleLoc: { 'en-US': 'Memory Architecture' } },
    relationship: 'prerequisite',
    confidence: 0.8,
    reasonKey: 'edge.rel8',
  },
  {
    id: 'a-spec-launch',
    source: { title: '产品需求文档 v2', kind: 'document', titleLoc: { 'en-US': 'Product Spec v2' } },
    target: { title: 'Q3 发布项目', kind: 'project', titleLoc: { 'en-US': 'Q3 Launch Project' } },
    relationship: 'related',
    confidence: 0.7,
    reasonKey: 'edge.rel1',
  },
  {
    id: 'a-rag-memory',
    source: { title: 'RAG', kind: 'skill', titleLoc: { 'en-US': 'RAG' } },
    target: { title: 'Memory Architecture', kind: 'concept', titleLoc: { 'en-US': 'Memory Architecture' } },
    relationship: 'partOf',
    confidence: 0.9,
    reasonKey: 'edge.rel11',
  },
]
