import { readFile } from 'node:fs/promises';
import { ExperienceRecord, ExperienceRecordSchema, SourceDocument } from './contracts.js';
import { validateExperienceEvidence } from './evidence.js';

export class ExperienceStore {
  private constructor(private readonly records: ExperienceRecord[]) {}
  static async load(path: string, sources: SourceDocument[]): Promise<ExperienceStore> {
    let text: string;
    try { text = await readFile(path, 'utf8'); }
    catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new ExperienceStore([]); throw error; }
    const sourceById = new Map(sources.map((source) => [source.source_id, source]));
    const records: ExperienceRecord[] = [];
    const ids = new Set<string>();
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      if (!line.trim()) continue;
      const parsed = ExperienceRecordSchema.safeParse(JSON.parse(line));
      if (!parsed.success) throw new Error('INVALID_EXPERIENCE_RECORD line ' + (index + 1) + ': ' + parsed.error.message);
      const source = sourceById.get(parsed.data.source_id);
      if (!source) throw new Error('EXPERIENCE_SOURCE_NOT_FOUND: ' + parsed.data.source_id);
      const issues = validateExperienceEvidence(source.text, source.source_id, parsed.data);
      if (issues.length) throw new Error('INVALID_EVIDENCE: ' + JSON.stringify(issues));
      if (ids.has(parsed.data.source_id)) throw new Error('DUPLICATE_EXPERIENCE_RECORD: ' + parsed.data.source_id);
      ids.add(parsed.data.source_id); records.push(parsed.data);
    }
    return new ExperienceStore(records);
  }
  all(): ExperienceRecord[] { return [...this.records]; }
  select(sourceIds?: string[]): ExperienceRecord[] {
    if (!sourceIds?.length) return this.all();
    const wanted = new Set(sourceIds); return this.records.filter((record) => wanted.has(record.source_id));
  }
  count(): number { return this.records.length; }
}
