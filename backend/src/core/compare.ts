import { ComparisonResult, CurrentDecisionContext, DiscussionLens, ExperienceRecord, schemaVersion } from './contracts.js';

// P1-07：「和你很像」的门槛。已比较维度 >= 3 时至少要有 2 个 Same；
// 只回答 1-2 维时维持 same >= 1 且 different <= same 的宽松判定（保证冷启动可用）。
export function comparableEligible(record: ExperienceRecord, same: number, different: number): boolean {
  if (!record.knowledge_types.includes('EXPERIENCE') || !record.decision) return false;
  const answered = same + different;
  if (answered === 0) return false;
  if (different > same) return false;
  if (answered >= 3 && same < 2) return false;
  return true;
}

export function compareExperience(record: ExperienceRecord, context: CurrentDecisionContext, lens: DiscussionLens): ComparisonResult {
  const facts = new Map(record.pre_decision_context.map((fact) => [fact.dimension_id, fact]));
  const lensDimensions = new Map(lens.dimensions.map((dimension) => [dimension.id, dimension]));
  const same: string[] = [];
  const different: string[] = [];
  const unknown: string[] = [];
  const uncovered: string[] = [];
  const explanation_facts: ComparisonResult['explanation_facts'] = [];

  for (const [dimensionId, userValue] of Object.entries(context.values)) {
    const dimension = lensDimensions.get(dimensionId);
    // P1-05：不在透镜本体里的维度是「未覆盖」，绝不武断参与比较
    if (!dimension) { uncovered.push(dimensionId); continue; }
    if (context.user_rejected_dimensions.includes(dimensionId)) continue;
    if (!userValue) continue;
    // 用户选了本体里不存在的取值：同样按未覆盖处理，而不是 Different
    if (!dimension.observed_values.includes(userValue)) { uncovered.push(dimensionId); continue; }
    const fact = facts.get(dimensionId);
    if (!fact) {
      unknown.push(dimensionId);
      explanation_facts.push({ type: 'UNKNOWN', dimension: dimensionId, source_evidence_id: 'unknown:' + record.source_id + ':' + dimensionId });
    } else if (fact.value === userValue) {
      same.push(dimensionId);
      explanation_facts.push({ type: 'SAME', dimension: dimensionId, source_evidence_id: fact.evidence.evidence_id });
    } else {
      different.push(dimensionId);
      explanation_facts.push({ type: 'DIFFERENT', dimension: dimensionId, source_evidence_id: fact.evidence.evidence_id });
    }
  }

  // 透镜维度顺序稳定输出（same/different/unknown 的展示顺序与 Lens 一致）
  const order = lens.dimensions.map((dimension) => dimension.id);
  const byOrder = (list: string[]) => list.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  return {
    schema_version: schemaVersion,
    source_id: record.source_id,
    same: byOrder(same),
    different: byOrder(different),
    unknown: byOrder(unknown),
    uncovered: [...new Set(uncovered)],
    comparable_eligible: comparableEligible(record, same.length, different.length),
    explanation_facts,
  };
}
