// P0-07 的可执行入口：Qualification -> ModelAdapter(LLM-1) -> Normalization(LLM-2) -> Evidence Validator -> Cache
// 默认 --replay：从 data/extraction-cache.jsonl 回放（离线、确定性、无配额消耗），重建 Golden 语料。
// --live 需要 MODEL_BASE_URL / MODEL_API_KEY / MODEL_NAME，真实调用并写入运行时缓存。
import { rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FileCache } from '../core/cache.js';
import { loadSourceDocuments } from '../core/dataset.js';
import { ExperienceStore } from '../core/experience-store.js';
import { loadQuestionCorpus } from '../core/question-corpus.js';
import { EXTRACTION_PROMPT_VERSION } from '../ai/extraction.js';
import { ReplayModel, createOpenAiModelFromEnv, type ExtractionModel } from '../ai/model.js';
import { runExtractionPipeline } from '../ai/pipeline.js';

const argv = process.argv.slice(2);
const valueOf = (flag: string): string | undefined => { const index = argv.indexOf(flag); return index >= 0 ? argv[index + 1] : undefined; };
const mode = argv.includes('--live') ? 'live' : 'replay';
const all = argv.includes('--all');
const questionKey = valueOf('--question') ?? 'golden-cs-offer-work-or-grad';
const outArg = valueOf('--out');
const dataDir = resolve(process.cwd(), process.env.DATA_DIR ?? 'data');
const out = resolve(process.cwd(), outArg ?? 'data/experience-records.jsonl');

const sources = await loadSourceDocuments(resolve(dataDir, 'source-documents.jsonl'));
const corpus = await loadQuestionCorpus(resolve(dataDir, 'question-corpus.json'));
const corpusEntry = corpus?.questions[questionKey];
const targetIds = all || !corpusEntry ? null : corpusEntry.source_ids;
const targets = targetIds ? sources.filter((source) => targetIds.includes(source.source_id)) : sources;

let model: ExtractionModel;
if (mode === 'live') {
  const live = createOpenAiModelFromEnv();
  if (!live) { console.error('LIVE 模式需要 MODEL_BASE_URL / MODEL_API_KEY / MODEL_NAME'); process.exit(2); }
  model = live;
} else {
  model = await ReplayModel.load(resolve(dataDir, 'extraction-cache.jsonl'), EXTRACTION_PROMPT_VERSION);
}

const liveCache = mode === 'live' ? new FileCache(resolve(process.cwd(), '.cache', 'extractions')) : undefined;
const report = await runExtractionPipeline({ sources: targets, model, ...(liveCache ? { cache: liveCache } : {}), minQuality: 'E2' });

const records = report.outcomes.filter((outcome) => outcome.status === 'extracted' && outcome.record).map((outcome) => outcome.record!);
if (!records.length) { console.error(JSON.stringify({ ...report, outcomes: undefined, status: 'NO_VALIDATED_RECORDS' }, null, 2)); process.exit(2); }

const temp = out + '.tmp-' + process.pid;
await writeFile(temp, records.map((record) => JSON.stringify(record)).join('\n') + '\n', 'utf8');
await ExperienceStore.load(temp, sources);
await rename(temp, out);

const missing = targetIds ? targetIds.filter((id) => !records.some((record) => record.source_id === id)) : [];
console.log(JSON.stringify({
  mode, model: report.model, prompt_version: report.prompt_version,
  question_key: questionKey, targeted: targets.length,
  extracted: report.extracted, rejected: report.rejected, failed: report.failed,
  corpus_missing: missing,
  rejections: report.outcomes.filter((o) => o.status !== 'extracted').map((o) => ({ source_id: o.source_id, stage: o.stage, reason: (o.reason ?? '').slice(0, 140) })),
  output: out,
}, null, 2));
if (mode === 'replay' && missing.length) process.exit(2);
