// 生成 Golden 的 LLM 输出缓存（P0-07）：把人工复核过的抽取规格物化为
// data/extraction-cache.jsonl（模型输出形态，reviewed=true），并写入 data/question-corpus.json。
// 之后 npm run extract -- --replay 会走真实管线（prompt -> 回放 -> 归一化 -> 证据校验）重建 experience-records.jsonl。
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadSourceDocuments } from '../core/dataset.js';
import { EXTRACTION_PROMPT_VERSION } from '../ai/extraction.js';
import { GOLDEN_DECISION_EVENT, GOLDEN_QUESTION_KEY, GOLDEN_RECORDS, GOLDEN_TITLE } from './golden-corpus.js';

const dataDir = resolve(process.cwd(), process.env.DATA_DIR ?? 'data');
const sources = await loadSourceDocuments(resolve(dataDir, 'source-documents.jsonl'));
const byId = new Map(sources.map((source) => [source.source_id, source]));

const rows: string[] = [];
for (const spec of GOLDEN_RECORDS) {
  const source = byId.get(spec.source_id);
  if (!source) throw new Error('GOLDEN_SOURCE_NOT_FOUND: ' + spec.source_id);
  const locate = (anchor: RegExp, label: string): string => {
    const match = anchor.exec(source.text);
    if (!match) throw new Error('ANCHOR_NOT_FOUND ' + spec.source_id + ' ' + label + ': ' + String(anchor));
    return match[0];
  };
  const raw = {
    knowledge_types: spec.knowledge_types,
    decision: { value: spec.decision.value, quote: locate(spec.decision.anchor, 'decision') },
    pre_decision_context: spec.facts.map((fact) => ({ dimension_id: fact.dimension_id, value: fact.value, quote: locate(fact.anchor, fact.dimension_id) })),
    outcome_quotes: [] as string[],
    reflection_quote: spec.reflection_anchor ? locate(spec.reflection_anchor, 'reflection') : null,
  };
  rows.push(JSON.stringify({
    source_id: spec.source_id,
    prompt_version: EXTRACTION_PROMPT_VERSION,
    model: 'golden-reviewed-v1',
    created_at: new Date().toISOString(),
    reviewed: true,
    review_note: spec.event_note,
    response: JSON.stringify(raw),
  }));
}

await mkdir(dataDir, { recursive: true });
await writeFile(resolve(dataDir, 'extraction-cache.jsonl'), rows.join('\n') + '\n', 'utf8');
await writeFile(resolve(dataDir, 'question-corpus.json'), JSON.stringify({
  schema_version: '0.1.0',
  questions: {
    [GOLDEN_QUESTION_KEY]: {
      title: GOLDEN_TITLE,
      decision_event: GOLDEN_DECISION_EVENT,
      source_ids: GOLDEN_RECORDS.map((spec) => spec.source_id),
    },
  },
}, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ cache_entries: rows.length, corpus_question: GOLDEN_QUESTION_KEY, sources: sources.length }, null, 2));
