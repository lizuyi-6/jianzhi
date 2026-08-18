import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { EvidenceSpan, RenderCard, SourceDocument } from '../api/types';
import { useApp } from '../state/AppContext';
import { dimensionLabel, valueLabel, whyReadLabel } from '../i18n/labels';
import { factLine } from '../lens/diff';
import LensDrawer from '../components/LensDrawer';
import { showToast } from '../components/Toast';
import { getPrefsVersion, isCollected, recordHistory, subscribePrefs, toggleCollection } from '../state/prefs';

interface AnchoredEvidence extends EvidenceSpan {
  index: number;
  valid: boolean;
}

function useHighlightedText(text: string, evidence: EvidenceSpan[]): { body: ReactNode; anchored: AnchoredEvidence[] } {
  return useMemo(() => {
    // 只信任 start/end 与 quote 精确匹配的证据（与后端校验规则一致）
    const anchored: AnchoredEvidence[] = evidence
      .map((e) => ({ ...e, index: 0, valid: text.slice(e.start, e.end) === e.quote }))
      .sort((a, b) => a.start - b.start);
    anchored.forEach((e, i) => { e.index = i + 1; });

    const nodes: ReactNode[] = [];
    let cursor = 0;
    let key = 0;
    for (const e of anchored) {
      if (!e.valid || e.start < cursor) continue;
      if (e.start > cursor) nodes.push(<span key={key++}>{text.slice(cursor, e.start)}</span>);
      nodes.push(
        <mark key={key++} className="ev-mark" id={'ev-' + e.index}>
          {text.slice(e.start, e.end)}
          <a className="ev-ref" href={'#evidence-' + e.index}>[{e.index}]</a>
        </mark>,
      );
      cursor = e.end;
    }
    if (cursor < text.length) nodes.push(<span key={key++}>{text.slice(cursor)}</span>);
    return { body: nodes, anchored };
  }, [text, evidence]);
}

