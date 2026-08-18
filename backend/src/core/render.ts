import { ComparisonResult, CurrentDecisionContext, DiscussionLens, ExperienceRecord, ReadingSet, RenderPacket, RenderPacketSchema, SourceDocument } from './contracts.js';
import { compareExperience } from './compare.js';
import { validateEvidenceSpan } from './evidence.js';

function spans(record: ExperienceRecord) {
  const all = []; if (record.decision) all.push(record.decision.evidence); all.push(...record.pre_decision_context.map((item) => item.evidence), ...record.outcomes); if (record.reflection) all.push(record.reflection); return all;
}

// P1-03：Renderer 接收完整 CurrentDecisionContext（含 rejected/custom），不再重建空上下文
export function buildRenderPacket(questionKey: string, lens: DiscussionLens, readingSet: ReadingSet, records: ExperienceRecord[], sources: SourceDocument[], context: CurrentDecisionContext): RenderPacket {
  const recordsById = new Map(records.map((record) => [record.source_id, record])); const sourcesById = new Map(sources.map((source) => [source.source_id, source]));
  const cards: RenderPacket['cards'] = []; const empty_slots: RenderPacket['empty_slots'] = [];
  const slots = [['COMPARABLE', readingSet.slot_a], ['COUNTER_EXPERIENCE', readingSet.slot_b], ['CLASSIC', readingSet.slot_c]] as const;
  for (const [expectedRole, slot] of slots) {
    if (!slot) { empty_slots.push(expectedRole); continue; }
    if (slot.role !== expectedRole) throw new Error('RENDER_PACKET_INVALID: role mismatch');
    const record = recordsById.get(slot.source_id); const source = sourcesById.get(slot.source_id);
    if (!record || !source) throw new Error('RENDER_PACKET_INVALID: source not found');
    const comparison: ComparisonResult = compareExperience(record, context, lens);
    const factByDimension = new Map(record.pre_decision_context.map((fact) => [fact.dimension_id, fact]));
    // P1-08：「不同」双边可见：用户值 + TA 值 + 证据 id
    const different_facts = comparison.different.map((dimension) => {
      const fact = factByDimension.get(dimension);
      const evidenceId = comparison.explanation_facts.find((item) => item.dimension === dimension && item.type === 'DIFFERENT')?.source_evidence_id ?? fact?.evidence.evidence_id ?? '';
      return { dimension, user_value: context.values[dimension] ?? '', source_value: fact?.value ?? '', evidence_id: evidenceId };
    });
    // P1-11：卡片只保留「为什么先读」对应的证据（决策证据 + 命中/差异的上下文证据）
    const whyIds = new Set(slot.evidence_ids);
    const evidence = spans(record).filter((item) => {
      if (item.field === 'decision' && record.decision && item.evidence_id === record.decision.evidence.evidence_id) return true;
      return whyIds.has(item.evidence_id);
    });
    for (const item of evidence) { const issues = validateEvidenceSpan(source.text, source.source_id, item); if (issues.length) throw new Error('RENDER_PACKET_INVALID: invalid evidence'); }
    cards.push({
      role: slot.role, source_id: source.source_id, title: source.question_title, url: source.url,
      same_dimensions: comparison.same, different_dimensions: comparison.different, unknown_dimensions: comparison.unknown,
      different_facts,
      // P1-09：公共质量信号随卡片下发，前端如实展示 C 位的挑选依据
      quality_signals: {
        vote_count: source.platform_signals.vote_count ?? null,
        comment_count: source.platform_signals.comment_count ?? null,
        authority: source.platform_signals.authority ?? null,
      },
      why_read_codes: slot.why_read, evidence,
    });
  }
  return RenderPacketSchema.parse({ schema_version: '0.1.0', question_key: questionKey, lens, cards, empty_slots, warnings: readingSet.warnings });
}
