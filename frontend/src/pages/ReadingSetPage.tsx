import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { RenderCard, Role, SourceDocument } from '../api/types';
import { useApp } from '../state/AppContext';
import { dimensionLabel, valueLabel, whyReadLabel, warningLabel, authorityLabel, ROLE_META } from '../i18n/labels';
import { factLine } from '../lens/diff';
import LensCard from '../components/LensCard';
import LensDrawer from '../components/LensDrawer';
import { QUESTION_TITLE } from '../content';

const ROLE_ORDER: Role[] = ['COMPARABLE', 'COUNTER_EXPERIENCE', 'CLASSIC'];

function excerpt(text: string, len = 60): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > len ? t.slice(0, len) + '…' : t;
}

function ConditionChips() {
  const { conditions, rejectedDimensions, lens } = useApp();
  const entries = Object.entries(conditions);
  const rejected = rejectedDimensions.filter((id) => !entries.some(([key]) => key === id));
  return (
    <div className="cond-chips">
      <span className="cond-chips-label">你的情况</span>
      {entries.length === 0 && rejected.length === 0 && <span className="cond-chips-empty">尚未选择条件</span>}
      {entries.map(([dimId, v]) => {
        const dim = lens?.dimensions.find((d) => d.id === dimId);
        return <span key={dimId} className="chip">{dimensionLabel(dimId, dim?.label)} · {valueLabel(v)}</span>;
      })}
      {rejected.map((dimId) => (
        <span key={dimId} className="chip chip-muted">{dimensionLabel(dimId)} · 不适用</span>
      ))}
    </div>
  );
}

function ChangeReportCard() {
  const { changeReport } = useApp();
  if (!changeReport || !changeReport.hasChanges) return null;
  const changed = changeReport.changes.filter((item) => item.changed);
  return (
    <section className="card change-card judge-change-card" data-testid="change-report">
      <div className="judge-step-badge">STEP 2 · 条件一变，值得先听的人也会变</div>
      <h3 className="change-title judge-change-title">
        条件变化如何改变了阅读集：这次换了 {changed.length} 席
      </h3>
      <p className="judge-change-lead">这就是知鉴和“生成一个统一答案”的区别：它保留条件，并让阅读顺序跟着条件变化。</p>
      {changed.map((item) => (
        <div key={item.role} className="change-row" data-role={item.role}>
          <span className="change-role">{item.roleLabel}</span>
          <div className="change-body">
            <p className="change-main">{item.emptied ? '该视角为空' : item.newlyFilled ? '该视角从空位补齐' : '换了一位更值得先读的人'}</p>
            {item.reasons.length > 0 && <p className="change-reasons">{item.reasons.join('；')}</p>}
          </div>
        </div>
      ))}
      <p className="change-note">不是重新算一个“总分 Top 3”：A 看可比较性，B 保留相近处境下的另一种选择，C 提供公共质量坐标。</p>
    </section>
  );
}

function QualityLine({ card }: { card: RenderCard }) {
  const { quality_signals: signals } = card;
  const authority = authorityLabel(signals.authority);
  return (
    <p className="quality-line">
      公共质量信号：
      {typeof signals.vote_count === 'number' && <span>▲ {signals.vote_count} 赞同</span>}
      {typeof signals.comment_count === 'number' && <span>{signals.comment_count} 条评论</span>}
      {authority && <span>{authority}</span>}
      <span className="quality-hint">C 位按公共质量坐标挑选</span>
    </p>
  );
}

