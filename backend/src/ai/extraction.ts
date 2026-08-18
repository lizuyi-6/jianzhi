import { z } from 'zod';
import { EvidenceSpan, ExperienceRecord, SourceDocument, schemaVersion } from '../core/contracts.js';
import { normalizeDimensionId, normalizeValue } from '../core/ontology.js';
import { validateExperienceEvidence } from '../core/evidence.js';

// LLM-1 Extraction：模型只负责给出「维度/取值/逐字引句」，偏移量与合法性由本地 Evidence Validator
// 计算——模型永远不直接产生可信坐标，这保证了缓存回放与实时抽取走同一条校验路径。

export const EXTRACTION_PROMPT_VERSION = 'llm1-v2';

export const RawDecisionSchema = z.object({ value: z.enum(['WORK', 'GRAD_SCHOOL', 'CONDITIONAL', 'NO_CLEAR_DECISION']), quote: z.string().min(1) });
export const RawFactSchema = z.object({ dimension_id: z.string().min(1), value: z.string().min(1), quote: z.string().min(1) });
export const RawExtractionSchema = z.object({
  knowledge_types: z.array(z.enum(['EXPERIENCE', 'OUTCOME', 'REFLECTION', 'ANALYSIS', 'GENERAL_OPINION'])).default(['EXPERIENCE']),
  decision: RawDecisionSchema.nullable(),
  pre_decision_context: z.array(RawFactSchema).default([]),
  outcome_quotes: z.array(z.string()).default([]),
  reflection_quote: z.string().nullable().default(null),
});
export type RawExtraction = z.infer<typeof RawExtractionSchema>;

export function buildExtractionPrompt(source: SourceDocument): string {
  return [
    '从下面的知乎内容片段中抽取「本科毕业季：直接工作 vs 继续读研」这一决策事件的经验记录。',
    '硬性要求：',
    '1. 只抽取作者本人（或文中明确标注的当事人）在同一决策事件上的真实经历；泛泛建议、清单、方法论不要抽取。',
    '2. decision.value 只能是 WORK / GRAD_SCHOOL / CONDITIONAL / NO_CLEAR_DECISION 之一，且必须有原文逐字引句。',
    '3. pre_decision_context 的 dimension_id 只能使用受控本体：current_opportunity / exam_outcome / study_motivation / school_level / career_goal / family_financial_pressure / time_constraint。',
    '4. value 使用规范编码，例如 HAS_OFFER / NO_SATISFIED_OFFER / EXAM_FAILED / EXAM_ADMITTED / RESEARCH_PLATFORM / PRACTICAL_FIRST / TARGET_211_985 / DOUBLE_NON_OR_WEAKER / NEED_INCOME。',
    '5. 每个字段都必须给出原文「逐字引句」（quote），引句必须是片段的精确子串，不要改写、不要省略号。',
    '6. 片段中没有提到的维度不要编造；没有明确选择时 decision 用 CONDITIONAL 或 NO_CLEAR_DECISION。',
    '只输出 JSON 对象，字段：knowledge_types, decision{value,quote}, pre_decision_context[{dimension_id,value,quote}], outcome_quotes[], reflection_quote。',
    '',
    '内容片段：',
    source.text,
  ].join('\n');
}

export interface LocatedSpan extends EvidenceSpan { located: boolean }

// 逐字引句定位：先精确子串匹配，再做「空白归一化」匹配并映射回原始偏移。
export function locateQuote(sourceText: string, sourceId: string, quote: string, field: string, evidenceId: string): LocatedSpan {
  const exact = sourceText.indexOf(quote);
  if (exact >= 0) return { evidence_id: evidenceId, source_id: sourceId, quote, start: exact, end: exact + quote.length, field, located: true };
  const rawOffsets: number[] = [];
  let normalized = '';
  for (let i = 0; i < sourceText.length; i++) {
    const ch = sourceText[i]!;
    if (/\s/.test(ch)) { if (normalized && !/\s$/.test(normalized)) { normalized += ' '; rawOffsets.push(-1); } continue; }
    normalized += ch;
    rawOffsets.push(i);
  }
  const target = quote.replace(/\s+/g, ' ').trim();
  const idx = normalized.indexOf(target);
  if (idx < 0 || rawOffsets[idx] === undefined || rawOffsets[idx]! < 0) {
    return { evidence_id: evidenceId, source_id: sourceId, quote, start: 0, end: Math.max(1, sourceText.length), field, located: false };
  }
  let lastRaw = rawOffsets[idx]!;
  for (let k = idx; k < idx + target.length; k++) { const off = rawOffsets[k]; if (off !== undefined && off >= 0) lastRaw = off; }
  return { evidence_id: evidenceId, source_id: sourceId, quote: sourceText.slice(rawOffsets[idx]!, lastRaw + 1), start: rawOffsets[idx]!, end: lastRaw + 1, field, located: true };
}

