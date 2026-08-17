import { z } from 'zod';
import { SourceDocument, SourceDocumentSchema } from '../core/contracts.js';

const ZhihuItemSchema = z.object({
  Title: z.string().optional().default('未命名内容'),
  ContentType: z.string().optional().default('Answer'),
  ContentID: z.union([z.string(), z.number()]),
  ContentText: z.string().optional().default(''),
  Url: z.string().url(),
  CommentCount: z.number().int().nonnegative().optional(),
  VoteUpCount: z.number().int().nonnegative().optional(),
  AuthorName: z.string().nullable().optional(),
  EditTime: z.number().nullable().optional(),
  CommentInfoList: z.array(z.unknown()).optional(),
  AuthorityLevel: z.union([z.string(), z.number()]).nullable().optional(),
  RankingScore: z.number().nullable().optional(),
});
const ZhihuResponseSchema = z.object({
  Code: z.number(), Message: z.string().optional(),
  Data: z.object({ HasMore: z.boolean().optional(), Items: z.array(ZhihuItemSchema).default([]) }).nullable().optional(),
});

export type SearchOptions = { query: string; count?: number; signal?: AbortSignal };
export type SearchResult = { sources: SourceDocument[]; has_more: boolean; source_mode: 'official_api_search' };

export class ZhihuSearchAdapter {
  constructor(private readonly secret: string, private readonly baseUrl = 'https://developer.zhihu.com') {
    if (!secret) throw new Error('ZHIHU_ACCESS_SECRET is required');
  }
  async search(options: SearchOptions): Promise<SearchResult> {
    const count = Math.max(1, Math.min(options.count ?? 10, 10));
    const url = new URL('/api/v1/content/zhihu_search', this.baseUrl);
    url.searchParams.set('Query', options.query); url.searchParams.set('Count', String(count));
    const init: RequestInit = { headers: { Authorization: 'Bearer ' + this.secret, 'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)), Accept: 'application/json' } };
    if (options.signal) init.signal = options.signal;
    const response = await fetch(url, init);
    if (response.status === 401 || response.status === 403) throw new Error('ZHIHU_AUTH_FAILED');
    if (response.status === 429) throw new Error('RATE_LIMITED');
    if (!response.ok) throw new Error('ZHIHU_HTTP_' + response.status);
    const parsed = ZhihuResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('ZHIHU_RESPONSE_INVALID: ' + parsed.error.message);
    if (parsed.data.Code !== 0) throw new Error('ZHIHU_API_' + parsed.data.Code + ': ' + (parsed.data.Message ?? 'unknown'));
    const retrievedAt = new Date().toISOString();
    const sources: SourceDocument[] = [];
    for (const [rank, item] of (parsed.data.Data?.Items ?? []).entries()) {
      const source = SourceDocumentSchema.parse({
        source_id: String(item.ContentID), source_type: item.ContentType.toLowerCase() === 'article' ? 'article' : 'answer',
        question_id: null, question_title: item.Title, author: { id: null, name: item.AuthorName ?? null }, published_at: item.EditTime ? new Date(item.EditTime * 1000).toISOString() : null,
        text: item.ContentText, url: item.Url, platform_signals: { relevance: item.RankingScore ?? null, authority: item.AuthorityLevel ?? null, vote_count: item.VoteUpCount ?? null, comment_count: item.CommentCount ?? null },
        source_mode: 'official_api_search', retrieved_at: retrievedAt, retrieved_queries: [options.query], retrieved_ranks: [rank + 1]
      });
      sources.push(source);
    }
    return { sources, has_more: parsed.data.Data?.HasMore ?? false, source_mode: 'official_api_search' };
  }
}
