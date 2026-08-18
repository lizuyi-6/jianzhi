import { DiscussionLens, ExperienceRecord, SupportExample, schemaVersion } from './contracts.js';
import { dimensionLabel, isAnswerableDimension, normalizeDimensionId } from './ontology.js';

// P0-01 修复后的 Contrast 语义：
//  1) 一个维度必须至少有 2 个不同观测值才可能成为「分歧条件」（单值维度直接出局，P0-02 随之消失）；
//  2) contrast support（不同值 + 不同选择）与 counterexample（相同值 + 不同选择）严格分开统计；
//  3) matched-pair gate：只有绑定同一决策事件、给出明确 WORK/GRAD_SCHOOL 选择的记录才参与配对，
//     CONDITIONAL / NO_CLEAR_DECISION 不产生配对证据。
export const MIN_OBSERVED_VALUES = 2;
export const MIN_RECORDS_PER_DIMENSION = 2;
export const MIN_COVERAGE_RATIO = 0.25;
export const MIN_CONTRAST_PAIRS = 1;
export const MAX_DIMENSIONS = 4;

type Entry = { record: ExperienceRecord; value: string; evidence: ExperienceRecord['pre_decision_context'][number]['evidence'] };

export type DimensionCandidate = DiscussionLens['dimensions'][number] & {
  coverageRatio: number;
  contrastPairs: number;
  counterexamplePairs: number;
};

function matchedRecords(records: ExperienceRecord[]): ExperienceRecord[] {
  return records.filter((record) => record.knowledge_types.includes('EXPERIENCE')
    && (record.decision?.value === 'WORK' || record.decision?.value === 'GRAD_SCHOOL'));
}

export function computeDimensionCandidates(records: ExperienceRecord[]): DimensionCandidate[] {
  const eligible = matchedRecords(records);
  if (eligible.length === 0) return [];
  const byDimension = new Map<string, { family: string; entries: Entry[] }>();
  for (const record of eligible) {
    const seenDimensions = new Set<string>();
    for (const fact of record.pre_decision_context) {
      const id = normalizeDimensionId(fact.dimension_id);
      if (!id || seenDimensions.has(id)) continue; // 受控本体归一 + 同记录去重（P1-06）
      seenDimensions.add(id);
      const item = byDimension.get(id) ?? { family: fact.semantic_family, entries: [] };
      item.entries.push({ record, value: fact.value, evidence: fact.evidence });
      byDimension.set(id, item);
    }
  }

  const candidates: DimensionCandidate[] = [];
  for (const [id, item] of byDimension) {
    const valueGroups = new Map<string, Entry[]>();
    for (const entry of item.entries) {
      const group = valueGroups.get(entry.value) ?? [];
      group.push(entry);
      valueGroups.set(entry.value, group);
    }
    if (valueGroups.size < MIN_OBSERVED_VALUES) continue;
    if (item.entries.length < MIN_RECORDS_PER_DIMENSION) continue;
    const coverageRatio = item.entries.length / eligible.length;
    if (coverageRatio < MIN_COVERAGE_RATIO) continue;

    let contrastPairs = 0;
    let counterexamplePairs = 0;
    const supportExamples: SupportExample[] = [];
    for (let i = 0; i < item.entries.length; i++) {
      for (let j = i + 1; j < item.entries.length; j++) {
        const a = item.entries[i]!;
        const b = item.entries[j]!;
        if (a.record.decision?.value === b.record.decision?.value) continue;
        if (a.value !== b.value) {
          contrastPairs += 1;
          // P0-06：跨立场证据成对输出（每个维度至少能看到双方各自的原文依据）
          for (const side of [a, b]) {
            if (supportExamples.length >= 4) break;
            if (supportExamples.some((example) => example.source_id === side.record.source_id)) continue;
            supportExamples.push({
              source_id: side.record.source_id,
              value: side.value,
              decision: side.record.decision!.value,
              evidence_id: side.evidence.evidence_id,
              quote: side.evidence.quote,
            });
          }
        } else {
          counterexamplePairs += 1;
        }
      }
    }
    if (contrastPairs < MIN_CONTRAST_PAIRS) continue;

    const counterexampleSources = new Set<string>();
    for (const group of valueGroups.values()) {
      const decisions = new Set(group.map((entry) => entry.record.decision!.value));
      if (decisions.size > 1) for (const entry of group) counterexampleSources.add(entry.record.source_id);
    }

    candidates.push({
      id,
      label: dimensionLabel(id),
      semantic_family: item.family,
      observed_values: [...valueGroups.keys()].sort(),
      supporting_sources: [...new Set(item.entries.map((entry) => entry.record.source_id))].sort(),
      counterexample_sources: [...counterexampleSources].sort(),
      user_answerable: isAnswerableDimension(id),
      support_examples: supportExamples,
      coverageRatio,
      contrastPairs,
      counterexamplePairs,
    });
  }

  candidates.sort((a, b) => b.contrastPairs - a.contrastPairs || b.coverageRatio - a.coverageRatio || a.id.localeCompare(b.id));
  return candidates;
}

export function discoverDiscussionLens(questionKey: string, records: ExperienceRecord[]): DiscussionLens {
  const dimensions = computeDimensionCandidates(records).slice(0, MAX_DIMENSIONS)
    .map(({ coverageRatio: _coverage, contrastPairs: _support, counterexamplePairs: _counter, ...dimension }) => dimension);
  return { schema_version: schemaVersion, question_key: questionKey, dimensions };
}