export default function ReadPage() {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const { packet, packetLoading, generateReadingSet, conditions, lens, openDrawer, error } = useApp();
  const [source, setSource] = useState<SourceDocument | null>(null);
  useSyncExternalStore(subscribePrefs, getPrefsVersion);

  const card: RenderCard | null = useMemo(() => {
    if (!packet || !role) return null;
    return packet.cards.find((c) => c.role === role) ?? null;
  }, [packet, role]);

  const collectedSnap = card ? String(isCollected(card.source_id)) : 'false';

  useEffect(() => {
    if (!packet && !packetLoading) void generateReadingSet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!card) return;
    let cancelled = false;
    api.source(card.source_id).then((r) => {
      if (cancelled) return;
      setSource(r.source);
      recordHistory({ source_id: r.source.source_id, title: r.source.question_title.replace(/ - 知乎$/, '') });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [card]);

  const { body, anchored } = useHighlightedText(source?.text ?? '', card?.evidence ?? []);

  if (!role || !['COMPARABLE', 'COUNTER_EXPERIENCE', 'CLASSIC'].includes(role)) {
    return <div className="page-main"><section className="card">未知的阅读角色。</section></div>;
  }

  if (!packetLoading && packet && !card) {
    return (
      <div className="page-main">
        <section className="card">
          <p>该角色在当前阅读集中为空——现有数据下没有通过校验的经验，知鉴不会伪造内容填充。</p>
          <button className="btn btn-primary" onClick={() => navigate('/reading-set')}>返回阅读集</button>
        </section>
      </div>
    );
  }

  const dimName = (id: string) => dimensionLabel(id, lens?.dimensions.find((d) => d.id === id)?.label);
  const votes = source?.platform_signals.vote_count;
  const comments = source?.platform_signals.comment_count;

  return (
    <div className="page-grid">
      <div className="page-main">
        <div className="read-topbar">
          <Link to="/reading-set" className="read-back">‹ 返回阅读集</Link>
          <div className="cond-chips">
            <span className="cond-chips-label">你的情况</span>
            {Object.entries(conditions).map(([dimId, v]) => (
              <span key={dimId} className="chip">{dimName(dimId)} · {valueLabel(v)}</span>
            ))}
          </div>
          <button className="cond-edit" type="button" onClick={openDrawer}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>
            换个条件再看
          </button>
        </div>

        <section className="card read-card">
          <h1 className="read-title">{card?.title.replace(/ - 知乎$/, '') ?? '加载中…'}</h1>

          <div className="feed-author read-author">
            <span className="avatar">{(source?.author.name || '知')[0]}</span>
            <div>
              <div className="feed-author-name">{source?.author.name || '知乎用户'}</div>
              <div className="feed-author-sub">{source?.source_type === 'article' ? '专栏文章' : '回答'}</div>
            </div>
            <button className="btn-mini follow-btn" type="button" onClick={() => showToast('演示版本暂未开放作者关注')}>+ 关注</button>
          </div>
          {typeof votes === 'number' && <p className="read-votes">{votes} 人赞同了该{source?.source_type === 'article' ? '文章' : '回答'}</p>}

          <p className="content-caption">来源内容（知乎官方搜索 API 返回的检索片段，不保证是完整回答正文）</p>
          <div className="read-body">
            {source ? body : <p>正在加载来源内容…</p>}
          </div>

          <div className="feed-meta read-meta">
            {typeof votes === 'number' && <span className="feed-vote">▲ 赞同 {votes}</span>}
            {typeof comments === 'number' && <span>{comments} 条评论</span>}
            {source?.published_at && <span>发布于 {source.published_at.slice(0, 10)}</span>}
            {card && source && (
              <button
                type="button"
                className={'btn-mini collect-btn' + (collectedSnap === 'true' ? ' followed' : '')}
                onClick={() => showToast(toggleCollection({ source_id: source.source_id, title: source.question_title.replace(/ - 知乎$/, '') }) ? '已收藏' : '已取消收藏')}
              >
                {collectedSnap === 'true' ? '★ 已收藏' : '☆ 收藏'}
              </button>
            )}
          </div>
          <p className="read-provenance">来源：知乎官方搜索 API（official_api_search） · 高亮与编号为依据该检索片段的 Evidence 引用</p>
        </section>
        {error && <section className="card inline-error-card">{error.message}（{error.code}）</section>}
      </div>

      <div className="page-rail">
        <section className="card why-panel">
          <h3 className="why-panel-title">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4Z"/></svg>
            为什么这么说？
          </h3>
          <p className="why-panel-sub">这条来源为什么值得先读</p>
          {card && (
            <div className="why-badges">
              {card.why_read_codes.map((code) => (
                <span key={code} className="why-badge">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 13 4 4L19 7"/></svg>
                  {whyReadLabel(code)}
                </span>
              ))}
            </div>
          )}

          {card && card.same_dimensions.length > 0 && (
            <div className="why-section">
              <h4>与你相同</h4>
              {card.same_dimensions.map((id) => (
                <p key={id} className="why-line why-same">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 13 4 4L19 7"/></svg>
                  {dimName(id)}{conditions[id] ? '：' + valueLabel(conditions[id]) : ''}
                </p>
              ))}
            </div>
          )}

          {/* P1-08：双边差异展示 */}
          {card && card.different_facts.length > 0 && (
            <div className="why-section">
              <h4>与你不同</h4>
              {card.different_facts.map((fact) => (
                <p key={fact.dimension} className="why-line why-diff">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18M5 8l7-5 7 5"/></svg>
                  {factLine(fact)}
                </p>
              ))}
            </div>
          )}

          {card && card.unknown_dimensions.length > 0 && (
            <div className="why-section">
              <h4>未知</h4>
              {card.unknown_dimensions.map((id) => (
                <p key={id} className="why-line why-unknown">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.8.4-.9 1-.9 1.7"/><circle cx="12" cy="16.5" r=".5" fill="currentColor"/></svg>
                  {dimName(id)}（当前检索片段未提及，不做推测）
                </p>
              ))}
            </div>
          )}

          {anchored.length > 0 && (
            <div className="why-section">
              <h4>来源依据</h4>
              {anchored.map((e) => (
                <a
                  key={e.evidence_id}
                  className={'evidence-item' + (e.valid ? '' : ' invalid')}
                  href={'#ev-' + e.index}
                  id={'evidence-' + e.index}
                  onClick={() => api.event('evidence_open', { evidence_id: e.evidence_id, source_id: e.source_id, field: e.field })}
                >
                  <span className="evidence-index">[{e.index}]</span>
                  <span className="evidence-quote">{e.quote}</span>
                  <span className="evidence-field">{dimensionLabel(e.field)}{e.valid ? '' : ' · 引用与当前来源片段位置不符'}</span>
                </a>
              ))}
            </div>
          )}

          {card && (
            <a className="why-origin" href={card.url} target="_blank" rel="noreferrer" onClick={() => api.event('source_open', { source_id: card.source_id })}>
              {source?.source_type === 'article' ? '查看原文' : '查看原回答'}
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6"/></svg>
            </a>
          )}
        </section>
      </div>

      <LensDrawer />
    </div>
  );
}
