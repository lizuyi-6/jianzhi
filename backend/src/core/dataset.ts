import { readFile } from 'node:fs/promises';
import { SourceDocument, SourceDocumentSchema } from './contracts.js';

export async function loadSourceDocuments(path: string): Promise<SourceDocument[]> {
  const text = await readFile(path, 'utf8');
  const rows: SourceDocument[] = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let raw: unknown;
    try { raw = JSON.parse(line); } catch (error) { throw new Error('Invalid JSONL at line ' + (index + 1) + ': ' + String(error)); }
    const parsed = SourceDocumentSchema.safeParse(raw);
    if (!parsed.success) throw new Error('Invalid SourceDocument at line ' + (index + 1) + ': ' + parsed.error.message);
    rows.push(parsed.data);
  }
  const ids = new Set<string>();
  for (const row of rows) { if (ids.has(row.source_id)) throw new Error('Duplicate source_id: ' + row.source_id); ids.add(row.source_id); }
  return rows;
}
