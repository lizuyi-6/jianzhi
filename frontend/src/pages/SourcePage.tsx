import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSyncExternalStore } from 'react';
import { api, ApiRequestError } from '../api/client';
import type { SourceDocument } from '../api/types';
import { getPrefsVersion, isCollected, recordHistory, subscribePrefs, toggleCollection } from '../state/prefs';
import { showToast } from '../components/Toast';

export default function SourcePage() {
  const { sourceId } = useParams<{ sourceId: string }>();
  const [source, setSource] = useState<SourceDocument | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  useSyncExternalStore(subscribePrefs, getPrefsVersion);
  const collectedIds = sourceId ? String(isCollected(sourceId)) : 'false';

  useEffect(() => {
    if (!sourceId) return;
    let cancelled = false;
    api.source(sourceId)
      .then((r) => {
        if (cancelled) return;
        setSource(r.source);
        recordHistory({ source_id: r.source.source_id, title: r.source.question_title.replace(/ - 知乎$/, '') });
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiRequestError) setError({ code: e.apiError.code, message: e.apiError.message });
        else setError({ code: 'NETWORK_ERROR', message: '无法连接后端服务' });
      });
    return () => { cancelled = true; };
  }, [sourceId]);

  if (error) {
    return (
      <div className="page-main">
        <section className="card inline-error-card">
          加载来源失败：{error.message}（{error.code}）
        </section>
      </div>
    );
  }

  if (!source) {
    return <div className="page-main"><section className="card">正在加载原文…</section></div>;
  }

  const collected = collectedIds === 'true';
  const votes = source.platform_signals.vote_count;
  const comments = source.platform_signals.comment_count;

  return (
    <div className="page-main">
      <section className="card read-card">
        <h1 className="read-title">{source.question_title.replace(/ - 知乎$/, '')}</h1>
        <div className="feed-author read-author">
          <span className="avatar">{(source.author.name || '知')[0]}</span>
          <div>
            <div className="feed-author-name">{source.author.name || '知乎用户'}</div>
            <div className="feed-author-sub">{source.source_type === 'article' ? '专栏文章' : '回答'}</div>
          </div>
        </div>
        {typeof votes === 'number' && <p className="read-votes">{votes} 人赞同了该{source.source_type === 'article' ? '文章' : '回答'}</p>}

        <div className="read-body">{source.text}</div>

        <div className="feed-meta read-meta">
          {typeof votes === 'number' && <span className="feed-vote">▲ 赞同 {votes}</span>}
          {typeof comments === 'number' && <span>{comments} 条评论</span>}
          {source.published_at && <span>发布于 {source.published_at.slice(0, 10)}</span>}
          <button
            type="button"
            className={'btn-mini collect-btn' + (collected ? ' followed' : '')}
            onClick={() => {
              const now = toggleCollection({ source_id: source.source_id, title: source.question_title.replace(/ - 知乎$/, '') });
              showToast(now ? '已收藏' : '已取消收藏');
            }}
          >
            {collected ? '★ 已收藏' : '☆ 收藏'}
          </button>
          <a href={source.url} target="_blank" rel="noreferrer" className="feed-origin">查看原回答 ↗</a>
        </div>
        <p className="read-provenance">
          来源：知乎官方搜索 API（{source.source_mode}）
          {source.retrieved_at ? ' · 检索于 ' + source.retrieved_at.slice(0, 10) : ''}
          {source.retrieved_queries?.length ? ' · 命中查询：' + source.retrieved_queries.join('、') : ''}
        </p>
      </section>
    </div>
  );
}
