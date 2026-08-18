// 与 backend/src/core/contracts.ts 对齐的前端类型（只读消费，不复制比较逻辑）

export interface EvidenceSpan {
  evidence_id: string;
  source_id: string;
  quote: string;
  start: number;
  end: number;
  field: string;
}

export interface SupportExample {
  source_id: string;
  value: string;
  decision: string;
  evidence_id: string;
  quote: string;
}

export interface DiscussionDimension {
  id: string;
  label: string;
  semantic_family: string;
  observed_values: string[];
  supporting_sources: string[];
  counterexample_sources: string[];
  user_answerable: boolean;
  support_examples: SupportExample[];
}

export interface DiscussionLens {
  schema_version: string;
  question_key: string;
  dimensions: DiscussionDimension[];
}

export type Role = 'COMPARABLE' | 'COUNTER_EXPERIENCE' | 'CLASSIC';

export interface DifferentFact {
  dimension: string;
  user_value: string;
  source_value: string;
  evidence_id: string;
}

export interface QualitySignals {
  vote_count: number | null;
  comment_count: number | null;
  authority: string | number | null;
}

export interface RenderCard {
  role: Role;
  source_id: string;
  title: string;
  url: string;
  same_dimensions: string[];
  different_dimensions: string[];
  unknown_dimensions: string[];
  different_facts: DifferentFact[];
  quality_signals: QualitySignals;
  why_read_codes: string[];
  evidence: EvidenceSpan[];
}

export interface RenderPacket {
  schema_version: string;
  question_key: string;
  lens: DiscussionLens;
  cards: RenderCard[];
  empty_slots: Role[];
  warnings: string[];
}

export interface SourceDocument {
  source_id: string;
  source_type: 'answer' | 'article' | 'comment';
  question_id?: string | null;
  question_title: string;
  author: { id?: string | null; name?: string | null };
  published_at?: string | null;
  text: string;
  url: string;
  platform_signals: {
    relevance?: number | null;
    authority?: string | number | null;
    vote_count?: number | null;
    comment_count?: number | null;
  };
  source_mode: 'official_api' | 'official_api_search' | 'fixture';
  retrieved_at?: string;
  retrieved_queries?: string[];
  retrieved_ranks?: number[];
}

export interface Meta {
  schema_version: string;
  search_adapter: boolean;
  source_count: number;
  lens: { experience_records: number; ready: boolean };
  corpus?: { questions: Array<{ key: string; title: string; decision_event: string; source_ids: number }> };
  pipeline?: { extraction_prompt_version: string; replay_cache: string; live_model: boolean };
  capabilities: string[];
}

export type SearchMode = 'official_api_search' | 'cache' | 'local_fallback';

export interface SearchResponse {
  sources: SourceDocument[];
  has_more: boolean;
  cached: boolean;
  mode?: SearchMode;
  degraded_reason?: string;
}

export interface ApiError {
  code: string;
  message: string;
  request_id: string;
  retryable: boolean;
}
