import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiRequestError } from '../api/client';
import type { SourceDocument } from '../api/types';

function excerpt(text: string, len = 130): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > len ? t.slice(0, len) + '…' : t;
}

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const [results, setResults] = useState<SourceDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState<boolean | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    if (!q) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.search(q, 10)
      .then((res) => {
        if (cancelled) return;
        setResults(res.sources);
        setCached(res.cached);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiRequestError) setError({ code: e.apiError.code, message: e.apiError.message });
        else setError({ code: 'NETWORK_ERROR', message: '无法连接后端服务' });
        setResults([]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q]);

  return (
    <div className="page-main">
      <section className="card">
        <h1 className="question-title question-title-sm">搜索：{q || '（请输入关键词）'}</h1>
        <p className="search-meta">
          {loading ? '正在通过知乎官方搜索 API 检索…'
            : error ? null
            : '共 ' + results.length + ' 条结果' + (cached ? '（来自缓存）' : '（实时检索）')}
        </p>
        {error && (
          <p className="inline-error">
            搜索失败：{error.message}（{error.code}）
            {error.code === 'RATE_LIMITED' && '，请稍后重试'}
          </p>
        )}
      </section>

      <section className="card feed-card">
        {results.map((s) => (
          <article key={s.source_id} className="feed-item">
            <div className="feed-author">
              <span className="avatar">{(s.author.name || '知')[0]}</span>
              <div>
                <div className="feed-author-name">{s.author.name || '知乎用户'}</div>
                <div className="feed-author-sub">{s.source_type === 'article' ? '专栏文章' : '回答'}</div>
              </div>
            </div>
            <h2 className="feed-title">
              <Link to={'/source/' + encodeURIComponent(s.source_id)}>{s.question_title.replace(/ - 知乎$/, '')}</Link>
            </h2>
            <p className="feed-excerpt">{excerpt(s.text)}</p>
            <div className="feed-meta">
              {typeof s.platform_signals.vote_count === 'number' && (
                <span className="feed-vote">▲ 赞同 {s.platform_signals.vote_count}</span>
              )}
              {typeof s.platform_signals.comment_count === 'number' && (
                <span>{s.platform_signals.comment_count} 条评论</span>
              )}
              <a href={s.url} target="_blank" rel="noreferrer" className="feed-origin">原文 ↗</a>
            </div>
          </article>
        ))}
        {!loading && !error && q && results.length === 0 && <p className="feed-empty">没有找到相关内容。</p>}
        {!loading && !q && <p className="feed-empty">在顶部搜索框输入关键词，回车检索。</p>}
      </section>
      <p className="search-provenance">搜索结果来自知乎官方搜索 API（official_api_search），实时检索计入 API 配额。</p>
    </div>
  );
}
