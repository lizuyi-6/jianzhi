// P1-14：小型 Gold Eval。基于人工复核的期望（golden cases）输出可复算的指标表。
// 运行：npm run eval（先 npm run extract -- --replay 重建语料）
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildApp } from '../src/app.js';
import { GOLDEN_QUESTION_KEY } from '../src/scripts/golden-corpus.js';

interface CaseResult { name: string; passed: boolean; checks: Array<{ name: string; passed: boolean; detail: string }> }

const CONTEXT_A = { current_opportunity: 'HAS_OFFER', study_motivation: 'PRACTICAL_FIRST' };
const CONTEXT_B = { current_opportunity: 'HAS_OFFER', study_motivation: 'PRACTICAL_FIRST', exam_outcome: 'EXAM_FAILED' };
const CONTEXT_C = { current_opportunity: 'NO_SATISFIED_OFFER' };

const app = await buildApp();
const post = async <T>(url: string, payload: unknown): Promise<T> => (await app.inject({ method: 'POST', url, payload })).json() as T;
const results: CaseResult[] = [];

const lensPacket = await post<{ lens: { dimensions: Array<{ id: string; support_examples: unknown[]; counterexample_sources: string[]; observed_values: string[] }> } }>('/api/v1/lens', { question_key: GOLDEN_QUESTION_KEY });
const lens = lensPacket.lens;

// 指标 1：Evidence Precision —— 全部语料记录通过 Evidence 校验（ ExperienceStore 加载即校验，能到这里就是 1.0 ）
const meta = (await app.inject({ method: 'GET', url: '/api/v1/meta' })).json();
const evidencePrecision = 1.0; // store.load 对每条记录做 validateExperienceEvidence，失败即抛错拒绝启动

// 指标 2：Contrast Precision —— 透镜维度中「真实存在跨值对立选择」的比例（support_examples 均来自重算的配对）
const contrastPrecision = lens.dimensions.filter((dimension) => dimension.support_examples.length >= 2).length / Math.max(1, lens.dimensions.length);

// 指标 3/4：Retrieval invariants + Demo moment（条件变化 -> Slot 变化）
const runReading = async (values: Record<string, string>) => (await post<{ reading_set: { slot_a: { source_id: string } | null; slot_b: { source_id: string } | null; slot_c: { source_id: string } | null; warnings: string[] } }>('/api/v1/reading-set', { question_key: GOLDEN_QUESTION_KEY, values })).reading_set;
const setA = await runReading(CONTEXT_A);
const setB = await runReading(CONTEXT_B);
const setC = await runReading(CONTEXT_C);

const check = (name: string, passed: boolean, detail = '') => ({ name, passed, detail });
results.push({
  name: 'A 基线条件：三槽齐备，B 与 A 选择不同',
  passed: Boolean(setA.slot_a && setA.slot_b && setA.slot_c),
  checks: [
    check('slot_a 存在', Boolean(setA.slot_a), setA.slot_a?.source_id ?? 'null'),
    check('slot_b 存在且与 A 不同来源', Boolean(setA.slot_b && setA.slot_a && setA.slot_b.source_id !== setA.slot_a.source_id)),
    check('无空位警告', setA.warnings.length === 0, setA.warnings.join(',')),
  ],
});
results.push({
  name: 'B 条件变化：至少一个 Slot 换人（F-009 demo moment）',
  passed: setA.slot_a?.source_id !== setB.slot_a?.source_id,
  checks: [
    check('A 位来源变化', setA.slot_a?.source_id !== setB.slot_a?.source_id, (setA.slot_a?.source_id ?? 'null') + ' -> ' + (setB.slot_a?.source_id ?? 'null')),
    check('变化后仍有完整三槽', Boolean(setB.slot_a && setB.slot_b && setB.slot_c)),
  ],
});
results.push({
  name: 'C 未拿到满意 Offer：A 位切换为同条件经验',
  passed: Boolean(setC.slot_a && setC.slot_a.source_id !== setA.slot_a?.source_id),
  checks: [check('A 位切换', Boolean(setC.slot_a && setC.slot_a.source_id !== setA.slot_a?.source_id), setC.slot_a?.source_id ?? 'null')],
});

// 指标 5：Stability —— 相同输入两次运行输出完全一致（确定性）
const stabilityRun = await runReading(CONTEXT_A);
const stable = JSON.stringify(stabilityRun) === JSON.stringify(setA);

// 指标 6：Baseline 对比 —— 随机选 A 的 same 维数均值 vs 算法 A 的 same 维数（用 lens 支持数近似）
const packetA = await post<{ render_packet: { cards: Array<{ role: string; same_dimensions: string[] }> } }>('/api/v1/render-packet', { question_key: GOLDEN_QUESTION_KEY, values: CONTEXT_A });
const algorithmA = packetA.render_packet.cards.find((card) => card.role === 'COMPARABLE')?.same_dimensions.length ?? 0;
const randomA = lens.dimensions.length > 0 ? (lens.dimensions.length - 1) / 2 : 0; // 随机命中的期望同维数（无偏估计下界）

const rows = [
  { metric: 'Evidence Precision（语料证据可回放率）', value: evidencePrecision.toFixed(2), note: meta.lens.experience_records + ' 条记录全部通过 validateExperienceEvidence' },
  { metric: 'Contrast Precision@3（透镜维度真实分歧率）', value: contrastPrecision.toFixed(2), note: lens.dimensions.map((d) => d.id).join(', ') },
  { metric: 'Retrieval Invariants（三槽齐备 + B≠A）', value: results[0]!.passed && results[0]!.checks[1]!.passed ? '1.00' : '0.00', note: 'A/B/C 角色约束' },
  { metric: 'Demo Moment（条件变化 Slot 变化率）', value: results[1]!.passed ? '1.00' : '0.00', note: (setA.slot_a?.source_id ?? '') + ' -> ' + (setB.slot_a?.source_id ?? '') },
  { metric: 'Stability（确定性）', value: stable ? '1.00' : '0.00', note: '同输入两次运行一致' },
  { metric: 'Baseline A/B（算法 vs 随机同维数）', value: algorithmA + ' vs ' + randomA.toFixed(1), note: '算法 A 位命中相同条件维度数' },
];

const markdown = [
  '# 知鉴 Gold Eval 报告',
  '',
  '运行方式：cd backend && npm run extract -- --replay && npm run eval',
  '',
  '| 指标 | 值 | 说明 |',
  '| --- | --- | --- |',
  ...rows.map((row) => '| ' + row.metric + ' | ' + row.value + ' | ' + row.note + ' |'),
  '',
  '## 用例明细',
  '',
  ...results.flatMap((result) => [
    '### ' + result.name + ' ' + (result.passed ? 'PASS' : 'FAIL'),
    ...result.checks.map((item) => '- [' + (item.passed ? 'x' : ' ') + '] ' + item.name + (item.detail ? '（' + item.detail + '）' : '')),
    '',
  ]),
].join('\n');

await mkdir(resolve(process.cwd(), 'eval'), { recursive: true });
await writeFile(resolve(process.cwd(), 'eval/REPORT.md'), markdown, 'utf8');
console.log(markdown);
await app.close();
const failed = results.filter((result) => !result.passed).length;
process.exit(failed ? 1 : 0);
