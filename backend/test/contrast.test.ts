import test from 'node:test';
import assert from 'node:assert/strict';
import { schemaVersion, ExperienceRecord } from '../src/core/contracts.js';
import { computeDimensionCandidates, discoverDiscussionLens } from '../src/core/contrast.js';

const text = '目标工程，已有Offer，最后选择工作。';
const span = (id: string, quote: string, field: string) => ({ evidence_id: id + ':' + field, source_id: id, quote, start: text.indexOf(quote), end: text.indexOf(quote) + quote.length, field });
const record = (id: string, decisionValue: 'WORK' | 'GRAD_SCHOOL' | 'CONDITIONAL' | null, facts: Array<[string, string]>, decisionQuote: string): ExperienceRecord => ({
  schema_version: schemaVersion,
  source_id: id,
  knowledge_types: ['EXPERIENCE'],
  decision: decisionValue ? { value: decisionValue, evidence: span(id, decisionQuote, 'decision') } : null,
  pre_decision_context: facts.map(([dimensionId, value]) => ({ dimension_id: dimensionId, semantic_family: 'F', value, evidence: span(id, value === 'HAS_OFFER' ? '已有Offer' : '没有Offer', dimensionId) })),
  outcomes: [], reflection: null, unknown_dimensions: [],
});

test('single-value dimensions can never qualify (P0-02)', () => {
  const records = [
    record('a', 'WORK', [['family_financial_pressure', 'NEED_INCOME']], '选择工作'),
    record('b', 'GRAD_SCHOOL', [['family_financial_pressure', 'NEED_INCOME']], '选择工作'),
    record('c', 'WORK', [['current_opportunity', 'HAS_OFFER']], '选择工作'),
    record('d', 'GRAD_SCHOOL', [['current_opportunity', 'NO_SATISFIED_OFFER']], '选择工作'),
  ];
  const lens = discoverDiscussionLens('q', records);
  const ids = lens.dimensions.map((dimension) => dimension.id);
  assert.ok(ids.includes('current_opportunity'));
  assert.ok(!ids.includes('family_financial_pressure'), 'dimension with a single observed value must be excluded');
});

test('contrast support and counterexamples are counted separately (P0-01)', () => {
  // a/b 同值不同选择 -> counterexample；a/c、b/c 不同值不同选择 -> contrast support
  const records = [
    record('a', 'WORK', [['current_opportunity', 'HAS_OFFER']], '选择工作'),
    record('b', 'GRAD_SCHOOL', [['current_opportunity', 'HAS_OFFER']], '选择工作'),
    record('c', 'GRAD_SCHOOL', [['current_opportunity', 'NO_SATISFIED_OFFER']], '选择工作'),
  ];
  const [candidate] = computeDimensionCandidates(records).filter((item) => item.id === 'current_opportunity');
  assert.ok(candidate);
  assert.equal(candidate.contrastPairs, 1); // a/c 不同值不同选择；b/c 同选择不构成分歧证据
  assert.equal(candidate.counterexamplePairs, 1);
  assert.deepEqual(candidate.counterexample_sources, ['a', 'b']);
  // P0-06：跨立场证据必须成对出现
  assert.ok(candidate.support_examples.length >= 2);
  const decisions = new Set(candidate.support_examples.map((example) => example.decision));
  assert.deepEqual([...decisions].sort(), ['GRAD_SCHOOL', 'WORK']);
  for (const example of candidate.support_examples) {
    assert.ok(example.quote.length > 0 && example.evidence_id.length > 0);
  }
});

test('CONDITIONAL decisions do not manufacture contrast (matched-pair gate)', () => {
  const records = [
    record('a', 'WORK', [['exam_outcome', 'EXAM_FAILED']], '选择工作'),
    record('b', 'CONDITIONAL', [['exam_outcome', 'EXAM_ADMITTED']], '选择工作'),
  ];
  const lens = discoverDiscussionLens('q', records);
  assert.equal(lens.dimensions.length, 0, 'CONDITIONAL must not create contrast evidence');
});

test('same-value same-decision pairs support nothing', () => {
  const records = [
    record('a', 'WORK', [['school_level', 'TARGET_211_985']], '选择工作'),
    record('b', 'WORK', [['school_level', 'TARGET_211_985']], '选择工作'),
    record('c', 'WORK', [['school_level', 'DOUBLE_NON_OR_WEAKER']], '选择工作'),
  ];
  const lens = discoverDiscussionLens('q', records);
  assert.equal(lens.dimensions.length, 0, 'no decision difference means no contrast dimension');
});
