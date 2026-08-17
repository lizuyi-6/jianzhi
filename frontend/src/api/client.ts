import type { ApiError, DiscussionLens, Meta, RenderPacket, SourceDocument } from './types';

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

export const QUESTION_KEY = 'golden-read-work';

export const api = {
  meta: () => request<Meta>('/api/v1/meta'),
  sources: (limit = 50, offset = 0) =>
    request<{ sources: SourceDocument[]; total: number }>('/api/v1/sources?limit=' + limit + '&offset=' + offset),
  source: (sourceId: string) =>
    request<{ source: SourceDocument }>('/api/v1/sources/' + encodeURIComponent(sourceId)),
  search: (query: string, count = 10) =>
    request<{ sources: SourceDocument[]; has_more: boolean; cached: boolean }>('/api/v1/search', {
      method: 'POST',
      body: JSON.stringify({ query, count }),
    }),
  lens: (questionKey = QUESTION_KEY) =>
    request<{ lens: DiscussionLens }>('/api/v1/lens', {
      method: 'POST',
      body: JSON.stringify({ question_key: questionKey }),
    }),
  renderPacket: (values: Record<string, string>, questionKey = QUESTION_KEY) =>
    request<{ render_packet: RenderPacket }>('/api/v1/render-packet', {
      method: 'POST',
      body: JSON.stringify({ question_key: questionKey, values }),
    }),
};
