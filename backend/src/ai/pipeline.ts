import { FileCache, stableCacheKey } from '../core/cache.js';
import { ExperienceRecord, SourceDocument } from '../core/contracts.js';
import { ExtractionModel } from './model.js';
import { Qualification, qualifySource } from './qualify.js';
import { EXTRACTION_PROMPT_VERSION, buildExtractionPrompt, parseModelOutput } from './extraction.js';

// Qualification -> LLM-1 Extraction -> LLM-2 Normalization -> Evidence Validator -> Cache
// 每个来源的处理结果都要么是一条通过 Evidence 校验的 ExperienceRecord，要么是带阶段与原因的拒绝。
export interface PipelineOutcome {
  source_id: string;
  quality: Qualification;
  status: 'extracted' | 'rejected' | 'failed';
  stage?: 'qualify' | 'model' | 'parse' | 'validate';
  reason?: string;
  cached?: boolean;
  record?: ExperienceRecord;
}

export interface PipelineReport {
  prompt_version: string;
  model: string;
  total: number;
  extracted: number;
  rejected: number;
  failed: number;
  outcomes: PipelineOutcome[];
}

export interface PipelineOptions {
  sources: SourceDocument[];
  model: ExtractionModel;
  cache?: FileCache;
  /** E2 以下直接拒绝（数据门资格线） */
  minQuality?: 'E2' | 'E3';
}

const ORDER: Record<string, number> = { E0: 0, E1: 1, E2: 2, E3: 3 };

export async function runExtractionPipeline(options: PipelineOptions): Promise<PipelineReport> {
  const min = ORDER[options.minQuality ?? 'E2']!;
  const outcomes: PipelineOutcome[] = [];
  for (const source of options.sources) {
    const quality = qualifySource(source);
    if (ORDER[quality.label]! < min) {
      outcomes.push({ source_id: source.source_id, quality, status: 'rejected', stage: 'qualify', reason: quality.reasons.join('; ') });
      continue;
    }
    const cacheKey = stableCacheKey('extraction', { v: EXTRACTION_PROMPT_VERSION, model: options.model.name, source_id: source.source_id });
    let raw: string | null = options.cache ? await options.cache.get<string>(cacheKey) : null;
    const cached = raw !== null;
    try {
      if (!raw) {
        raw = await options.model.extract(source, buildExtractionPrompt(source));
        if (options.cache) await options.cache.set(cacheKey, raw);
      }
      const result = parseModelOutput(source, raw);
      if (!result.record) {
        outcomes.push({ source_id: source.source_id, quality, status: 'rejected', stage: 'validate', reason: result.dropped.map((d) => d.reason).join('; '), cached });
      } else {
        outcomes.push({ source_id: source.source_id, quality, status: 'extracted', record: result.record, cached });
      }
    } catch (error) {
      outcomes.push({ source_id: source.source_id, quality, status: 'failed', stage: 'model', reason: String(error), cached });
    }
  }
  return {
    prompt_version: EXTRACTION_PROMPT_VERSION,
    model: options.model.name,
    total: outcomes.length,
    extracted: outcomes.filter((o) => o.status === 'extracted').length,
    rejected: outcomes.filter((o) => o.status === 'rejected').length,
    failed: outcomes.filter((o) => o.status === 'failed').length,
    outcomes,
  };
}
