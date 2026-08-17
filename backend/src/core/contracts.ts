import { z } from 'zod';

export const schemaVersion = '0.1.0' as const;

export const EvidenceSpanSchema = z.object({
  evidence_id: z.string().min(1),
  source_id: z.string().min(1),
  quote: z.string().min(1),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  field: z.string().min(1),
}).refine((value) => value.end > value.start, 'Evidence end must be greater than start');
export type EvidenceSpan = z.infer<typeof EvidenceSpanSchema>;

export const PlatformSignalsSchema = z.object({
  relevance: z.number().nullable().optional(),
  authority: z.union([z.string(), z.number()]).nullable().optional(),
  vote_count: z.number().int().nonnegative().nullable().optional(),
  comment_count: z.number().int().nonnegative().nullable().optional(),
});

export const SourceDocumentSchema = z.object({
  source_id: z.string().min(1),
  source_type: z.enum(['answer', 'article', 'comment']),
  question_id: z.string().nullable().optional(),
  question_title: z.string().min(1),
  author: z.object({ id: z.string().nullable().optional(), name: z.string().nullable().optional() }),
  published_at: z.string().nullable().optional(),
  text: z.string(),
  url: z.string().url(),
  platform_signals: PlatformSignalsSchema,
  source_mode: z.enum(['official_api', 'official_api_search', 'fixture']),
  retrieved_at: z.string().datetime({ offset: true }).optional(),
  retrieved_queries: z.array(z.string()).optional(),
  retrieved_ranks: z.array(z.number().int().positive()).optional(),
});
export type SourceDocument = z.infer<typeof SourceDocumentSchema>;

export const KnowledgeTypeSchema = z.enum(['EXPERIENCE', 'OUTCOME', 'REFLECTION', 'ANALYSIS', 'GENERAL_OPINION']);
export const DecisionSchema = z.object({
  value: z.enum(['WORK', 'GRAD_SCHOOL', 'CONDITIONAL', 'NO_CLEAR_DECISION']),
  evidence: EvidenceSpanSchema,
});
export const ContextFactSchema = z.object({
  dimension_id: z.string().min(1),
  semantic_family: z.string().min(1),
  value: z.string().min(1),
  evidence: EvidenceSpanSchema,
});
export const ExperienceRecordSchema = z.object({
  schema_version: z.literal(schemaVersion),
  source_id: z.string().min(1),
  knowledge_types: z.array(KnowledgeTypeSchema),
  decision: DecisionSchema.nullable(),
  pre_decision_context: z.array(ContextFactSchema),
  outcomes: z.array(EvidenceSpanSchema),
  reflection: EvidenceSpanSchema.nullable(),
  unknown_dimensions: z.array(z.string()),
});
export type ExperienceRecord = z.infer<typeof ExperienceRecordSchema>;

export const DiscussionDimensionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  semantic_family: z.string().min(1),
  observed_values: z.array(z.string()).min(1),
  supporting_sources: z.array(z.string()),
  counterexample_sources: z.array(z.string()),
  user_answerable: z.boolean(),
});
export const DiscussionLensSchema = z.object({
  schema_version: z.literal(schemaVersion),
  question_key: z.string().min(1),
  dimensions: z.array(DiscussionDimensionSchema).min(0).max(4),
});
export type DiscussionLens = z.infer<typeof DiscussionLensSchema>;

export const CurrentDecisionContextSchema = z.object({
  schema_version: z.literal(schemaVersion),
  question_key: z.string().min(1),
  values: z.record(z.string()),
  user_rejected_dimensions: z.array(z.string()),
  custom_condition: z.string().nullable(),
});
export type CurrentDecisionContext = z.infer<typeof CurrentDecisionContextSchema>;

export const ComparisonResultSchema = z.object({
  schema_version: z.literal(schemaVersion),
  source_id: z.string().min(1),
  same: z.array(z.string()),
  different: z.array(z.string()),
  unknown: z.array(z.string()),
  comparable_eligible: z.boolean(),
  explanation_facts: z.array(z.object({ type: z.enum(['SAME', 'DIFFERENT', 'UNKNOWN']), dimension: z.string(), source_evidence_id: z.string().min(1) })),
});
export type ComparisonResult = z.infer<typeof ComparisonResultSchema>;

export const ReadingSlotSchema = z.object({
  role: z.enum(['COMPARABLE', 'COUNTER_EXPERIENCE', 'CLASSIC']),
  source_id: z.string().min(1),
  why_read: z.array(z.string()),
  evidence_ids: z.array(z.string()),
}).nullable();
export const ReadingSetSchema = z.object({
  schema_version: z.literal(schemaVersion),
  question_key: z.string().min(1),
  slot_a: ReadingSlotSchema,
  slot_b: ReadingSlotSchema,
  slot_c: ReadingSlotSchema,
  warnings: z.array(z.string()),
});
export type ReadingSet = z.infer<typeof ReadingSetSchema>;


export const RenderEvidenceSchema = z.object({
  evidence_id: z.string().min(1), source_id: z.string().min(1), quote: z.string().min(1), start: z.number().int().nonnegative(), end: z.number().int().positive(), field: z.string().min(1),
});
export const RenderCardSchema = z.object({
  role: z.enum(['COMPARABLE', 'COUNTER_EXPERIENCE', 'CLASSIC']), source_id: z.string().min(1), title: z.string().min(1), url: z.string().url(),
  same_dimensions: z.array(z.string()), different_dimensions: z.array(z.string()), unknown_dimensions: z.array(z.string()),
  why_read_codes: z.array(z.string()), evidence: z.array(RenderEvidenceSchema),
});
export const RenderPacketSchema = z.object({
  schema_version: z.literal(schemaVersion), question_key: z.string().min(1), lens: DiscussionLensSchema, cards: z.array(RenderCardSchema), empty_slots: z.array(z.enum(['COMPARABLE', 'COUNTER_EXPERIENCE', 'CLASSIC'])), warnings: z.array(z.string()),
});
export type RenderPacket = z.infer<typeof RenderPacketSchema>;

export const ErrorCodeSchema = z.enum([
  'INSUFFICIENT_TEXT', 'NO_USABLE_EXPERIENCE', 'NO_RELIABLE_DIMENSION',
  'NO_COMPARABLE_EXPERIENCE', 'NO_COUNTER_EXPERIENCE', 'USER_CONDITION_UNCOVERED',
  'RATE_LIMITED', 'RENDER_PACKET_INVALID', 'INVALID_EVIDENCE',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
