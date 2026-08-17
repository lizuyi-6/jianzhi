import { CurrentDecisionContext, ReadingSet, RenderPacket, SourceDocument, schemaVersion } from '../core/contracts.js';
import { buildRenderPacket } from '../core/render.js';
import { discoverDiscussionLens } from '../core/contrast.js';
import { ExperienceStore } from '../core/experience-store.js';
import { retrieveReadingSet } from '../core/retrieve.js';

export class LensService {
  constructor(private readonly store: ExperienceStore, private readonly sources: SourceDocument[]) {}
  status() { return { experience_records: this.store.count(), ready: this.store.count() > 0 }; }
  buildLens(questionKey: string, sourceIds?: string[]) {
    const records = this.store.select(sourceIds); if (!records.length) throw new Error('NO_USABLE_EXPERIENCE');
    const lens = discoverDiscussionLens(questionKey, records); if (!lens.dimensions.length) throw new Error('NO_RELIABLE_DIMENSION');
    return lens;
  }
  buildReadingSet(questionKey: string, values: Record<string, string>, rejected: string[] = [], custom: string | null = null, sourceIds?: string[]): ReadingSet {
    const records = this.store.select(sourceIds); if (!records.length) throw new Error('NO_USABLE_EXPERIENCE');
    const lens = discoverDiscussionLens(questionKey, records); if (!lens.dimensions.length) throw new Error('NO_RELIABLE_DIMENSION');
    const context: CurrentDecisionContext = { schema_version: schemaVersion, question_key: questionKey, values, user_rejected_dimensions: rejected, custom_condition: custom };
    return retrieveReadingSet(records, this.sources, context, lens);
  }
  buildRenderPacket(questionKey: string, values: Record<string, string>, rejected: string[] = [], custom: string | null = null, sourceIds?: string[]): RenderPacket {
    const records = this.store.select(sourceIds); if (!records.length) throw new Error('NO_USABLE_EXPERIENCE');
    const lens = discoverDiscussionLens(questionKey, records); if (!lens.dimensions.length) throw new Error('NO_RELIABLE_DIMENSION');
    const context: CurrentDecisionContext = { schema_version: schemaVersion, question_key: questionKey, values, user_rejected_dimensions: rejected, custom_condition: custom };
    const readingSet = retrieveReadingSet(records, this.sources, context, lens);
    return buildRenderPacket(questionKey, lens, readingSet, records, this.sources, values);
  }
}
