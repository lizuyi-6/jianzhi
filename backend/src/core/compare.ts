import { ComparisonResult, CurrentDecisionContext, DiscussionLens, ExperienceRecord, schemaVersion } from './contracts.js';

export function compareExperience(record: ExperienceRecord, context: CurrentDecisionContext, lens: DiscussionLens): ComparisonResult {
  const facts = new Map(record.pre_decision_context.map((fact) => [fact.dimension_id, fact]));
  const same: string[] = [];
  const different: string[] = [];
  const unknown: string[] = [];
  const explanation_facts: ComparisonResult['explanation_facts'] = [];

  for (const dimension of lens.dimensions) {
    if (context.user_rejected_dimensions.includes(dimension.id)) continue;
    const userValue = context.values[dimension.id];
    if (!userValue) continue;
    const fact = facts.get(dimension.id);
    if (!fact) {
      unknown.push(dimension.id);
      explanation_facts.push({ type: 'UNKNOWN', dimension: dimension.id, source_evidence_id: 'unknown:' + record.source_id + ':' + dimension.id });
    } else if (fact.value === userValue) {
      same.push(dimension.id);
      explanation_facts.push({ type: 'SAME', dimension: dimension.id, source_evidence_id: fact.evidence.evidence_id });
    } else {
      different.push(dimension.id);
      explanation_facts.push({ type: 'DIFFERENT', dimension: dimension.id, source_evidence_id: fact.evidence.evidence_id });
    }
  }

  return {
    schema_version: schemaVersion,
    source_id: record.source_id,
    same,
    different,
    unknown,
    comparable_eligible: record.knowledge_types.includes('EXPERIENCE') && same.length > 0 && different.length <= same.length,
    explanation_facts,
  };
}
