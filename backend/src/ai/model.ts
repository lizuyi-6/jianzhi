import { readFile } from 'node:fs/promises';
import { SourceDocument } from '../core/contracts.js';

// P0-07：真实的模型接入层。AI/Data Contract 的 LLM-1/LLM-2 都通过这里调用；
// Golden 语料走 ReplayModel（缓存回放，离线确定性），线上增量走 OpenAICompatibleModel。

export interface ExtractionModel {
  readonly name: string;
  extract(source: SourceDocument, prompt: string): Promise<string>;
}

export class OpenAICompatibleModel implements ExtractionModel {
  constructor(private readonly opts: { baseUrl: string; apiKey: string; model: string; timeoutMs?: number }) {
    if (!opts.baseUrl || !opts.apiKey || !opts.model) throw new Error('MODEL_ADAPTER_NOT_CONFIGURED');
  }
  get name() { return 'openai-compatible:' + this.opts.model; }
  async extract(source: SourceDocument, prompt: string): Promise<string> {
    const system = '你是严格的信息抽取引擎，只输出合法 JSON，不输出解释文字。';
    const response = await fetch(this.opts.baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + this.opts.apiKey },
      body: JSON.stringify({ model: this.opts.model, temperature: 0.1, max_tokens: 2048, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 45_000),
    });
    if (response.status === 401 || response.status === 403) throw new Error('MODEL_AUTH_FAILED');
    if (response.status === 429) throw new Error('RATE_LIMITED');
    if (!response.ok) throw new Error('MODEL_HTTP_' + response.status);
    const data: unknown = await response.json();
    const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('MODEL_EMPTY_RESPONSE');
    return content;
  }
}

export interface ReplayEntry { source_id: string; prompt_version: string; model: string; created_at: string; response: string; reviewed?: boolean }

export class ReplayModel implements ExtractionModel {
  readonly name: string;
  private readonly entries = new Map<string, ReplayEntry>();
  constructor(lines: string[], readonly promptVersion: string, name = 'replay:golden-reviewed') {
    for (const line of lines) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as ReplayEntry;
      if (row.prompt_version !== this.promptVersion) continue;
      this.entries.set(row.source_id, row);
    }
    this.name = name;
  }
  static async load(path: string, promptVersion: string): Promise<ReplayModel> {
    let text = '';
    try { text = await readFile(path, 'utf8'); }
    catch { throw new Error('REPLAY_CACHE_NOT_FOUND: ' + path); }
    return new ReplayModel(text.split(/\r?\n/), promptVersion);
  }
  has(sourceId: string): boolean { return this.entries.has(sourceId); }
  reviewedCount(): number { return [...this.entries.values()].filter((entry) => entry.reviewed).length; }
  async extract(source: SourceDocument): Promise<string> {
    const entry = this.entries.get(source.source_id);
    if (!entry) throw new Error('MODEL_CACHE_MISS: ' + source.source_id);
    return entry.response;
  }
}

export function createOpenAiModelFromEnv(): OpenAICompatibleModel | null {
  const baseUrl = process.env.MODEL_BASE_URL;
  const apiKey = process.env.MODEL_API_KEY;
  const model = process.env.MODEL_NAME;
  if (baseUrl && apiKey && model) return new OpenAICompatibleModel({ baseUrl, apiKey, model });
  return null;
}
