import { ComparisonResult, CurrentDecisionContext, DiscussionLens, ExperienceRecord, ReadingSet, SourceDocument, schemaVersion } from './contracts.js';
import { compareExperience } from './compare.js';

type Candidate = { record: ExperienceRecord; comparison: ComparisonResult; source: SourceDocument | undefined };

function quality(candidate: Candidate): number {
  const signals = candidate.source?.platform_signals;
  return (Number(signals?.authority ?? 0) * 10) + Math.log10(1 + Number(signals?.vote_count ?? 0)) + Math.log10(1 + Number(signals?.comment_count ?? 0));
}

function comparableOrder(a: Candidate, b: Candidate): number {
  return b.comparison.same.length - a.comparison.same.length ||
    a.comparison.different.length - b.comparison.different.length ||
    a.comparison.unknown.length - b.comparison.unknown.length ||
    b.record.pre_decision_context.length - a.record.pre_decision_context.length ||
    quality(b) - quality(a) || a.record.source_id.localeCompare(b.record.source_id);
}

function slot(candidate: Candidate, role: 'COMPARABLE' | 'COUNTER_EXPERIENCE' | 'CLASSIC') {
  return {
    role,
    source_id: candidate.record.source_id,
    // P1-10：why_read 只声明算法真实使用的规则，不承诺未经证明的「结果与体会」。
    why_read: role === 'COMPARABLE'
      ? ['HAS_COMPARABLE_EXPERIENCE', 'EVIDENCE_BACKED_CONTEXT']
      : role === 'COUNTER_EXPERIENCE'
        ? ['SIMILAR_CONTEXT_DIFFERENT_DECISION', 'COUNTER_EXPERIENCE']
        : ['PUBLIC_QUALITY_COORDINATE'],
    // P1-11：why_read 对应的证据 id 显式下发给 Renderer
    evidence_ids: candidate.comparison.explanation_facts.filter((fact) => fact.type !== 'UNKNOWN').map((fact) => fact.source_evidence_id),
  };
}

export function retrieveReadingSet(records: ExperienceRecord[], sources: SourceDocument[], context: CurrentDecisionContext, lens: DiscussionLens): ReadingSet {
  const sourceById = new Map(sources.map((source) => [source.source_id, source]));
  const candidates: Candidate[] = records.map((record) => ({ record, comparison: compareExperience(record, context, lens), source: sourceById.get(record.source_id) }));
  const comparable = candidates.filter((item) => item.comparison.comparable_eligible && item.record.decision).sort(comparableOrder);
  const selectedA = comparable[0];
  const selectedB = selectedA
    ? comparable.filter((item) => item.record.source_id !== selectedA.record.source_id && item.record.decision?.value !== selectedA.record.decision?.value).sort(comparableOrder)[0]
    : undefined;
  const selectedC = candidates
    .filter((item) => item.record.source_id !== selectedA?.record.source_id && item.record.source_id !== selectedB?.record.source_id)
    .sort((a, b) => quality(b) - quality(a) || a.record.source_id.localeCompare(b.record.source_id))[0];
  const warnings: string[] = [];
  if (!selectedA) warnings.push('NO_COMPARABLE_EXPERIENCE');
  if (!selectedB) warnings.push('NO_COUNTER_EXPERIENCE');
  if (!selectedC) warnings.push('NO_CLASSIC_SOURCE');
  // P1-05：用户条件只要出现「未覆盖」就显式告警，而不是静默当成差异
  const uncovered = new Set<string>();
  for (const item of candidates) for (const dimensionId of item.comparison.uncovered) uncovered.add(dimensionId);
  if (uncovered.size > 0) warnings.push('USER_CONDITION_UNCOVERED');
  return {
    schema_version: schemaVersion,
    question_key: context.question_key,
    slot_a: selectedA ? slot(selectedA, 'COMPARABLE') : null,
    slot_b: selectedB ? slot(selectedB, 'COUNTER_EXPERIENCE') : null,
    slot_c: selectedC ? slot(selectedC, 'CLASSIC') : null,
    warnings,
  };
}
