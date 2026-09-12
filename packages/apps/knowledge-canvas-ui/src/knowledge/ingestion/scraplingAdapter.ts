// Scrapling URL-ingestion adapter — Phase 1 PLACEHOLDER (Stage 8, D4).
//
// HARD BOUNDARY (D4): this adapter lives ONLY in the ingestion layer. It MUST NOT
// import `KnowledgeBackend`, the LightRAG client, any UI component, the Employee
// model, or create an independent knowledge base. Its sole job is to turn a `url`
// SourceRef into normalized text for `importSource()`.
//
// In Phase 1 this is a placeholder: it validates the seam but does NOT perform
// real web scraping (the Scrapling engine runs in the Phase 2 Python sidecar).
// The feature flag (default OFF) is the master gate — when off, `ingestion.ts`
// routes `url` to the generic placeholder instead, so this code path is dormant.

import type { SourceRef, AgentId } from '../../types'
import type { IngestionComponent, IngestedDocument } from './ingestion'
import { isScrapingEnabled } from '../backends/lightragConfig'

export class ScrapingDisabledError extends Error {
  constructor() {
    super('Scrapling ingestion is disabled (Phase 1 placeholder; enable via feature flag for Phase 2 sidecar).')
    this.name = 'ScrapingDisabledError'
  }
}

export class ScraplingUrlAdapter implements IngestionComponent {
  readonly type: SourceRef['type'] = 'url'

  async fetch(src: SourceRef, opts?: { ownerAgent?: AgentId }): Promise<IngestedDocument> {
    if (!isScrapingEnabled()) {
      throw new ScrapingDisabledError()
    }
    // Phase 2: delegate to the Python `knowledge-ingest` sidecar which runs
    // Scrapling (`scrapling extract/fetch`) and returns normalized markdown.
    // In Phase 1 we return a clearly-marked placeholder so the seam is excercisable
    // without an external network call.
    return {
      content: `[scrapling placeholder] url=${src.uri} (Phase 2 sidecar will extract real content)`,
      meta: { sourceRef: src, ownerAgent: opts?.ownerAgent, fetchedAt: Date.now() },
    }
  }
}