export interface ExtractionResult {
  record: ExperienceRecord | null;
  dropped: { stage: 'normalize' | 'locate' | 'validate'; reason: string }[];
}

// LLM-2 Normalization：受控本体归一（dimension/value 白名单）+ 本地证据校验
export function toExperienceRecord(source: SourceDocument, raw: RawExtraction): ExtractionResult {
  const dropped: ExtractionResult['dropped'] = [];
  const facts: ExperienceRecord['pre_decision_context'] = [];
  const seen = new Set<string>();
  for (const fact of raw.pre_decision_context) {
    const dimensionId = normalizeDimensionId(fact.dimension_id);
    if (!dimensionId) { dropped.push({ stage: 'normalize', reason: 'UNKNOWN_DIMENSION: ' + fact.dimension_id }); continue; }
    if (seen.has(dimensionId)) continue;
    const span = locateQuote(source.text, source.source_id, fact.quote, dimensionId, source.source_id + ':ctx:' + dimensionId);
    if (!span.located) { dropped.push({ stage: 'locate', reason: 'QUOTE_NOT_FOUND: ' + dimensionId }); continue; }
    seen.add(dimensionId);
    facts.push({ dimension_id: dimensionId, semantic_family: dimensionId.split('_')[0]!.toUpperCase(), value: normalizeValue(fact.value), evidence: span });
  }

  let decision: ExperienceRecord['decision'] = null;
  if (raw.decision) {
    const span = locateQuote(source.text, source.source_id, raw.decision.quote, 'decision', source.source_id + ':decision');
    if (!span.located) dropped.push({ stage: 'locate', reason: 'DECISION_QUOTE_NOT_FOUND' });
    else decision = { value: raw.decision.value, evidence: span };
  }
  if (!decision) return { record: null, dropped: [...dropped, { stage: 'validate', reason: 'NO_GROUNDED_DECISION' }] };

  const outcomes: EvidenceSpan[] = [];
  for (const quote of raw.outcome_quotes.slice(0, 3)) {
    const span = locateQuote(source.text, source.source_id, quote, 'outcome', source.source_id + ':outcome:' + outcomes.length);
    if (span.located) outcomes.push(span);
  }
  let reflection: EvidenceSpan | null = null;
  if (raw.reflection_quote) {
    const span = locateQuote(source.text, source.source_id, raw.reflection_quote, 'reflection', source.source_id + ':reflection');
    if (span.located) reflection = span;
  }

  const record: ExperienceRecord = {
    schema_version: schemaVersion,
    source_id: source.source_id,
    knowledge_types: raw.knowledge_types.length ? raw.knowledge_types : ['EXPERIENCE'],
    decision,
    pre_decision_context: facts,
    outcomes,
    reflection,
    unknown_dimensions: [],
  };
  const issues = validateExperienceEvidence(source.text, source.source_id, record);
  if (issues.length) return { record: null, dropped: [...dropped, { stage: 'validate', reason: 'INVALID_EVIDENCE: ' + JSON.stringify(issues) }] };
  return { record, dropped };
}

export function parseModelOutput(source: SourceDocument, output: string): ExtractionResult {
  const trimmed = output.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  let parsed: unknown;
  try { parsed = JSON.parse(trimmed); }
  catch { return { record: null, dropped: [{ stage: 'validate', reason: 'MODEL_OUTPUT_NOT_JSON' }] }; }
  const raw = RawExtractionSchema.safeParse(parsed);
  if (!raw.success) return { record: null, dropped: [{ stage: 'validate', reason: 'MODEL_OUTPUT_SCHEMA_INVALID: ' + raw.error.message }] };
  return toExperienceRecord(source, raw.data);
}
