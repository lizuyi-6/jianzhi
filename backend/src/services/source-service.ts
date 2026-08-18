import { resolve } from 'node:path';
import { FileCache, stableCacheKey } from '../core/cache.js';
import { SourceDocument } from '../core/contracts.js';
import { loadSourceDocuments } from '../core/dataset.js';
import { ZhihuSearchAdapter } from '../adapters/zhihu-search.js';

export type SearchMode = 'official_api_search' | 'cache' | 'local_fallback';
export interface SearchResponse {
  sources: SourceDocument[];
  has_more: boolean;
  cached: boolean;
  mode: SearchMode;
  degraded_reason?: string;
}

// P1-02：实时结果注册表——live 搜索命中的来源可被 /sources/:id 解析，不再 404。
export class LiveSourceRegistry {
  private readonly map = new Map<string, SourceDocument>();
  register(sources: SourceDocument[]): void {
    for (const source of sources) {
      this.map.set(source.source_id, source);
      if (this.map.size > 500) this.map.delete(this.map.keys().next().value as string);
    }
  }
  get(sourceId: string): SourceDocument | null { return this.map.get(sourceId) ?? null; }
}

export class SourceService {
  private readonly localSourcesPromise: Promise<SourceDocument[]>;
  readonly live = new LiveSourceRegistry();
  constructor(private readonly cache: FileCache, private readonly adapter?: ZhihuSearchAdapter, dataDir = resolve(process.cwd(), process.env.DATA_DIR ?? 'data')) {
    // P2-03：与 ExperienceRecord 一致地尊重 DATA_DIR
    this.localSourcesPromise = loadSourceDocuments(resolve(dataDir, 'source-documents.jsonl')).catch(() => []);
  }
  async allLocal(): Promise<SourceDocument[]> { return [...await this.localSourcesPromise]; }
  async listLocal(limit = 50, offset = 0): Promise<SourceDocument[]> { return (await this.localSourcesPromise).slice(offset, offset + Math.min(limit, 100)); }
  async getLocal(sourceId: string): Promise<SourceDocument | null> { return (await this.localSourcesPromise).find((source) => source.source_id === sourceId) ?? null; }
  // P1-02：先本地 canonical，再 live 注册表
  async get(sourceId: string): Promise<SourceDocument | null> { return (await this.getLocal(sourceId)) ?? this.live.get(sourceId); }

  // P0-10/P0-12：配额耗尽或上游失败时的快照降级——本地 canonical 语料上的关键词检索
  async localFallbackSearch(query: string, count = 10): Promise<SearchResponse> {
    const tokens = query.toLowerCase().split(/[\s,，。？?！!]+/).map((token) => token.trim()).filter((token) => token.length > 0);
    const list = await this.allLocal();
    const sources = list.map((source) => {
      const title = source.question_title.toLowerCase();
      const text = source.text.toLowerCase();
      let score = 0;
      for (const token of tokens) score += (title.split(token).length - 1) * 3 + (text.split(token).length - 1);
      return { source, score };
    })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || (b.source.platform_signals.vote_count ?? 0) - (a.source.platform_signals.vote_count ?? 0))
      .slice(0, count)
      .map((item) => item.source);
    return { sources, has_more: false, cached: false, mode: 'local_fallback' };
  }

  async search(query: string, count = 10, refresh = false): Promise<SearchResponse> {
    if (!this.adapter) {
      const fallback = await this.localFallbackSearch(query, count);
      return { ...fallback, degraded_reason: 'SEARCH_ADAPTER_NOT_CONFIGURED' };
    }
    const key = stableCacheKey('source-search-v1', { query, count: Math.min(count, 10) });
    if (!refresh) {
      const cached = await this.cache.get<{ sources: SourceDocument[]; has_more: boolean }>(key);
      if (cached) {
        this.live.register(cached.sources);
        return { sources: cached.sources, has_more: cached.has_more, cached: true, mode: 'cache' };
      }
    }
    try {
      const result = await this.adapter.search({ query, count });
      this.live.register(result.sources);
      await this.cache.set(key, { sources: result.sources, has_more: result.has_more });
      return { sources: result.sources, has_more: result.has_more, cached: false, mode: 'official_api_search' };
    } catch (error) {
      // P0-10：任何上游失败都降级到本地快照检索，而不是把页面打挂
      const reason = String(error).slice(0, 120);
      const fallback = await this.localFallbackSearch(query, count);
      return { ...fallback, degraded_reason: reason };
    }
  }
}
