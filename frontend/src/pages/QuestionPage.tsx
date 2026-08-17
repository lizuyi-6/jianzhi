import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSyncExternalStore } from 'react';
import { api } from '../api/client';
import type { SourceDocument } from '../api/types';
import { useApp } from '../state/AppContext';
import { followedTopics, getPrefsVersion, isQuestionFollowed, subscribePrefs, toggleQuestionFollowed, toggleTopic } from '../state/prefs';
import { showToast } from '../components/Toast';
import LensCard from '../components/LensCard';
import LensDrawer from '../components/LensDrawer';

const QUESTION_TAGS = ['计算机科学与技术', '考研', '职业选择', '求职', '研究生'];
const PAGE_SIZE = 50;

type SortMode = 'default' | 'newest' | 'votes';

function excerpt(text: string, len = 110): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > len ? t.slice(0, len) + '…' : t;
}

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export default function QuestionPage() {
  const { meta, backendReady, error } = useApp();
  const navigate = useNavigate();
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<SortMode>('default');
  useSyncExternalStore(subscribePrefs, getPrefsVersion);
  const followed = isQuestionFollowed();
  const topics = followedTopics();

  useEffect(() => {
    let cancelled = false;
    api.sources(PAGE_SIZE, 0).then((res) => {
      if (cancelled) return;
      setSources(res.sources);
      setTotal(res.total);
    }).catch(() => { /* meta 错误已在全局展示 */ });
    return () => { cancelled = true; };
  }, []);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await api.sources(PAGE_SIZE, sources.length);
      setSources((prev) => [...prev, ...res.sources]);
      setTotal(res.total);
    } catch {
      showToast('加载更多失败，请稍后重试');
    } finally {
      setLoadingMore(false);
    }
  };

  const sorted = useMemo(() => {
    const list = [...sources];
    if (sort === 'votes') {
      list.sort((a, b) => (b.platform_signals.vote_count ?? -1) - (a.platform_signals.vote_count ?? -1));
    } else if (sort === 'newest') {
      list.sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''));
    } else {
      list.sort((a, b) => (b.platform_signals.relevance ?? 0) - (a.platform_signals.relevance ?? 0));
    }
    return list;
  }, [sources, sort]);

  const relatedQuestions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of sources) {
      const t = s.question_title.replace(/ - 知乎$/, '');
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
      if (out.length >= 4) break;
    }
    return out;
  }, [sources]);

  const hasMore = total === null ? false : sources.length < total;

  return (
    <div className="page-grid">
      <div className="page-main">
        <section className="card question-card">
          <div className="tag-row">
            {QUESTION_TAGS.map((t) => (
              <button key={t} className="tag tag-btn" type="button" onClick={() => navigate('/search?q=' + encodeURIComponent(t))}>{t}</button>
            ))}
          </div>
          <h1 className="question-title">本科毕业，应该直接工作还是读研？</h1>
          <p className="question-desc">
            有人建议先工作积累经验，也有人说读研能打开更高的上限。本页内容来自知乎官方搜索 API 返回的真实回答与文章片段，
            知鉴不做统一结论，只帮你找到更值得先读的真人经验。
          </p>
          <div className="question-actions">
            <button
              className={followed ? 'btn btn-ghost' : 'btn btn-primary'}
              type="button"
              onClick={() => showToast(toggleQuestionFollowed() ? '已关注问题' : '已取消关注问题')}
            >
              {followed ? '已关注问题' : '关注问题'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => navigate('/reading-set')}>看阅读集</button>
            <span className="question-stat">共 {meta?.source_count ?? '…'} 条来源内容</span>
            <span className="provenance">来源：知乎官方搜索 API</span>
          </div>
          {error && <p className="inline-error">后端连接异常：{error.message}（{error.code}，请求 {error.requestId}）</p>}
          {!backendReady && !error && <p className="inline-warn">后端数据尚未就绪，请稍后刷新。</p>}
        </section>

        <section className="card feed-card">
          <div className="feed-tabs">
            <button className={sort === 'default' ? 'feed-tab active' : 'feed-tab'} onClick={() => setSort('default')}>默认排序</button>
            <button className={sort === 'newest' ? 'feed-tab active' : 'feed-tab'} onClick={() => setSort('newest')}>最新回答</button>
            <button className={sort === 'votes' ? 'feed-tab active' : 'feed-tab'} onClick={() => setSort('votes')}>最高赞同</button>
            <span className="feed-count">共 {total ?? sources.length} 条内容</span>
          </div>
          {sorted.map((s) => {
            const date = formatDate(s.published_at);
            return (
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
                  {date && <span>发布于 {date}</span>}
                  <a href={s.url} target="_blank" rel="noreferrer" className="feed-origin">原文 ↗</a>
                </div>
              </article>
            );
          })}
          {sources.length === 0 && <p className="feed-empty">正在加载来源内容…</p>}
          {hasMore && (
            <div className="feed-more">
              <button className="btn btn-ghost" type="button" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? '加载中…' : '加载更多（还有 ' + ((total ?? 0) - sources.length) + ' 条）'}
              </button>
            </div>
          )}
        </section>
      </div>

      <div className="page-rail">
        <LensCard mode="intro" />
        <section className="card rail-card">
          <h3 className="rail-title">相关问题</h3>
          <ul className="rail-list">
            {relatedQuestions.map((q) => (
              <li key={q}>
                <button type="button" className="rail-link" onClick={() => navigate('/search?q=' + encodeURIComponent(q))}>{q}</button>
              </li>
            ))}
          </ul>
        </section>
        <section className="card rail-card">
          <h3 className="rail-title">相关话题</h3>
          <ul className="rail-topics">
            {['考研经验', '校招经验', '职业发展'].map((t) => (
              <li key={t}>
                <button type="button" className="rail-link" onClick={() => navigate('/search?q=' + encodeURIComponent(t))}>
                  <span className="hash">#</span> {t}
                </button>
                <button
                  className={'btn-mini' + (topics.includes(t) ? ' followed' : '')}
                  type="button"
                  onClick={() => showToast(toggleTopic(t) ? '已关注话题「' + t + '」' : '已取消关注话题')}
                >
                  {topics.includes(t) ? '已关注' : '关注'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <LensDrawer />
    </div>
  );
}
