import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

test('canonical Golden data produces grounded A/B/C RenderPacket', async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({ method: 'POST', url: '/api/v1/render-packet', payload: { question_key: 'golden-read-work', values: { family_pressure: 'FAMILY_PRESSURE' } } });
    assert.equal(response.statusCode, 200);
    const packet = response.json().render_packet;
    assert.deepEqual(packet.cards.map((card: { role: string }) => card.role), ['COMPARABLE', 'COUNTER_EXPERIENCE', 'CLASSIC']);
    assert.equal(packet.empty_slots.length, 0);
    assert.equal(packet.warnings.length, 0);
    assert.ok(packet.cards.every((card: { evidence: unknown[] }) => card.evidence.length > 0));
  } finally { await app.close(); }
});
