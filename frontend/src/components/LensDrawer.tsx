import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { dimensionLabel, valueLabel } from '../i18n/labels';
import type { DiscussionDimension } from '../api/types';

function WhyDisclosure({ dimension }: { dimension: DiscussionDimension }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  if (!dimension.support_examples.length && dimension.counterexample_sources.length === 0) return null;
  return (
    <div className="why-disclosure">
      <button type="button" className="why-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        看原文依据
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : undefined }}><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div className="why-detail">
          <p className="why-detail-line">
            这个条件之所以被提出来，不是因为 AI 觉得它“重要”，而是因为它在不同选择的真人经验里反复出现。下面的引句都能回到来源片段。
          </p>
          {dimension.support_examples.length > 0 && (
            <ul className="why-examples">
              {dimension.support_examples.map((example) => (
                <li key={example.evidence_id} className="example-item">
                  <button
                    type="button"
                    className="example-quote"
                    title="查看来源片段"
                    onClick={() => navigate('/source/' + encodeURIComponent(example.source_id))}
                  >
                    「{example.quote}」
                  </button>
                  <span className="example-meta">条件：{valueLabel(example.value)} · 选择：{valueLabel(example.decision)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function LensDrawer() {
  const {
    drawerOpen, closeDrawer, lens, meta, conditions, rejectedDimensions,
    setCondition, clearCondition, toggleRejected, generateReadingSet, packetLoading, error,
  } = useApp();
  const navigate = useNavigate();
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDrawer(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      restoreFocus.current?.focus?.();
    };
  }, [drawerOpen, closeDrawer]);

  if (!drawerOpen) return null;

  const dimensions = lens?.dimensions ?? [];

  const onSubmit = async () => {
    const ok = await generateReadingSet();
    if (ok) {
      closeDrawer();
      navigate('/reading-set');
    }
  };

  return (
    <div className="drawer-overlay" onClick={closeDrawer}>
      <aside
        className="drawer judge-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="知鉴 AI 透镜：分歧条件与你的情况"
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <span className="drawer-brand">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4Z"/></svg>
            知鉴 AI 透镜
          </span>
          <span className="lens-card-beta">BETA</span>
          <button className="drawer-close" type="button" onClick={closeDrawer} aria-label="关闭" ref={closeRef}>×</button>
        </div>

        <div className="judge-step-badge">STEP 1 · 先看分歧，再填自己</div>
        <h2 className="drawer-title judge-drawer-title">同一个问题，答案为什么会相反？</h2>
        <p className="drawer-subtitle judge-drawer-subtitle">知鉴不先总结“大家怎么说”，而是找出：<strong>哪些条件一变，人们的选择也跟着变。</strong></p>

        {meta && (
          <div className="drawer-info">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>
            {meta.source_count} 条来源内容 → {meta.lens.experience_records} 条通过 Evidence 校验的真人经验 → {dimensions.length} 个候选分歧条件
          </div>
        )}

        <section className="drawer-section judge-disagreement-section">
          <h3 className="drawer-section-title">大家真正分歧在哪？</h3>
          {dimensions.map((dim, i) => (
            <div key={dim.id} className="dim-row judge-dim-row">
              <span className="dim-index">{i + 1}</span>
              <span className="dim-label">{dimensionLabel(dim.id, dim.label)}</span>
              <span className="dim-pills">
                {dim.observed_values.map((v) => (
                  <span key={v} className={'pill' + (conditions[dim.id] === v ? ' pill-active' : '')}>{valueLabel(v)}</span>
                ))}
              </span>
              <WhyDisclosure dimension={dim} />
            </div>
          ))}
          {dimensions.length === 0 && <p className="drawer-empty">暂未提炼出可靠分歧条件。</p>}
        </section>

        <section className="drawer-section judge-your-context">
          <div className="judge-context-head">
            <h3 className="drawer-section-title">把你放进这些分歧里</h3>
            <span>选 1–3 个就够了</span>
          </div>
          <p className="drawer-section-sub">不知道就留空。没有证据的地方，知鉴会明确写“未知”，不会替你补故事。</p>
          {dimensions.map((dim, i) => {
            const selected = conditions[dim.id];
            const rejected = rejectedDimensions.includes(dim.id);
            return (
              <div key={dim.id} className="dim-row">
                <span className="dim-index">{i + 1}</span>
                <span className="dim-label">{dimensionLabel(dim.id, dim.label)}</span>
                <span className="dim-pills">
                  {dim.observed_values.map((v) => {
                    const isSelected = selected === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        disabled={!dim.user_answerable}
                        className={'pill pill-btn' + (isSelected ? ' pill-active' : '')}
                        onClick={() => setCondition(dim.id, v)}
                      >
                        {valueLabel(v)}
                        {isSelected && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 13 4 4L19 7"/></svg>}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={'pill pill-btn pill-muted' + (!selected && !rejected ? ' pill-active' : '')}
                    onClick={() => clearCondition(dim.id)}
                    title="该维度按未知处理，不参与比较"
                  >
                    不确定
                  </button>
                  <button
                    type="button"
                    className={'pill pill-btn pill-muted' + (rejected ? ' pill-rejected' : '')}
                    onClick={() => toggleRejected(dim.id)}
                    title="该维度与你的情况无关，比较时忽略"
                  >
                    不重要
                  </button>
                </span>
              </div>
            );
          })}
        </section>

        {error && <p className="drawer-error">生成失败：{error.message}（{error.code}）</p>}

        <div className="judge-drawer-finish">
          <span className="judge-finish-label">接下来不是“给答案”</span>
          <span>而是给你三种不同角色的真人经验：可比较 / 反向 / 经典。</span>
        </div>
        <button className="btn btn-lens drawer-cta judge-primary-cta" type="button" onClick={onSubmit} disabled={packetLoading}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4Z"/></svg>
          {packetLoading ? '正在生成…' : '先看这几篇'}
        </button>
        <p className="drawer-cta-note">不会输出“你应该读研 / 你应该工作”。判断权留给你。</p>
      </aside>
    </div>
  );
}
