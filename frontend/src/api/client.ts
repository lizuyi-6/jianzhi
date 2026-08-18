import type { ApiError, DiscussionLens, Meta, RenderPacket, SearchResponse, SourceDocument } from './types';

export class ApiRequestError extends Error {
  readonly apiError: ApiError;
  readonly status: number;
  constructor(status: number, apiError: ApiError) {
    super(apiError.message);
    this.status = status;
    this.apiError = apiError;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error as ApiError | undefined;
    throw new ApiRequestError(res.status, err ?? {
      code: 'NETWORK_ERROR',
      message: '请求失败（HTTP ' + res.status + '）',
      request_id: 'local',
      retryable: true,
    });
  }
  return body as T;
}

export const QUESTION_KEY = 'golden-cs-offer-work-or-grad';

export const api = {
  meta: () => request<Meta>('/api/v1/meta'),
  sources: (limit = 50, offset = 0) =>
    request<{ sources: SourceDocument[]; total: number }>('/api/v1/sources?limit=' + limit + '&offset=' + offset),
  source: (sourceId: string) =>
    request<{ source: SourceDocument }>('/api/v1/sources/' + encodeURIComponent(sourceId)),
  search: (query: string, count = 10) =>
    request<SearchResponse>('/api/v1/search', {
      method: 'POST',
      body: JSON.stringify({ query, count }),
    }),
  lens: (questionKey = QUESTION_KEY) =>
    request<{ lens: DiscussionLens }>('/api/v1/lens', {
      method: 'POST',
      body: JSON.stringify({ question_key: questionKey }),
    }),
  renderPacket: (values: Record<string, string>, questionKey = QUESTION_KEY, userRejectedDimensions: string[] = [], customCondition: string | null = null) =>
    request<{ render_packet: RenderPacket }>('/api/v1/render-packet', {
      method: 'POST',
      body: JSON.stringify({ question_key: questionKey, values, user_rejected_dimensions: userRejectedDimensions, custom_condition: customCondition }),
    }),
  event: (event: string, payload: Record<string, unknown> = {}) => {
    // P2-10：埋点尽力而为，失败不影响交互
    try {
      void fetch('/api/v1/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, payload }), keepalive: true }).catch(() => {});
    } catch { /* ignore */ }
  },
};
