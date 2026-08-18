import test from 'node:test';
import assert from 'node:assert/strict';
import { compareExperience } from '../src/core/compare.js';
import { retrieveReadingSet } from '../src/core/retrieve.js';
import { CurrentDecisionContext, DiscussionLens, ExperienceRecord, SourceDocument, schemaVersion } from '../src/core/contracts.js';

const text = '目标工程开发，已有满意Offer，最后选择工作。';
const evidence = (id: string, quote: string) => ({ evidence_id: id, source_id: id.split(':')[0]!, quote, start: text.indexOf(quote), end: text.indexOf(quote) + quote.length, field: 'context' });
const record = (id: string, goal: string, decision: 'WORK' | 'GRAD_SCHOOL'): ExperienceRecord => ({
  schema_version: schemaVersion, source_id: id, knowledge_types: ['EXPERIENCE'],
  decision: { value: decision, evidence: evidence(id + ':decision', '选择工作') },
  pre_decision_context: [{ dimension_id: 'career_goal', semantic_family: 'GOAL', value: goal, evidence: evidence(id + ':goal', '工程开发') }],
  outcomes: [], reflection: null, unknown_dimensions: [],
});
const lens: DiscussionLens = { schema_version: schemaVersion, question_key: 'q1', dimensions: [{ id: 'career_goal', label: '目标方向', semantic_family: 'GOAL', observed_values: ['ENGINEERING', 'RESEARCH'], supporting_sources: ['a', 'b'], counterexample_sources: ['b'], user_answerable: true, support_examples: [] }] };
const context: CurrentDecisionContext = { schema_version: schemaVersion, question_key: 'q1', values: { career_goal: 'ENGINEERING' }, user_rejected_dimensions: [], custom_condition: null };
const authority: Record<string, number> = { a: 3, b: 2, c: 4 };
const sources: SourceDocument[] = ['a', 'b', 'c'].map((id, index) => ({ source_id: id, source_type: 'answer', question_title: 'q', author: {}, text, url: 'https://example.com/' + id, platform_signals: { authority: authority[id], vote_count: index }, source_mode: 'fixture' }));

test('comparison emits deterministic same/different/unknown', () => {
  assert.deepEqual(compareExperience(record('a', 'ENGINEERING', 'WORK'), context, lens).same, ['career_goal']);
  assert.deepEqual(compareExperience(record('b', 'RESEARCH', 'GRAD_SCHOOL'), context, lens).different, ['career_goal']);
});

test('retrieval keeps role-specific A/B/C slots', () => {
  const set = retrieveReadingSet([record('a', 'ENGINEERING', 'WORK'), record('b', 'ENGINEERING', 'GRAD_SCHOOL'), record('c', 'RESEARCH', 'WORK')], sources, context, lens);
  assert.equal(set.slot_a?.source_id, 'a');
  assert.equal(set.slot_b?.source_id, 'b');
  assert.equal(set.slot_c?.source_id, 'c');
  assert.deepEqual(set.warnings, []);
});

test('counter slot remains empty when no different decision exists', () => {
  const set = retrieveReadingSet([record('a', 'ENGINEERING', 'WORK')], sources.slice(0, 1), context, lens);
  assert.equal(set.slot_b, null);
  assert.ok(set.warnings.includes('NO_COUNTER_EXPERIENCE'));
});