function RoleCard({ card, source, changed }: { card: RenderCard; source: SourceDocument | null; changed: boolean }) {
  const { conditions, lens } = useApp();
  const navigate = useNavigate();
  const meta = ROLE_META[card.role];
  const decisionEvidence = card.evidence.find((e) => e.field === 'decision');
  const dimName = (id: string) => dimensionLabel(id, lens?.dimensions.find((d) => d.id === id)?.label);

  return (
    <article className={'role-card role-' + meta.accent + (changed ? ' role-card-changed' : '')} data-slot-source={card.source_id} onClick={() => navigate('/read/' + card.role)}>
      {changed && <div className="judge-card-changed-badge">条件变化后换人</div>}
      <header className="role-head">
        <span className="role-badge">{meta.letter}</span>
        <span className="role-name">{meta.name}</span>
        <span className="role-icon">
          {card.role === 'COMPARABLE' && <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>}
          {card.role === 'COUNTER_EXPERIENCE' && <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12h13m0 0-4-4m4 4-4 4"/></svg>}
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
            <span className="cmp-tag cmp-same">和你相同</span>
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
        {card.different_facts.length > 0 && (
          <div className="cmp-row">
            <span className="cmp-tag cmp-diff">和你不同</span>
            <span className="cmp-text">{card.different_facts.map((fact) => factLine(fact)).join('；')}</span>
          </div>
        )}
        {card.unknown_dimensions.length > 0 && (
          <div className="cmp-row">
            <span className="cmp-tag cmp-unknown">未知</span>
            <span className="cmp-text">{card.unknown_dimensions.map(dimName).join('、')}（当前检索片段未提及，不做推测）</span>
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
        {card.role === 'CLASSIC' && <QualityLine card={card} />}
      </div>

      <button className="btn role-open judge-evidence-cta" type="button" onClick={(e) => { e.stopPropagation(); navigate('/read/' + card.role); }}>
        看它为什么被选中 · 原文 Evidence
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6"/></svg>
      </button>
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
  const { packet, packetLoading, generateReadingSet, openDrawer, error, meta, changeReport } = useApp();
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

  const changedRoles = useMemo(() => new Set(
    (changeReport?.changes ?? []).filter((item) => item.changed).map((item) => item.role),
  ), [changeReport]);

  return (
    <div className="page-grid">
      <div className="page-main">
        <section className="card question-card">
          <div className="judge-step-badge">READING SET · 不是 Top 3，而是三个不同角色</div>
          <h1 className="question-title question-title-sm">{QUESTION_TITLE}</h1>
          <div className="cond-bar">
            <ConditionChips />
            <button className="cond-edit judge-edit-condition" type="button" onClick={openDrawer}>
              改一个条件看看谁会换人
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

        <ChangeReportCard />

        <section className="reading-set">
          <div className="reading-set-head">
            <h2>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4Z"/></svg>
              先看这几篇
            </h2>
            <span className="reading-set-note">三席没有先后顺序，各自回答不同问题</span>
          </div>
          <p className="reading-set-sub judge-reading-sub">A：谁和我最可比？ · B：和我相近的人为什么会选另一条路？ · C：公共讨论里哪篇值得作为坐标？</p>

          {packetLoading && <p className="feed-empty">正在基于你的条件生成阅读集…</p>}

          {packet && (
            <div className="role-grid">
              {ROLE_ORDER.map((role) => {
                const card = cardByRole.get(role);
                if (!card) return <EmptyRoleCard key={role} role={role} />;
                return <RoleCard key={role} card={card} source={sourcesById[card.source_id] ?? null} changed={changedRoles.has(role)} />;
              })}
            </div>
          )}

          {packet && (
            <div className="judge-next-step">
              <span className="judge-step-badge">STEP 3</span>
              <strong>最后，点任意一张卡。</strong>
              <span>知鉴会把“为什么选中它”的判断，逐条指回来源片段里的原文 Evidence。</span>
            </div>
          )}
        </section>
      </div>

      <div className="page-rail">
        <LensCard mode="generated" />
        <section className="card rail-card">
          <h3 className="rail-title">知鉴没有做什么</h3>
          <p className="rail-text">没有把 100 个回答压成一个“你应该怎样”的结论；没有把 Unknown 补成推测；没有把 A/B/C 做成统一总榜。</p>
        </section>
        <section className="card rail-card">
          <h3 className="rail-title">数据说明</h3>
          <p className="rail-text">
            内容来自知乎官方搜索 API（official_api_search），共 {meta?.source_count ?? '…'} 条来源；其中 {meta?.lens.experience_records ?? '…'} 条通过 Evidence 校验进入透镜。阅读集只从通过校验的经验记录中选取，B 位允许为空。
          </p>
        </section>
      </div>

      <LensDrawer />
    </div>
  );
}
