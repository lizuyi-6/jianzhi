import test from 'node:test';
import assert from 'node:assert/strict';
import { schemaVersion, SourceDocument } from '../src/core/contracts.js';
import { ReplayModel } from '../src/ai/model.js';
import { runExtractionPipeline } from '../src/ai/pipeline.js';
import { parseModelOutput, locateQuote } from '../src/ai/extraction.js';
import { qualifySource } from '../src/ai/qualify.js';

const sourceText = '我本科毕业那年同时拿到了保研资格和某大厂的转正offer，家里经济压力很大，父母供我读书已经拼尽全力，思考再三我最终选择直接工作，先解决家里的经济问题。这是一段足够长的原文片段，用于通过 E2/E3 资格判定，避免因为长度不足被拒。这里继续补充背景细节：当时我正在完成毕业设计，导师催得比较紧，宿舍同学也都在各自忙秋招或考研复试，大家经常在深夜讨论未来的去向，谁也说不出标准答案，每个人都在权衡家庭情况、手里的机会和对未来的想象，这些讨论让我更确定这是没有标准答案的个人决策。';
const source: SourceDocument = {
  source_id: 's1', source_type: 'answer', question_title: '读研还是工作', author: { id: null, name: 'Tester' },
  text: sourceText, url: 'https://example.com/s1', platform_signals: { authority: 3, vote_count: 10, comment_count: 2 }, source_mode: 'fixture',
};

const rawOutput = JSON.stringify({
  knowledge_types: ['EXPERIENCE'],
  decision: { value: 'WORK', quote: '思考再三我最终选择直接工作' },
  pre_decision_context: [
    { dimension_id: 'current_opportunity', value: 'HAS_OFFER', quote: '同时拿到了保研资格和某大厂的转正offer' },
    { dimension_id: 'family_financial_pressure', value: 'NEED_INCOME', quote: '父母供我读书已经拼尽全力' },
  ],
  outcome_quotes: [],
  reflection_quote: null,
});

test('pipeline replays cached model output into a validated record (P0-07)', async () => {
  const replay = new ReplayModel([
    JSON.stringify({ source_id: 's1', prompt_version: 'llm1-v2', model: 'golden-reviewed-v1', created_at: new Date().toISOString(), reviewed: true, response: rawOutput }),
  ], 'llm1-v2');
  const report = await runExtractionPipeline({ sources: [source], model: replay });
  assert.equal(report.extracted, 1);
  const outcome = report.outcomes[0]!;
  assert.equal(outcome.status, 'extracted');
  assert.ok(outcome.record);
  assert.equal(outcome.record.decision?.value, 'WORK');
  // 证据必须能回放定位到原文
  assert.equal(sourceText.slice(outcome.record.decision!.evidence.start, outcome.record.decision!.evidence.end), '思考再三我最终选择直接工作');
});

test('fabricated quotes are rejected by the evidence validator', () => {
  const result = parseModelOutput(source, JSON.stringify({
    knowledge_types: ['EXPERIENCE'],
    decision: { value: 'WORK', quote: '这句话不存在于原文之中' },
    pre_decision_context: [], outcome_quotes: [], reflection_quote: null,
  }));
  assert.equal(result.record, null);
  assert.ok(result.dropped.some((item) => item.stage === 'locate'));
});

test('unknown dimensions are normalized away, not invented', () => {
  const result = parseModelOutput(source, JSON.stringify({
    knowledge_types: ['EXPERIENCE'],
    decision: { value: 'WORK', quote: '思考再三我最终选择直接工作' },
    pre_decision_context: [{ dimension_id: 'weather', value: 'SUNNY', quote: '父母供我读书已经拼尽全力' }],
    outcome_quotes: [], reflection_quote: null,
  }));
  assert.ok(result.record);
  assert.equal(result.record!.pre_decision_context.length, 0);
});

test('qualification gates E0/E1 content', () => {
  assert.equal(qualifySource({ ...source, text: '太短' }).label, 'E0');
  assert.equal(qualifySource({ ...source, text: '这个问题近年来引发了广泛讨论。有人认为学历更重要，因为很多岗位的招聘门槛在提高；也有人认为经验更重要，因为职场看重实际产出。两种观点各有支持者，不同行业的情况差异很大，很难一概而论。总体来看，选择因人而异，建议结合自身情况综合考虑，多听听不同角度的意见，再做出适合自己的判断，不要盲目跟风，也不要轻易被他人的经历左右，最终的时间投入和回报需要自己评估权衡。' }).label, 'E1');
  assert.notEqual(qualifySource(source).label, 'E0');
});

test('locateQuote falls back to whitespace-normalized matching', () => {
  const messy = '我  最终\n选择  工作';
  const span = locateQuote(messy, 'x', '我 最终 选择 工作', 'decision', 'e1');
  assert.ok(span.located);
  assert.equal(messy.slice(span.start, span.end), '我  最终\n选择  工作');
});
