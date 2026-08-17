import { EvidenceSpan, EvidenceSpanSchema, ExperienceRecord } from './contracts.js';

export type EvidenceIssue = { code: 'SOURCE_MISMATCH' | 'RANGE_INVALID' | 'QUOTE_MISMATCH' | 'SCHEMA_INVALID'; evidence_id?: string; message: string };

export function validateEvidenceSpan(sourceText: string, sourceId: string, span: EvidenceSpan): EvidenceIssue[] {
  const issues: EvidenceIssue[] = [];
  if (span.source_id !== sourceId) issues.push({ code: 'SOURCE_MISMATCH', evidence_id: span.evidence_id, message: 'Evidence source_id does not match source document' });
  if (span.start < 0 || span.end > sourceText.length || span.end <= span.start) issues.push({ code: 'RANGE_INVALID', evidence_id: span.evidence_id, message: 'Evidence range is outside source text' });
  if (issues.length === 0 && sourceText.slice(span.start, span.end) !== span.quote) issues.push({ code: 'QUOTE_MISMATCH', evidence_id: span.evidence_id, message: 'Evidence quote does not match source text at the supplied range' });
  return issues;
}

export function validateExperienceEvidence(sourceText: string, sourceId: string, record: ExperienceRecord): EvidenceIssue[] {
  const issues: EvidenceIssue[] = [];
  const spans: EvidenceSpan[] = [];
  if (record.decision) spans.push(record.decision.evidence);
  for (const item of record.pre_decision_context) spans.push(item.evidence);
  spans.push(...record.outcomes);
  if (record.reflection) spans.push(record.reflection);
  for (const span of spans) {
    const parsed = EvidenceSpanSchema.safeParse(span);
    if (!parsed.success) issues.push({ code: 'SCHEMA_INVALID', evidence_id: span.evidence_id, message: parsed.error.message });
    else issues.push(...validateEvidenceSpan(sourceText, sourceId, span));
  }
  return issues;
}
