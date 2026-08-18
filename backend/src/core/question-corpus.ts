import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { schemaVersion } from './contracts.js';

// P1-01：question_key -> corpus 的显式映射。透镜分析永远只吃该问题绑定的一次决策事件语料，
// 不再「传任何 question_key 都分析全量 ExperienceStore」。
export const QuestionCorpusSchema = z.object({
  schema_version: z.literal(schemaVersion),
  questions: z.record(z.object({
    title: z.string().min(1),
    decision_event: z.string().min(1),
    source_ids: z.array(z.string()).min(1),
  })),
});
export type QuestionCorpus = z.infer<typeof QuestionCorpusSchema>;

export const GOLDEN_QUESTION_KEY = 'golden-cs-offer-work-or-grad';

export async function loadQuestionCorpus(path?: string): Promise<QuestionCorpus | null> {
  const file = path ?? resolve(process.cwd(), process.env.DATA_DIR ?? 'data', 'question-corpus.json');
  let text: string;
  try { text = await readFile(file, 'utf8'); }
  catch { return null; }
  const parsed = QuestionCorpusSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error('INVALID_QUESTION_CORPUS: ' + parsed.error.message);
  return parsed.data;
}
