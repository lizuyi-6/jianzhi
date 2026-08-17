import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { RenderCard, Role, SourceDocument } from '../api/types';
import { useApp } from '../state/AppContext';
import { dimensionLabel, valueLabel, whyReadLabel, warningLabel, ROLE_META } from '../i18n/labels';
import LensCard from '../components/LensCard';
import LensDrawer from '../components/LensDrawer';

const ROLE_ORDER: Role[] = ['COMPARABLE', 'COUNTER_EXPERIENCE', 'CLASSIC'];

function excerpt(text: string, len = 60): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > len ? t.slice(0, len) + '…' : t;
}

function ConditionChips() {
  const { conditions, lens } = useApp();
  const entries = Object.entries(conditions);
  return (
    <div className="cond-chips">
      <span className="cond-chips-label">你的情况</span>
      {entries.length === 0 && <span className="cond-chips-empty">尚未选择条件</span>}
      {entries.map(([dimId, v]) => {
        const dim = lens?.dimensions.find((d) => d.id === dimId);
        return <span key={dimId} className="chip">{dimensionLabel(dimId, dim?.label)} · {valueLabel(v)}</span>;
      })}
    </div>
  );
}

function RoleCard({ card, source }: { card: RenderCard; source: SourceDocument | null }) {
  const { conditions, lens } = useApp();
  const navigate = useNavigate();
  const meta = ROLE_META[card.role];
  const decisionEvidence = card.evidence.find((e) => e.field === 'decision');
  const dimName = (id: string) => dimensionLabel(id, lens?.dimensions.find((d) => d.id === id)?.label);

  return (
    <article className={'role-card role-' + meta.accent} onClick={() => navigate('/read/' + card.role)}>
      <header className="role-head">
        <span className="role-badge">{meta.letter}</span>
        <span className="role-name">{meta.name}</span>
        <span className="role-icon">
          {card.role === 'COMPARABLE' && <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>}
          {card.role === 'COUNTER_EXPERIENCE' && <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12h13m0 0-4-4m4 4-4 4"/><path d="M20 4v16" opacity="0"/></svg>}
          {card.role === 'CLASSIC' && <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z"/><path d="M4 19a2 2 0 0 1 2-2h13"/></svg>}
        </span>
      </header>
      <h3 className="role-headline">{meta.headline}</h3>
      <div className="role-author">
        <span className="avatar avatar-sm">{((source?.author.name) || '知')[0]}</span>
        <div>
          <div className="feed-author-name">{source?.author.name || '知乎用户'}</div>
          <div className="feed-author-sub">{source?.source_type === 'article' ? '专栏文章' : '回答'}</div>
        </div>
      </div>
      <p className="role-excerpt">{source ? excerpt(source.text) : card.title}</p>

      <div className="role-compare">
        {card.same_dimensions.length > 0 && (
          <div className="cmp-row">
            <span className="cmp-tag cmp-same">相同</span>
            <span className="cmp-text">
              {card.same_dimensions.map((id) => dimName(id) + (conditions[id] ? '：' + valueLabel(conditions[id]) : '')).join('、')}
            </span>
          </div>
        )}
        {decisionEvidence && (
          <div className="cmp-row">
            <span className="cmp-tag cmp-decision">TA 的选择</span>
            <span className="cmp-text">「{decisionEvidence.quote}」</span>
          </div>
        )}
        {card.different_dimensions.length > 0 && (
          <div className="cmp-row">
            <span className="cmp-tag cmp-diff">不同</span>
            <span className="cmp-text">{card.different_dimensions.map(dimName).join('、')}</span>
          </div>
        )}
        {card.unknown_dimensions.length > 0 && (
          <div className="cmp-row">
            <span className="cmp-tag cmp-unknown">未知</span>
            <span className="cmp-text">{card.unknown_dimensions.map(dimName).join('、')}（原文未提及，不做推测）</span>
          </div>
        )}
      </div>

      <div className="role-why">
        <div className="role-why-title">为什么先看这篇</div>
        <ul>
          {card.why_read_codes.map((code) => (
            <li key={code}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 13 4 4L19 7"/></svg>
              {whyReadLabel(code)}
            </li>
          ))}
        </ul>
      </div>

      <a className="btn role-open" href={card.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        打开原回答
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17 17 7M9 7h8v8"/></svg>
      </a>
    </article>
  );
}

function EmptyRoleCard({ role }: { role: Role }) {
  const meta = ROLE_META[role];
  return (
    <article className={'role-card role-empty role-' + meta.accent}>
      <header className="role-head">
        <span className="role-badge">{meta.letter}</span>
        <span className="role-name">{meta.name}</span>
      </header>
      <h3 className="role-headline">{meta.headline}</h3>
      <p className="role-empty-text">
        {role === 'COUNTER_EXPERIENCE'
          ? '当前条件下没有找到可靠的反向经验。这不是结论，只是现有数据中缺少通过校验的记录。'
          : '当前条件下没有找到满足该角色的可靠经验。'}
      </p>
    </article>
  );
}

export default function ReadingSetPage() {
  const { packet, packetLoading, generateReadingSet, openDrawer, error, meta } = useApp();
  const [sourcesById, setSourcesById] = useState<Record<string, SourceDocument>>({});

  useEffect(() => {
    if (!packet && !packetLoading) {
      void generateReadingSet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!packet) return;
    let cancelled = false;
    Promise.all(packet.cards.map((c) => api.source(c.source_id).then((r) => r.source).catch(() => null))).then((list) => {
      if (cancelled) return;
      const map: Record<string, SourceDocument> = {};
      for (const s of list) if (s) map[s.source_id] = s;
      setSourcesById(map);
    });
    return () => { cancelled = true; };
  }, [packet]);

  const cardByRole = useMemo(() => {
    const map = new Map<Role, RenderCard>();
    for (const c of packet?.cards ?? []) map.set(c.role, c);
    return map;
  }, [packet]);

  return (
    <div className="page-grid">
      <div className="page-main">
        <section className="card question-card">
          <h1 className="question-title question-title-sm">本科毕业，应该直接工作还是读研？</h1>
          <div className="cond-bar">
            <ConditionChips />
            <button className="cond-edit" type="button" onClick={openDrawer}>
              修改条件
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
          </div>
        </section>

        {error && (
          <section className="card inline-error-card">
            生成阅读集失败：{error.message}（{error.code}，请求 {error.requestId}）
          </section>
        )}

        {packet && packet.warnings.length > 0 && (
          <section className="card warnings-card">
            {packet.warnings.map((w) => <p key={w}>{warningLabel(w)}</p>)}
          </section>
        )}

        <section className="reading-set">
          <div className="reading-set-head">
            <h2>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4Z"/></svg>
              先看这几篇
            </h2>
            <span className="reading-set-note">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3v.5"/></svg>
              三篇分别承担不同角色，没有先后顺序
            </span>
          </div>
          <p className="reading-set-sub">不是给你一个答案，而是先帮你找到更值得读的真人经验。</p>

          {packetLoading && <p className="feed-empty">正在基于你的条件生成阅读集…</p>}

          {packet && (
            <div className="role-grid">
              {ROLE_ORDER.map((role) => {
                const card = cardByRole.get(role);
                if (!card) return <EmptyRoleCard key={role} role={role} />;
                return <RoleCard key={role} card={card} source={sourcesById[card.source_id] ?? null} />;
              })}
            </div>
          )}
        </section>
      </div>

      <div className="page-rail">
        <LensCard mode="generated" />
        <section className="card rail-card">
          <h3 className="rail-title">数据说明</h3>
          <p className="rail-text">
            内容来自知乎官方搜索 API（official_api_search），共 {meta?.source_count ?? '…'} 条来源。
            阅读集只从通过 Evidence 校验的经验记录中选取，B 位允许为空。
          </p>
        </section>
      </div>

      <LensDrawer />
    </div>
  );
}
