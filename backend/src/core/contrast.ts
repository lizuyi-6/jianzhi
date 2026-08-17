import { DiscussionLens, ExperienceRecord, schemaVersion } from './contracts.js';

type Candidate = DiscussionLens['dimensions'][number] & { coverageRatio: number; pairwiseSupport: number };
const labels: Record<string, string> = {
  career_goal: '目标方向', current_opportunity: '当前机会', study_motivation: '读研目的',
  education_background: '教育背景', target_role: '目标岗位', time_constraint: '时间约束', location: '地域条件'
};

export function discoverDiscussionLens(questionKey: string, records: ExperienceRecord[]): DiscussionLens {
  const eligible = records.filter((record) => record.knowledge_types.includes('EXPERIENCE') && record.decision);
  const dimensions = new Map<string, { family: string; values: Map<string, Set<string>>; records: Map<string, ExperienceRecord> }>();
  for (const record of eligible) for (const fact of record.pre_decision_context) {
    const item = dimensions.get(fact.dimension_id) ?? { family: fact.semantic_family, values: new Map(), records: new Map() };
    const sources = item.values.get(fact.value) ?? new Set<string>(); sources.add(record.source_id); item.values.set(fact.value, sources); item.records.set(record.source_id, record); dimensions.set(fact.dimension_id, item);
  }
  const candidates: Candidate[] = [];
  for (const [id, item] of dimensions) {
    if (item.values.size < 1) continue;
    const known = item.records.size; const coverageRatio = eligible.length ? known / eligible.length : 0;
    if (known < 2 || coverageRatio < 0.25) continue;
    const recordsWithFact = [...item.records.values()]; let pairwiseSupport = 0;
    for (let i = 0; i < recordsWithFact.length; i++) for (let j = i + 1; j < recordsWithFact.length; j++) {
      const a = recordsWithFact[i]!; const b = recordsWithFact[j]!;
      const av = a.pre_decision_context.find((fact) => fact.dimension_id === id)?.value;
      const bv = b.pre_decision_context.find((fact) => fact.dimension_id === id)?.value;
      if (a.decision?.value !== b.decision?.value && (av !== bv || av === bv)) pairwiseSupport++;
    }
    if (pairwiseSupport === 0) continue;
    const counterexamples: string[] = [];
    for (const sourceIds of item.values.values()) {
      const decisions = new Map<string, string[]>();
      for (const sourceId of sourceIds) { const decision = item.records.get(sourceId)?.decision?.value; if (decision) decisions.set(decision, [...(decisions.get(decision) ?? []), sourceId]); }
      if (decisions.size > 1) counterexamples.push(...sourceIds);
    }
    candidates.push({ id, label: labels[id] ?? id, semantic_family: item.family, observed_values: [...item.values.keys()].sort(), supporting_sources: [...item.records.keys()].sort(), counterexample_sources: [...new Set(counterexamples)].sort(), user_answerable: true, coverageRatio, pairwiseSupport });
  }
  candidates.sort((a, b) => b.pairwiseSupport - a.pairwiseSupport || b.coverageRatio - a.coverageRatio || a.id.localeCompare(b.id));
  return { schema_version: schemaVersion, question_key: questionKey, dimensions: candidates.slice(0, 4).map(({ coverageRatio: _coverage, pairwiseSupport: _support, ...dimension }) => dimension) };
}
