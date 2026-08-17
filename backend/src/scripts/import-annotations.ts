import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { ExperienceRecordSchema } from '../core/contracts.js';
import { loadSourceDocuments } from '../core/dataset.js';
import { ExperienceStore } from '../core/experience-store.js';

const input = resolve(process.argv[2] ?? '../.analysis/data-gate/m0-02/annotation_queue.jsonl');
const output = resolve(process.argv[3] ?? 'data/experience-records.jsonl');
const RowSchema = z.object({ source_id: z.string(), annotation: z.object({ quality: z.enum(['', 'E0', 'E1', 'E2', 'E3']), experience_record: ExperienceRecordSchema.optional() }).passthrough() }).passthrough();
const lines = (await readFile(input, 'utf8')).split(/\r?\n/).filter(Boolean);
const records = [];
const skipped: Record<string, number> = { E0: 0, E1: 0, unlabelled: 0, missing_record: 0 };
for (const [index, line] of lines.entries()) {
  const row = RowSchema.parse(JSON.parse(line)); const quality = row.annotation.quality;
  if (quality !== 'E2' && quality !== 'E3') { skipped[quality || 'unlabelled'] = (skipped[quality || 'unlabelled'] ?? 0) + 1; continue; }
  if (!row.annotation.experience_record) { skipped.missing_record = (skipped.missing_record ?? 0) + 1; continue; }
  if (row.annotation.experience_record.source_id !== row.source_id) throw new Error('SOURCE_ID_MISMATCH at line ' + (index + 1));
  records.push(row.annotation.experience_record);
}
if (!records.length) { console.error(JSON.stringify({ imported: 0, skipped, status: 'NO_VALIDATED_E2_E3_RECORDS' }, null, 2)); process.exitCode = 2; }
else {
  const temp = output + '.tmp-' + process.pid; await writeFile(temp, records.map((record) => JSON.stringify(record)).join('\n') + '\n', 'utf8');
  const sources = await loadSourceDocuments(resolve('../.analysis/data-gate/m0-02/source_documents.jsonl'));
  await ExperienceStore.load(temp, sources); await rename(temp, output);
  console.log(JSON.stringify({ imported: records.length, skipped, output }, null, 2));
}
