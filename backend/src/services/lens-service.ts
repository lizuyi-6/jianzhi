import { CurrentDecisionContext, ReadingSet, RenderPacket, SourceDocument, schemaVersion } from '../core/contracts.js';
import { buildRenderPacket } from '../core/render.js';
import { computeDimensionCandidates, discoverDiscussionLens } from '../core/contrast.js';
import { ExperienceStore } from '../core/experience-store.js';
import { retrieveReadingSet } from '../core/retrieve.js';
import { QuestionCorpus } from '../core/question-corpus.js';

export class LensService {
  constructor(private readonly store: ExperienceStore, private readonly sources: SourceDocument[], private readonly corpus: QuestionCorpus | null = null) {}

  status() { return { experience_records: this.store.count(), ready: this.store.count() > 0 }; }

  corpusStatus() {
    const questions = this.corpus ? Object.entries(this.corpus.questions).map(([key, entry]) => ({ key, title: entry.title, decision_event: entry.decision_event, source_ids: entry.source_ids.length })) : [];
    return { questions, active_question_keys: questions.map((q) => q.key) };
  }

  // P1-01：显式 corpus 优先级：请求 source_ids > question_key 对应 corpus > 全量（并告警）
  private recordsFor(questionKey: string, sourceIds?: string[]): { records: ReturnType<ExperienceStore['all']>; scoped: boolean } {
    if (sourceIds?.length) return { records: this.store.select(sourceIds), scoped: true };
    const entry = this.corpus?.questions[questionKey];
    if (entry) {
      const records = this.store.select(entry.source_ids);
      const missing = entry.source_ids.filter((id) => !records.some((record) => record.source_id === id));
      if (missing.length) throw new Error('CORPUS_INCOMPLETE: ' + missing.join(','));
      return { records, scoped: true };
    }
    return { records: this.store.all(), scoped: false };
  }

  private lensOrThrow(questionKey: string, records: ReturnType<ExperienceStore['all']>) {
    const lens = discoverDiscussionLens(questionKey, records);
    if (!lens.dimensions.length) throw new Error('NO_RELIABLE_DIMENSION');
    return lens;
  }

  buildLens(questionKey: string, sourceIds?: string[]) {
    const { records } = this.recordsFor(questionKey, sourceIds);
    if (!records.length) throw new Error('NO_USABLE_EXPERIENCE');
    return this.lensOrThrow(questionKey, records);
  }

  buildReadingSet(questionKey: string, values: Record<string, string>, rejected: string[] = [], custom: string | null = null, sourceIds?: string[]): ReadingSet {
    const { records } = this.recordsFor(questionKey, sourceIds);
    if (!records.length) throw new Error('NO_USABLE_EXPERIENCE');
    const lens = this.lensOrThrow(questionKey, records);
    const context: CurrentDecisionContext = { schema_version: schemaVersion, question_key: questionKey, values, user_rejected_dimensions: rejected, custom_condition: custom };
    return retrieveReadingSet(records, this.sources, context, lens);
  }

  buildRenderPacket(questionKey: string, values: Record<string, string>, rejected: string[] = [], custom: string | null = null, sourceIds?: string[]): RenderPacket {
    const { records } = this.recordsFor(questionKey, sourceIds);
    if (!records.length) throw new Error('NO_USABLE_EXPERIENCE');
    const lens = this.lensOrThrow(questionKey, records);
    const context: CurrentDecisionContext = { schema_version: schemaVersion, question_key: questionKey, values, user_rejected_dimensions: rejected, custom_condition: custom };
    const readingSet = retrieveReadingSet(records, this.sources, context, lens);
    return buildRenderPacket(questionKey, lens, readingSet, records, this.sources, context);
  }

  // 供 eval / 调试：带统计量的候选维度
  dimensionCandidates(questionKey: string, sourceIds?: string[]) {
    const { records } = this.recordsFor(questionKey, sourceIds);
    return computeDimensionCandidates(records);
  }
}
