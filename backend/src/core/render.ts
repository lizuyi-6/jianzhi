import { ComparisonResult, DiscussionLens, ExperienceRecord, ReadingSet, RenderPacket, RenderPacketSchema, SourceDocument } from './contracts.js';
import { compareExperience } from './compare.js';
import { validateEvidenceSpan } from './evidence.js';

function spans(record: ExperienceRecord) {
  const all = []; if (record.decision) all.push(record.decision.evidence); all.push(...record.pre_decision_context.map((item) => item.evidence), ...record.outcomes); if (record.reflection) all.push(record.reflection); return all;
}

export function buildRenderPacket(questionKey: string, lens: DiscussionLens, readingSet: ReadingSet, records: ExperienceRecord[], sources: SourceDocument[], values: Record<string, string>): RenderPacket {
  const recordsById = new Map(records.map((record) => [record.source_id, record])); const sourcesById = new Map(sources.map((source) => [source.source_id, source]));
  const cards: RenderPacket['cards'] = []; const empty_slots: RenderPacket['empty_slots'] = [];
  const slots = [['COMPARABLE', readingSet.slot_a], ['COUNTER_EXPERIENCE', readingSet.slot_b], ['CLASSIC', readingSet.slot_c]] as const;
  for (const [expectedRole, slot] of slots) {
    if (!slot) { empty_slots.push(expectedRole); continue; }
    if (slot.role !== expectedRole) throw new Error('RENDER_PACKET_INVALID: role mismatch');
    const record = recordsById.get(slot.source_id); const source = sourcesById.get(slot.source_id);
    if (!record || !source) throw new Error('RENDER_PACKET_INVALID: source not found');
    const comparison: ComparisonResult = compareExperience(record, { schema_version: '0.1.0', question_key: questionKey, values, user_rejected_dimensions: [], custom_condition: null }, lens);
    const evidence = spans(record); for (const item of evidence) { const issues = validateEvidenceSpan(source.text, source.source_id, item); if (issues.length) throw new Error('RENDER_PACKET_INVALID: invalid evidence'); }
    cards.push({ role: slot.role, source_id: source.source_id, title: source.question_title, url: source.url, same_dimensions: comparison.same, different_dimensions: comparison.different, unknown_dimensions: comparison.unknown, why_read_codes: slot.why_read, evidence });
  }
  return RenderPacketSchema.parse({ schema_version: '0.1.0', question_key: questionKey, lens, cards, empty_slots, warnings: readingSet.warnings });
}
