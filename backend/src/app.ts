import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { appendFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { FileCache } from './core/cache.js';
import { ExperienceStore } from './core/experience-store.js';
import { loadQuestionCorpus } from './core/question-corpus.js';
import { ZhihuSearchAdapter } from './adapters/zhihu-search.js';
import { SourceService } from './services/source-service.js';
import { LensService } from './services/lens-service.js';
import { openapi } from './openapi.js';
import { env, parseCorsOrigin } from './config.js';
import { DailyBudget, SlidingWindowRateLimiter } from './rate-limit.js';

type Services = { source: SourceService; lens: LensService };
type AppOptions = { logger?: boolean | { level: string } };

export async function createServices(): Promise<Services> {
  const dataDir = resolve(process.cwd(), env.DATA_DIR);
  const cache = new FileCache(resolve(process.cwd(), '.cache'));
  const source = new SourceService(cache, env.ZHIHU_ACCESS_SECRET ? new ZhihuSearchAdapter(env.ZHIHU_ACCESS_SECRET) : undefined, dataDir);
  const sources = await source.allLocal();
  const store = await ExperienceStore.load(resolve(dataDir, 'experience-records.jsonl'), sources);
  const corpus = await loadQuestionCorpus(resolve(dataDir, 'question-corpus.json'));
  return { source, lens: new LensService(store, sources, corpus) };
}

type ErrorMapping = { status: number; code: string; message: string; retryable: boolean };
function mapError(error: unknown): ErrorMapping {
  if (error instanceof z.ZodError) return { status: 400, code: 'INVALID_REQUEST', message: 'Request validation failed', retryable: false };
  const value = String(error);
  if (value.includes('NO_USABLE_EXPERIENCE')) return { status: 422, code: 'NO_USABLE_EXPERIENCE', message: 'No validated experience records are available', retryable: false };
  if (value.includes('NO_RELIABLE_DIMENSION')) return { status: 422, code: 'NO_RELIABLE_DIMENSION', message: 'No reliable discussion dimension was found', retryable: false };
  if (value.includes('CORPUS_INCOMPLETE')) return { status: 422, code: 'CORPUS_INCOMPLETE', message: 'Question corpus references missing records', retryable: false };
  if (value.includes('INVALID_EVIDENCE') || value.includes('INVALID_EXPERIENCE_RECORD')) return { status: 422, code: 'INVALID_EVIDENCE', message: 'Evidence validation failed', retryable: false };
  if (value.includes('RENDER_PACKET_INVALID')) return { status: 500, code: 'RENDER_PACKET_INVALID', message: 'Render packet invariant violated', retryable: false };
  if (value.includes('RATE_LIMITED')) return { status: 429, code: 'RATE_LIMITED', message: 'Upstream rate limit reached', retryable: true };
  if (value.includes('AUTH_FAILED')) return { status: 401, code: 'AUTH_FAILED', message: 'Upstream authentication failed', retryable: false };
  if (value.includes('SEARCH_ADAPTER_NOT_CONFIGURED')) return { status: 503, code: 'SEARCH_UNAVAILABLE', message: 'Official search is not configured', retryable: false };
  if (value.includes('ZHIHU_HTTP_') || value.includes('UPSTREAM_TIMEOUT')) return { status: 502, code: 'UPSTREAM_FAILED', message: 'Upstream request failed', retryable: true };
  return { status: 500, code: 'INTERNAL_ERROR', message: 'Internal server error', retryable: false };
}
function sendError(reply: FastifyReply, request: FastifyRequest, mapped: ErrorMapping) {
  return reply.code(mapped.status).send({ error: { code: mapped.code, message: mapped.message, request_id: request.id, retryable: mapped.retryable } });
}

export async function buildApp(services?: Services, options: AppOptions = {}): Promise<FastifyInstance> {
  const active = services ?? await createServices();
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 1_048_576 });
  // P0-10：生产环境 strict CORS（parseCorsOrigin 在生产 + 通配时直接抛错，启动即失败）
  await app.register(cors, { origin: parseCorsOrigin(env.CORS_ORIGIN) });

  // P0-10：搜索配额三道闸——IP 限流、每日预算、禁客户端 refresh
  const searchLimiter = new SlidingWindowRateLimiter(60_000, env.SEARCH_RATE_LIMIT_PER_MIN);
  const searchBudget = new DailyBudget(env.SEARCH_DAILY_BUDGET);

  const listQuery = z.object({ limit: z.coerce.number().int().positive().max(100).default(50), offset: z.coerce.number().int().nonnegative().default(0) });
  const searchBody = z.object({ query: z.string().trim().min(1).max(200), count: z.number().int().positive().max(10).default(10), refresh: z.boolean().default(false) });
  const lensBody = z.object({ question_key: z.string().min(1).max(200), source_ids: z.array(z.string()).max(200).optional() });
  const readingBody = lensBody.extend({ values: z.record(z.string()), user_rejected_dimensions: z.array(z.string()).default([]), custom_condition: z.string().max(500).nullable().default(null) });
  const eventBody = z.object({ event: z.enum(['lens_open', 'context_submit', 'reading_set_generated', 'evidence_open', 'source_open']), payload: z.record(z.string(), z.unknown()).default({}) });

  app.setErrorHandler((error, request, reply) => { const mapped = mapError(error); request.log.error({ err: error, code: mapped.code }, 'request failed'); return sendError(reply, request, mapped); });
  app.setNotFoundHandler((request, reply) => sendError(reply, request, { status: 404, code: 'ROUTE_NOT_FOUND', message: 'Route not found', retryable: false }));
  app.addHook('onResponse', async (request, reply) => { request.log.info({ request_id: request.id, method: request.method, path: request.url, status_code: reply.statusCode, response_ms: reply.elapsedTime }, 'request completed'); });

  app.get('/health', async () => ({ ok: true, service: 'zhilens-backend', version: '0.1.0' }));
  app.get('/ready', async (request, reply) => { const status = active.lens.status(); if (!status.ready) return sendError(reply, request, { status: 503, code: 'NOT_READY', message: 'Validated experience records are unavailable', retryable: false }); return status; });
  app.get('/api/v1/openapi.json', async () => openapi);
  app.get('/api/v1/meta', async () => ({
    schema_version: '0.1.0',
    search_adapter: Boolean(env.ZHIHU_ACCESS_SECRET),
    source_count: (await active.source.allLocal()).length,
    lens: active.lens.status(),
    corpus: active.lens.corpusStatus(),
    pipeline: { extraction_prompt_version: 'llm1-v2', replay_cache: 'data/extraction-cache.jsonl', live_model: Boolean(env.MODEL_BASE_URL && env.MODEL_API_KEY && env.MODEL_NAME) },
    capabilities: ['source_list', 'source_search', 'evidence_contract', 'discussion_lens', 'reading_set', 'render_packet', 'extraction_pipeline', 'events'],
  }));
  app.get('/api/v1/sources', async (request) => { const query = listQuery.parse(request.query); return { sources: await active.source.listLocal(query.limit, query.offset), limit: query.limit, offset: query.offset, total: (await active.source.allLocal()).length }; });
  app.get('/api/v1/sources/:sourceId', async (request, reply) => {
    const source = await active.source.get((request.params as { sourceId: string }).sourceId);
    if (!source) return sendError(reply, request, { status: 404, code: 'SOURCE_NOT_FOUND', message: 'Source not found', retryable: false });
    return { source };
  });

  app.post('/api/v1/search', async (request, reply) => {
    const body = searchBody.parse(request.body);
    const ip = request.ip;
    const limit = searchLimiter.check('ip:' + ip);
    if (!limit.allowed) {
      reply.header('retry-after', Math.ceil(limit.retryAfterMs / 1000));
      return sendError(reply, request, { status: 429, code: 'RATE_LIMITED', message: 'Too many search requests', retryable: true });
    }
    // refresh 只允许服务端运维显式开启，客户端传了也忽略（P0-10）
    const refresh = env.SEARCH_ALLOW_REFRESH === '1' && body.refresh;
    if (!refresh && searchBudget.remaining() <= 0) {
      const fallback = await active.source.localFallbackSearch(body.query, body.count);
      return { ...fallback, degraded_reason: 'DAILY_BUDGET_EXHAUSTED' };
    }
    const result = await active.source.search(body.query, body.count, refresh);
    if (result.mode === 'official_api_search') searchBudget.spend();
    return result;
  });

  app.post('/api/v1/lens', async (request) => { const body = lensBody.parse(request.body); return { lens: active.lens.buildLens(body.question_key, body.source_ids) }; });
  app.post('/api/v1/reading-set', async (request) => { const body = readingBody.parse(request.body); return { reading_set: active.lens.buildReadingSet(body.question_key, body.values, body.user_rejected_dimensions, body.custom_condition, body.source_ids) }; });
  app.post('/api/v1/render-packet', async (request) => { const body = readingBody.parse(request.body); return { render_packet: active.lens.buildRenderPacket(body.question_key, body.values, body.user_rejected_dimensions, body.custom_condition, body.source_ids) }; });

  // P2-10：PRD 埋点落点（追加写 jsonl，供赛后复盘演示漏斗）
  const eventsFile = resolve(process.cwd(), '.cache', 'events.jsonl');
  app.post('/api/v1/events', async (request, reply) => {
    const body = eventBody.parse(request.body);
    await mkdir(resolve(process.cwd(), '.cache'), { recursive: true });
    await appendFile(eventsFile, JSON.stringify({ event: body.event, payload: body.payload, request_id: request.id, at: new Date().toISOString() }) + '\n', 'utf8');
    return reply.code(202).send({ accepted: true });
  });

  return app;
}
