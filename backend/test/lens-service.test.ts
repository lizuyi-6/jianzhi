import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { schemaVersion, ExperienceRecord, SourceDocument } from '../src/core/contracts.js';
import { ExperienceStore } from '../src/core/experience-store.js';
import { discoverDiscussionLens } from '../src/core/contrast.js';
import { LensService } from '../src/services/lens-service.js';
import { SourceService } from '../src/services/source-service.js';
import { FileCache } from '../src/core/cache.js';
import { buildApp } from '../src/app.js';

const texts: Record<string, string> = { a: '目标工程开发，已有满意Offer，最后选择工作。', b: '目标工程开发，已有满意Offer，最后选择读研。', c: '目标算法研究，目前没有Offer，最后选择读研。' };
const span = (sourceId: string, id: string, quote: string, field: string) => ({ evidence_id: id, source_id: sourceId, quote, start: texts[sourceId]!.indexOf(quote), end: texts[sourceId]!.indexOf(quote) + quote.length, field });
const record = (id: string, goal: string, opportunity: string, decision: 'WORK' | 'GRAD_SCHOOL'): ExperienceRecord => ({ schema_version: schemaVersion, source_id: id, knowledge_types: ['EXPERIENCE'], decision: { value: decision, evidence: span(id, id + ':d', decision === 'WORK' ? '选择工作' : '选择读研', 'decision') }, pre_decision_context: [{ dimension_id: 'career_goal', semantic_family: 'GOAL', value: goal, evidence: span(id, id + ':g', goal === 'ENGINEERING' ? '工程开发' : '算法研究', 'career_goal') }, { dimension_id: 'current_opportunity', semantic_family: 'OPPORTUNITY', value: opportunity, evidence: span(id, id + ':o', opportunity === 'HAS_OFFER' ? '已有满意Offer' : '没有Offer', 'current_opportunity') }], outcomes: [], reflection: null, unknown_dimensions: [] });
const records = [record('a', 'ENGINEERING', 'HAS_OFFER', 'WORK'), record('b', 'ENGINEERING', 'HAS_OFFER', 'GRAD_SCHOOL'), record('c', 'RESEARCH', 'NO_OFFER', 'GRAD_SCHOOL')];
const sources: SourceDocument[] = records.map((item, index) => ({ source_id: item.source_id, source_type: 'answer', question_title: '读研还是工作', author: {}, text: texts[item.source_id]!, url: 'https://example.com/' + item.source_id, platform_signals: { authority: 3, vote_count: 10 - index }, source_mode: 'fixture' }));

async function storeFor(input = records) { const dir = await mkdtemp(join(tmpdir(), 'zhilens-records-')); const path = join(dir, 'records.jsonl'); await writeFile(path, input.map((item) => JSON.stringify(item)).join('\n')); return { dir, store: await ExperienceStore.load(path, sources) }; }

test('record store validates evidence and contrast discovers grounded dimensions', async () => {
  const { dir, store } = await storeFor();
  try { const lens = discoverDiscussionLens('q1', store.all()); assert.ok(lens.dimensions.some((item) => item.id === 'career_goal')); assert.ok(lens.dimensions.some((item) => item.id === 'current_opportunity')); }
  finally { await rm(dir, { recursive: true, force: true }); }
});

test('record store rejects quote mismatch', async () => {
  const bad = structuredClone(records[0]!); bad.decision!.evidence.quote = '不存在';
  await assert.rejects(() => storeFor([bad]), /INVALID_EVIDENCE/);
});

test('lens and reading-set APIs run from validated records', async () => {
  const { dir, store } = await storeFor(); const cacheDir = await mkdtemp(join(tmpdir(), 'zhilens-service-'));
  const source = new SourceService(new FileCache(cacheDir)); const lens = new LensService(store, sources); const app = await buildApp({ source, lens });
  try {
    const lensResponse = await app.inject({ method: 'POST', url: '/api/v1/lens', payload: { question_key: 'q1' } }); assert.equal(lensResponse.statusCode, 200); assert.ok(lensResponse.json().lens.dimensions.length >= 1);
    const reading = await app.inject({ method: 'POST', url: '/api/v1/reading-set', payload: { question_key: 'q1', values: { career_goal: 'ENGINEERING', current_opportunity: 'HAS_OFFER' } } }); assert.equal(reading.statusCode, 200); assert.ok(reading.json().reading_set.slot_a); assert.ok(reading.json().reading_set.slot_b);
  } finally { await app.close(); await rm(dir, { recursive: true, force: true }); await rm(cacheDir, { recursive: true, force: true }); }
});

test('empty record store fails closed', async () => {
  const { dir, store } = await storeFor([]); const cacheDir = await mkdtemp(join(tmpdir(), 'zhilens-empty-')); const app = await buildApp({ source: new SourceService(new FileCache(cacheDir)), lens: new LensService(store, sources) });
  try { const response = await app.inject({ method: 'POST', url: '/api/v1/lens', payload: { question_key: 'q1' } }); assert.equal(response.statusCode, 422); assert.equal(response.json().error.code, 'NO_USABLE_EXPERIENCE'); assert.ok(response.json().error.request_id); }
  finally { await app.close(); await rm(dir, { recursive: true, force: true }); await rm(cacheDir, { recursive: true, force: true }); }
});
