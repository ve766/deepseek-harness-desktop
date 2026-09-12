/**
 * Knowledge tools for the AI Knowledge Agent.
 *
 * Four model-facing tools backed by the {@link KnowledgeService} Remote:
 * `import_document`, `save_knowledge`, `search_knowledge`, `query_knowledge`.
 * Each tool closes over the host `ctx` and calls `ctx.knowledge.*`, so the
 * browser client and the in-session agent share the same implementation.
 *
 * @module @deepseek-ai/dsh-knowledge-tools
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-knowledge-indexer'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'knowledge-tools'
export const inject = ['tools', 'knowledge']

/** No deployment-varying configuration; presence in the bundle enables the tools. */
export const Config = undefined

/**
 * Register the knowledge tools on `ctx.tools`.
 * @param ctx - registrant context carrying tools and the knowledge service.
 */
export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'import_document',
    description:
      'Import a document into your personal knowledge base. Use for Markdown or plain-text sources '
      + '(notes, articles, transcripts). The system parses it and stores it for later search and Q&A.',
    parameters: {
      source: {
        type: 'string',
        description: 'Origin locator (file path or URL). Omit for manual input.',
      },
      raw: {
        type: 'string',
        required: true,
        description: 'Raw document text to ingest.',
      },
      kind: {
        type: 'string',
        required: true,
        enum: ['markdown', 'text'],
        description: 'How to interpret `raw`: `markdown` parses frontmatter, `text` treats it as plain notes.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', required: true },
          title: { type: 'string', required: true },
          tags: { type: 'array', required: true, items: { type: 'string' } },
        },
      },
      render: (_args, value: { id: string, title: string, tags: string[] }) => [{
        type: 'text',
        text: `Imported "${value.title}" (${value.tags.length} tags) as ${value.id}.`,
      }],
    },
    async execute(args: { source?: string, raw: string, kind: 'markdown' | 'text' }, _exec) {
      const request = {
        raw: args.raw,
        kind: args.kind,
        ...(args.source === undefined ? {} : { source: args.source }),
      }
      const item = await ctx.knowledge.import(request)
      return { id: item.id, title: item.title, tags: item.tags }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'save_knowledge',
    description:
      'Save a structured note into your personal knowledge base directly (the model supplies the '
      + 'title, content, and optional tags/category). Use when the content is already extracted.',
    parameters: {
      title: { type: 'string', required: true, description:    'Title of the note.' },
      content: { type: 'string', required: true, description: 'Body of the note (Markdown).' },
      source: { type: 'string', description: 'Origin locator; defaults to `manual`.' },
      category: { type: 'string', description: 'Coarse topic bucket.' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Topical labels.' },
      summary: { type: 'string', description: 'One-paragraph summary.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', required: true },
          title: { type: 'string', required: true },
        },
      },
      render: (_args, value: { id: string, title: string }) => [{
        type: 'text',
        text: `Saved "${value.title}" (${value.id}).`,
      }],
    },
    async execute(args: {
      title: string
      content: string
      source?: string
      category?: string
      tags?: string[]
      summary?: string
    }, _exec) {
      const item = await ctx.knowledge.save({
        title: args.title,
        content: args.content,
        source: args.source ?? null,
        category: args.category ?? null,
        tags: args.tags ?? [],
        summary: args.summary ?? null,
        metadata: {},
      })
      return { id: item.id, title: item.title }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'search_knowledge',
    description:
      'Full-text search across your personal knowledge base. Returns the most relevant notes for a '
      + 'query, optionally filtered by tags.',
    parameters: {
      text: { type: 'string', required: true, description: 'Free-text search terms.' },
      limit: { type: 'integer', description: 'Max results (default 20).' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Optional tag filter.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          total: { type: 'integer', required: true },
          items: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                title: { type: 'string', required: true },
                summary: { type: 'string' },
              },
            },
          },
        },
      },
      render: (_args, value: { total: number, items: { id: string, title: string, summary?: string }[] }) => [{
        type: 'text',
        text: value.items.length > 0
          ? `Found ${value.total} match(es): ${value.items.map(i => i.title).join(', ')}`
          : 'No matching knowledge found.',
      }],
    },
    async execute(args: { text: string, limit?: number, tags?: string[] }, _exec) {
      const query = {
        text: args.text,
        ...(args.limit === undefined ? {} : { limit: args.limit }),
        ...(args.tags === undefined ? {} : { tags: args.tags }),
      }
      const result = await ctx.knowledge.search(query)
      return {
        total: result.total,
        items: result.items.map((i: { id: string, title: string, summary: string | null }) => ({
          id: i.id,
          title: i.title,
          summary: i.summary ?? '',
        })),
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'query_knowledge',
    description:
      'Answer a question using your personal knowledge base (retrieval-augmented). Returns a '
      + 'synthesized answer grounded on the most relevant notes.',
    parameters: {
      question: { type: 'string', required: true, description: 'The question to answer.' },
      limit: { type: 'integer', description: 'Recall window size (default 5).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          answer: { type: 'string', required: true },
          sources: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                title: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value: { answer: string, sources: { id: string, title: string }[] }) => [{
        type: 'text',
        text: value.answer,
      }],
    },
    async execute(args: { question: string, limit?: number }, _exec) {
      const req = args.limit === undefined
        ? { question: args.question }
        : { question: args.question, limit: args.limit }
      const result = await ctx.knowledge.query(req)
      return {
        answer: result.answer,
        sources: result.sources.map((s: { id: string, title: string }) => ({ id: s.id, title: s.title })),
      }
    },
  }))
}

export default { name, inject, apply }
