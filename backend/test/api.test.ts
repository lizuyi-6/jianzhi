import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

test('health and metadata endpoints are stable', async () => {
  const app = await buildApp();
  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(health.statusCode, 200);
  assert.equal(health.json().ok, true);
  const meta = await app.inject({ method: 'GET', url: '/api/v1/meta' });
  assert.equal(meta.statusCode, 200);
  assert.equal(meta.json().schema_version, '0.1.0');
  await app.close();
});

test('local source endpoint enforces pagination and not-found state', async () => {
  const app = await buildApp();
  const list = await app.inject({ method: 'GET', url: '/api/v1/sources?limit=1' });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().sources.length, 1);
  const missing = await app.inject({ method: 'GET', url: '/api/v1/sources/no-such-source' });
  assert.equal(missing.statusCode, 404);
  await app.close();
});


test('readiness, OpenAPI and errors use stable envelopes', async () => {
  const app = await buildApp();
  const ready = await app.inject({ method: 'GET', url: '/ready' });
  assert.equal(ready.statusCode, 200);
  assert.equal(ready.json().ready, true);
  const docs = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
  assert.equal(docs.json().openapi, '3.1.0');
  const invalid = await app.inject({ method: 'POST', url: '/api/v1/lens', payload: {} });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error.code, 'INVALID_REQUEST');
  assert.ok(invalid.json().error.request_id);
  await app.close();
});
