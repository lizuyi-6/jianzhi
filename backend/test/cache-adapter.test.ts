import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileCache, stableCacheKey } from '../src/core/cache.js';
import { ZhihuSearchAdapter } from '../src/adapters/zhihu-search.js';

test('cache keys are stable across object key order', () => {
  assert.equal(stableCacheKey('x', { b: 2, a: 1 }), stableCacheKey('x', { a: 1, b: 2 }));
});

test('file cache round-trips JSON atomically', async () => {
  const root = await mkdtemp(join(tmpdir(), 'zhilens-cache-'));
  try {
    const cache = new FileCache(root);
    await cache.set('test:key', { ok: true, value: 3 });
    assert.deepEqual(await cache.get('test:key'), { ok: true, value: 3 });
    assert.equal(await cache.get('missing'), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Zhihu adapter maps official PascalCase response', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ Code: 0, Message: 'success', Data: { HasMore: false, Items: [{ Title: 'Q', ContentType: 'Answer', ContentID: 7, ContentText: 'text', Url: 'https://www.zhihu.com/a/7', VoteUpCount: 2, CommentCount: 1, AuthorName: 'A', AuthorityLevel: '3', RankingScore: 1.2 }] } }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  try {
    const result = await new ZhihuSearchAdapter('test-secret').search({ query: 'q', count: 1 });
    assert.equal(result.sources[0]?.source_id, '7');
    assert.equal(result.sources[0]?.source_mode, 'official_api_search');
    assert.equal(result.has_more, false);
  } finally { globalThis.fetch = original; }
});
