const errorResponse = {
  type: 'object',
  required: ['error'],
  properties: { error: { type: 'object', required: ['code', 'message', 'request_id', 'retryable'], properties: { code: { type: 'string' }, message: { type: 'string' }, request_id: { type: 'string' }, retryable: { type: 'boolean' } } } },
} as const;

const evidenceSpan = {
  type: 'object',
  required: ['evidence_id', 'source_id', 'quote', 'start', 'end', 'field'],
  properties: {
    evidence_id: { type: 'string' }, source_id: { type: 'string' }, quote: { type: 'string' },
    start: { type: 'integer', minimum: 0 }, end: { type: 'integer', minimum: 1 }, field: { type: 'string' },
  },
} as const;

const discussionDimension = {
  type: 'object',
  required: ['id', 'label', 'semantic_family', 'observed_values', 'supporting_sources', 'counterexample_sources', 'user_answerable', 'support_examples'],
  properties: {
    id: { type: 'string' }, label: { type: 'string' }, semantic_family: { type: 'string' },
    observed_values: { type: 'array', minItems: 2, items: { type: 'string' } },
    supporting_sources: { type: 'array', items: { type: 'string' } },
    counterexample_sources: { type: 'array', items: { type: 'string' } },
    user_answerable: { type: 'boolean' },
    support_examples: {
      type: 'array',
      items: {
        type: 'object',
        required: ['source_id', 'value', 'decision', 'evidence_id', 'quote'],
        properties: { source_id: { type: 'string' }, value: { type: 'string' }, decision: { type: 'string' }, evidence_id: { type: 'string' }, quote: { type: 'string' } },
      },
    },
  },
} as const;

const discussionLens = {
  type: 'object',
  required: ['schema_version', 'question_key', 'dimensions'],
  properties: { schema_version: { type: 'string' }, question_key: { type: 'string' }, dimensions: { type: 'array', maxItems: 4, items: discussionDimension } },
} as const;

const readingSetSlot = {
  type: ['object', 'null'],
  required: ['role', 'source_id', 'why_read', 'evidence_ids'],
  properties: { role: { type: 'string', enum: ['COMPARABLE', 'COUNTER_EXPERIENCE', 'CLASSIC'] }, source_id: { type: 'string' }, why_read: { type: 'array', items: { type: 'string' } }, evidence_ids: { type: 'array', items: { type: 'string' } } },
} as const;

const renderCard = {
  type: 'object',
  required: ['role', 'source_id', 'title', 'url', 'same_dimensions', 'different_dimensions', 'unknown_dimensions', 'different_facts', 'quality_signals', 'why_read_codes', 'evidence'],
  properties: {
    role: { type: 'string', enum: ['COMPARABLE', 'COUNTER_EXPERIENCE', 'CLASSIC'] },
    source_id: { type: 'string' }, title: { type: 'string' }, url: { type: 'string', format: 'uri' },
    same_dimensions: { type: 'array', items: { type: 'string' } },
    different_dimensions: { type: 'array', items: { type: 'string' } },
    unknown_dimensions: { type: 'array', items: { type: 'string' } },
    different_facts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['dimension', 'user_value', 'source_value', 'evidence_id'],
        properties: { dimension: { type: 'string' }, user_value: { type: 'string' }, source_value: { type: 'string' }, evidence_id: { type: 'string' } },
      },
    },
    quality_signals: {
      type: 'object',
      required: ['vote_count', 'comment_count', 'authority'],
      properties: { vote_count: { type: ['integer', 'null'], minimum: 0 }, comment_count: { type: ['integer', 'null'], minimum: 0 }, authority: { type: ['string', 'integer', 'null'] } },
    },
    why_read_codes: { type: 'array', items: { type: 'string' } },
    evidence: { type: 'array', items: evidenceSpan },
  },
} as const;

const lensRequestBody = {
  required: true,
  content: { 'application/json': { schema: { type: 'object', required: ['question_key'], properties: { question_key: { type: 'string', examples: ['golden-cs-offer-work-or-grad'] }, source_ids: { type: 'array', items: { type: 'string' } } } } } },
} as const;

