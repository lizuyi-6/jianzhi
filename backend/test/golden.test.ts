import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { GOLDEN_QUESTION_KEY } from '../src/scripts/golden-corpus.js';

const BASE = { question_key: GOLDEN_QUESTION_KEY };

test('golden corpus passes evidence validation and yields grounded lens', async () => {
  const app = await buildApp();
  try {
    const meta = await app.inject({ method: 'GET', url: '/api/v1/meta' });
    assert.equal(meta.statusCode, 200);
    assert.ok(meta.json().lens.experience_records >= 10, 'golden corpus should hold 10+ records');

    const lensResponse = await app.inject({ method: 'POST', url: '/api/v1/lens', payload: BASE });
    assert.equal(lensResponse.statusCode, 200);
    const lens = lensResponse.json().lens;
    assert.ok(lens.dimensions.length >= 3, 'expect >=3 reliable dimensions');
    // P0-02：单值维度（如经济压力）不允许再成为分歧条件
    for (const dimension of lens.dimensions) {
      assert.ok(dimension.observed_values.length >= 2, dimension.id + ' must have >=2 observed values');
      assert.ok(dimension.support_examples.length >= 2, dimension.id + ' must expose cross-stance evidence');
      const decisions = new Set(dimension.support_examples.map((example: { decision: string }) => example.decision));
      assert.ok(decisions.size >= 2, dimension.id + ' support examples must cross stances');
    }
    const dimensionIds = lens.dimensions.map((dimension: { id: string }) => dimension.id);
    assert.ok(!dimensionIds.includes('family_financial_pressure'), 'single-value dimension must be excluded');
  } finally { await app.close(); }
});

test('golden RenderPacket is complete and every why is evidence-backed', async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({ method: 'POST', url: '/api/v1/render-packet', payload: { ...BASE, values: { current_opportunity: 'HAS_OFFER', study_motivation: 'PRACTICAL_FIRST' } } });
    assert.equal(response.statusCode, 200);
    const packet = response.json().render_packet;
    assert.deepEqual(packet.cards.map((card: { role: string }) => card.role), ['COMPARABLE', 'COUNTER_EXPERIENCE', 'CLASSIC']);
    assert.equal(packet.empty_slots.length, 0);
    assert.equal(packet.warnings.length, 0);
    for (const card of packet.cards) {
      assert.ok(card.evidence.length > 0);
      // P1-08：差异必须双边可见
      for (const fact of card.different_facts) assert.ok(fact.user_value && fact.source_value);
      // P1-09：公共质量信号必须随卡下发
      assert.ok(card.quality_signals && 'vote_count' in card.quality_signals);
    }
  } finally { await app.close(); }
});

// P0-08：修改条件后 ReadingSet 必须真实变化，且能解释变化
test('changing conditions changes at least one slot (demo moment)', async () => {
  const app = await buildApp();
  try {
    const before = await app.inject({ method: 'POST', url: '/api/v1/reading-set', payload: { ...BASE, values: { current_opportunity: 'HAS_OFFER', study_motivation: 'PRACTICAL_FIRST' } } });
    const after = await app.inject({ method: 'POST', url: '/api/v1/reading-set', payload: { ...BASE, values: { current_opportunity: 'HAS_OFFER', study_motivation: 'PRACTICAL_FIRST', exam_outcome: 'EXAM_FAILED' } } });
    assert.equal(before.statusCode, 200);
    assert.equal(after.statusCode, 200);
    const roles: Array<[string, string | null]> = [['slot_a', before.json().reading_set.slot_a?.source_id ?? null], ['slot_b', before.json().reading_set.slot_b?.source_id ?? null], ['slot_c', before.json().reading_set.slot_c?.source_id ?? null]];
    const changed = roles.filter(([role, sourceId]) => sourceId !== null && sourceId !== (after.json().reading_set as Record<string, { source_id?: string }>)[role]?.source_id);
    assert.ok(changed.length >= 1, 'at least one slot must change after condition edit');
  } finally { await app.close(); }
});

test('uncovered user values warn instead of silently becoming differences', async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({ method: 'POST', url: '/api/v1/reading-set', payload: { ...BASE, values: { current_opportunity: 'HAS_OFFER', career_goal: 'ENGINEERING' } } });
    assert.equal(response.statusCode, 200);
    assert.ok(response.json().reading_set.warnings.includes('USER_CONDITION_UNCOVERED'));
  } finally { await app.close(); }
});
