import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { dimensionLabel, valueLabel } from '../i18n/labels';
import type { DiscussionDimension } from '../api/types';

// P0-06：「为什么这么说？」必须回到对应原文/来源片段——这里展示跨立场证据对（原文引句 + 来源链接）
function WhyDisclosure({ dimension }: { dimension: DiscussionDimension }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  if (!dimension.support_examples.length && dimension.counterexample_sources.length === 0) return null;
  return (
    <div className="why-disclosure">
      <button type="button" className="why-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        为什么这么说？
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : undefined }}><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div className="why-detail">
          <p className="why-detail-line">
            该条件在 {dimension.supporting_sources.length} 条通过 Evidence 校验的经验中被提及。下面是 {dimension.support_examples.length} 条跨立场证据（不同取值、不同选择，两两成对）；另有 {dimension.counterexample_sources.length} 条在相近条件下做出不同选择，作为反例保留、不隐藏。
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
                  <span className="example-meta">TA 的条件：{valueLabel(example.value)} · TA 的选择：{valueLabel(example.decision)}</span>
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
    drawerOpen, closeDrawer, lens, meta, conditions, rejectedDimensions, customCondition,
    setCondition, clearCondition, toggleRejected, setCustomCondition, generateReadingSet, packetLoading, error,
  } = useApp();
  const navigate = useNavigate();
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  // P2-09：对话框可访问性——Escape 关闭、焦点进入、关闭后归还焦点
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
        className="drawer"
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

        <h2 className="drawer-title">大家真正分歧在哪？</h2>
        <p className="drawer-subtitle">这些回答主要在下面几种条件下给出了不同判断。</p>

        {meta && (
          <div className="drawer-info">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>
            共找到 {meta.source_count} 条来源内容，其中 {meta.lens.experience_records} 条通过 Evidence 校验进入透镜分析，基于这些经验提炼出 {dimensions.length} 个候选分歧维度
          </div>
        )}

        <section className="drawer-section">
          <h3 className="drawer-section-title">主要分歧条件</h3>
          {dimensions.map((dim, i) => (
            <div key={dim.id} className="dim-row">
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

        <section className="drawer-section">
          <h3 className="drawer-section-title">你的情况</h3>
          <p className="drawer-section-sub">选择更符合你当前状况的选项；不确定可以留空，知鉴会按「未知」处理，不做推测。</p>
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
                  {/* F-005：不确定 / 都不是 / 不重要 */}
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
                    都不像 / 不重要
                  </button>
                </span>
              </div>
            );
          })}
          <div className="custom-condition">
            <label className="custom-condition-label" htmlFor="custom-condition-input">还有什么想补充的情况？（可选，仅用于筛选，不影响证据）</label>
            <textarea
              id="custom-condition-input"
              className="custom-condition-input"
              rows={2}
              maxLength={500}
              placeholder="例如：家里希望我回老家；手里 Offer 有时间限制……"
              value={customCondition ?? ''}
              onChange={(e) => setCustomCondition(e.target.value)}
            />
          </div>
        </section>

        {error && <p className="drawer-error">生成失败：{error.message}（{error.code}）</p>}

        <button className="btn btn-lens drawer-cta" type="button" onClick={onSubmit} disabled={packetLoading}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4Z"/></svg>
          {packetLoading ? '正在生成…' : '先看这几篇'}
        </button>
        <p className="drawer-cta-note">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3v.5"/></svg>
          基于你的情况构造可比较、反向和经典三类视角的阅读集；会保留与你相似但选择不同的真人经验，不替你做最终判断
        </p>
      </aside>
    </div>
  );
}
