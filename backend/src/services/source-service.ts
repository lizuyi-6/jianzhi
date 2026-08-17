import { resolve } from 'node:path';
import { FileCache, stableCacheKey } from '../core/cache.js';
import { SourceDocument } from '../core/contracts.js';
import { loadSourceDocuments } from '../core/dataset.js';
import { ZhihuSearchAdapter } from '../adapters/zhihu-search.js';

export class SourceService {
  private readonly localSourcesPromise: Promise<SourceDocument[]>;
  constructor(private readonly cache: FileCache, private readonly adapter?: ZhihuSearchAdapter) {
    this.localSourcesPromise = loadSourceDocuments(resolve(process.cwd(), 'data/source-documents.jsonl')).catch(() => []);
  }
  async allLocal(): Promise<SourceDocument[]> { return [...await this.localSourcesPromise]; }
  async listLocal(limit = 50, offset = 0): Promise<SourceDocument[]> { return (await this.localSourcesPromise).slice(offset, offset + Math.min(limit, 100)); }
  async getLocal(sourceId: string): Promise<SourceDocument | null> { return (await this.localSourcesPromise).find((source) => source.source_id === sourceId) ?? null; }
  async search(query: string, count = 10, refresh = false): Promise<{ sources: SourceDocument[]; has_more: boolean; cached: boolean }> {
    if (!this.adapter) throw new Error('SEARCH_ADAPTER_NOT_CONFIGURED');
    const key = stableCacheKey('source-search-v1', { query, count: Math.min(count, 10) });
    if (!refresh) { const cached = await this.cache.get<{ sources: SourceDocument[]; has_more: boolean }>(key); if (cached) return { ...cached, cached: true }; }
    const result = await this.adapter.search({ query, count });
    const value = { sources: result.sources, has_more: result.has_more };
    await this.cache.set(key, value);
    return { ...value, cached: false };
  }
}
