// Ingestion Layer — the seam that turns a `SourceRef` into normalized text that
// the LightRAG backend can ingest (Stage 8, focus 2/3).
//
// Layering (Mini Plan §4.1):
//   Ingestion Layer (SourceRef → text)  →  LightRAGClient  →  LightRAGBackend
//
// This module is the ONLY place that knows about per-source fetching. It NEVER
// imports `KnowledgeBackend`, the LightRAG client, the UI, or the Employee model.
// Scrapling (the `url` adapter) lives in a sibling file and is gated by a feature
// flag — it cannot reach the core knowledge model (D4 hard line).
//
// D3 (two-phase): Phase 1 = TS ingestion seam + mock connectors (this file).
// Phase 2 = Python ingestion sidecar (real Scrapling/PDF/GitHub). We do NOT put
// the Python pipeline in this frontend repo now.

import type { SourceRef, AgentId } from '../../types'
import { isScrapingEnabled } from '../backends/lightragConfig'
import { ScraplingUrlAdapter } from './scraplingAdapter'

/** Normalized document produced by an ingestion component. */
export interface IngestedDocument {
  content: string
  meta: {
    sourceRef: SourceRef
    ownerAgent?: AgentId
    fetchedAt: number
  }
}

/** A component that can fetch + normalize one `SourceRef` type into text. */
export interface IngestionComponent {
  readonly type: SourceRef['type']
  fetch(src: SourceRef, opts?: { ownerAgent?: AgentId }): Promise<IngestedDocument>
}

/** Minimal placeholder used for source types not yet implemented in Phase 1.
 *  It validates the seam without performing real extraction. */
class PlaceholderIngestion implements IngestionComponent {
  constructor(public readonly type: SourceRef['type']) {}
  async fetch(src: SourceRef, opts?: { ownerAgent?: AgentId }): Promise<IngestedDocument> {
    return {
      content: `[${this.type} placeholder] uri=${src.uri}`,
      meta: { sourceRef: src, ownerAgent: opts?.ownerAgent, fetchedAt: Date.now() },
    }
  }
}

/** `chat` is already text — pass it through untouched. */
class ChatIngestion implements IngestionComponent {
  readonly type: SourceRef['type'] = 'chat'
  async fetch(src: SourceRef, opts?: { ownerAgent?: AgentId }): Promise<IngestedDocument> {
    return {
      content: src.uri,
      meta: { sourceRef: src, ownerAgent: opts?.ownerAgent, fetchedAt: Date.now() },
    }
  }
}

// Registry: type → component. `url` resolves to Scrapling ONLY when the feature
// flag is on; otherwise it falls back to the placeholder so the seam stays
// functional without enabling external web fetching (D4).
const urlAdapter = new ScraplingUrlAdapter()
const registry: Record<SourceRef['type'], IngestionComponent> = {
  chat: new ChatIngestion(),
  url: urlAdapter,
  pdf: new PlaceholderIngestion('pdf'),
  video: new PlaceholderIngestion('video'),
  github: new PlaceholderIngestion('github'),
}

/** Resolve the ingestion component for a source type, honoring the Scrapling gate. */
export function getIngestionComponent(type: SourceRef['type']): IngestionComponent {
  if (type === 'url' && !isScrapingEnabled()) {
    return new PlaceholderIngestion('url')
  }
  return registry[type]
}

/** Ingest a `SourceRef` into normalized text via the ingestion layer. */
export async function ingestSource(
  src: SourceRef,
  opts?: { ownerAgent?: AgentId },
): Promise<IngestedDocument> {
  const component = getIngestionComponent(src.type)
  return component.fetch(src, opts)
}
