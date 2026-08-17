export const openapi = {
  openapi: '3.1.0', info: { title: 'ZhiLens Backend API', version: '0.1.0' },
  servers: [{ url: 'http://localhost:3001' }],
  paths: {
    '/health': { get: { summary: 'Liveness', responses: { '200': { description: 'Alive' } } } },
    '/ready': { get: { summary: 'Data readiness', responses: { '200': { description: 'Ready' }, '503': { description: 'Not ready' } } } },
    '/api/v1/meta': { get: { summary: 'Backend capabilities', responses: { '200': { description: 'Metadata' } } } },
    '/api/v1/openapi.json': { get: { summary: 'OpenAPI document', responses: { '200': { description: 'OpenAPI' } } } },
    '/api/v1/sources': { get: { summary: 'List canonical sources', parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', maximum: 100 } }, { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } }], responses: { '200': { description: 'Sources' } } } },
    '/api/v1/sources/{sourceId}': { get: { summary: 'Get source', parameters: [{ name: 'sourceId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Source' }, '404': { description: 'Not found' } } } },
    '/api/v1/search': { post: { summary: 'Official Zhihu search', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, count: { type: 'integer', maximum: 10 }, refresh: { type: 'boolean' } } } } } }, responses: { '200': { description: 'Normalized sources' }, '429': { description: 'Rate limited' } } } },
    '/api/v1/lens': { post: { summary: 'Discover discussion dimensions', responses: { '200': { description: 'DiscussionLens' }, '422': { description: 'Insufficient data' } } } },
    '/api/v1/reading-set': { post: { summary: 'Build A/B/C reading set', responses: { '200': { description: 'ReadingSet' }, '422': { description: 'Insufficient data' } } } },
    '/api/v1/render-packet': { post: { summary: 'Build closed-world frontend packet', responses: { '200': { description: 'RenderPacket' }, '422': { description: 'Insufficient data' } } } }
  }
} as const;