const readingRequestBody = {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object', required: ['question_key', 'values'],
        properties: {
          question_key: { type: 'string', examples: ['golden-cs-offer-work-or-grad'] },
          values: { type: 'object', additionalProperties: { type: 'string' }, examples: [{ current_opportunity: 'HAS_OFFER' }] },
          user_rejected_dimensions: { type: 'array', items: { type: 'string' } },
          custom_condition: { type: ['string', 'null'] },
          source_ids: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;

export const openapi = {
  openapi: '3.1.0', info: { title: 'ZhiLens Backend API', version: '0.1.0' },
  servers: [{ url: 'http://localhost:3001' }],
  paths: {
    '/health': { get: { summary: 'Liveness', responses: { '200': { description: 'Alive' } } } },
    '/ready': { get: { summary: 'Data readiness', responses: { '200': { description: 'Ready' }, '503': { description: 'Not ready', content: { 'application/json': { schema: errorResponse } } } } } },
    '/api/v1/meta': {
      get: {
        summary: 'Backend capabilities, corpus and pipeline status',
        responses: {
          '200': {
            description: 'Metadata',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    schema_version: { type: 'string' }, search_adapter: { type: 'boolean' }, source_count: { type: 'integer' },
                    lens: { type: 'object', properties: { experience_records: { type: 'integer' }, ready: { type: 'boolean' } } },
                    corpus: { type: 'object', properties: { questions: { type: 'array', items: { type: 'object' } } } },
                    pipeline: { type: 'object' },
                    capabilities: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/openapi.json': { get: { summary: 'OpenAPI document', responses: { '200': { description: 'OpenAPI' } } } },
    '/api/v1/sources': {
      get: {
        summary: 'List canonical sources',
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', maximum: 100 } }, { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } }],
        responses: { '200': { description: 'Sources' } },
      },
    },
    '/api/v1/sources/{sourceId}': { get: { summary: 'Get source (canonical or live-registered)', parameters: [{ name: 'sourceId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Source' }, '404': { description: 'Not found', content: { 'application/json': { schema: errorResponse } } } } } },
    '/api/v1/search': {
      post: {
        summary: 'Official Zhihu search (rate-limited, quota-guarded, local snapshot fallback)',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, count: { type: 'integer', maximum: 10 }, refresh: { type: 'boolean', description: 'Ignored unless server sets SEARCH_ALLOW_REFRESH=1' } } } } } },
        responses: {
          '200': { description: 'Normalized sources with mode: official_api_search | cache | local_fallback' },
          '429': { description: 'Rate limited', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/v1/lens': { post: { summary: 'Discover discussion dimensions from the question corpus', requestBody: lensRequestBody, responses: { '200': { description: 'DiscussionLens', content: { 'application/json': { schema: discussionLens } } }, '422': { description: 'Insufficient data', content: { 'application/json': { schema: errorResponse } } } } } },
    '/api/v1/reading-set': {
      post: {
        summary: 'Build A/B/C reading set',
        requestBody: readingRequestBody,
        responses: { '200': { description: 'ReadingSet', content: { 'application/json': { schema: { type: 'object', required: ['reading_set'], properties: { reading_set: { type: 'object', required: ['schema_version', 'question_key', 'slot_a', 'slot_b', 'slot_c', 'warnings'], properties: { schema_version: { type: 'string' }, question_key: { type: 'string' }, slot_a: readingSetSlot, slot_b: readingSetSlot, slot_c: readingSetSlot, warnings: { type: 'array', items: { type: 'string' } } } } } } } } }, '422': { description: 'Insufficient data', content: { 'application/json': { schema: errorResponse } } } },
      },
    },
    '/api/v1/render-packet': {
      post: {
        summary: 'Build closed-world frontend packet (cards carry evidence + quality signals)',
        requestBody: readingRequestBody,
        responses: { '200': { description: 'RenderPacket', content: { 'application/json': { schema: { type: 'object', required: ['render_packet'], properties: { render_packet: { type: 'object', required: ['schema_version', 'question_key', 'lens', 'cards', 'empty_slots', 'warnings'], properties: { schema_version: { type: 'string' }, question_key: { type: 'string' }, lens: discussionLens, cards: { type: 'array', items: renderCard }, empty_slots: { type: 'array', items: { type: 'string' } }, warnings: { type: 'array', items: { type: 'string' } } } } } } } } }, '422': { description: 'Insufficient data', content: { 'application/json': { schema: errorResponse } } } },
      },
    },
    '/api/v1/events': { post: { summary: 'Product analytics events (lens_open, context_submit, ...)', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['event'], properties: { event: { type: 'string', enum: ['lens_open', 'context_submit', 'reading_set_generated', 'evidence_open', 'source_open'] }, payload: { type: 'object' } } } } } }, responses: { '202': { description: 'Accepted' } } } },
  },
} as const;
