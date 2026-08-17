import { resolve } from 'node:path';
import { loadSourceDocuments } from '../core/dataset.js';

const path = resolve(process.cwd(), 'data/source-documents.jsonl');
const rows = await loadSourceDocuments(path);
const counts = rows.reduce<Record<string, number>>((acc, row) => { acc[row.source_type] = (acc[row.source_type] ?? 0) + 1; return acc; }, {});
console.log(JSON.stringify({ valid: true, sources: rows.length, source_types: counts, path }, null, 2));
