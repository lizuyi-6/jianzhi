import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { dimensionLabel, valueLabel } from '../i18n/labels';

function WhyDisclosure({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="why-disclosure">
      <button type="button" className="why-toggle" onClick={() => setOpen((v) => !v)}>
        为什么这么说？
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : undefined }}><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && <p className="why-detail">{text}</p>}
    </div>
  );
}

export default function LensDrawer() {
  const { drawerOpen, closeDrawer, lens, meta, conditions, setCondition, generateReadingSet, packetLoading, error } = useApp();
  const navigate = useNavigate();
  if (!drawerOpen) return null;

  const dimensions = lens?.dimensions ?? [];

  const onSubmit = async () => {
    const ok = await generateReadingSet();
    if (ok) {
      closeDrawer();
      navigate('/reading-set');
    }
  };

  const whyText = (dim: { supporting_sources: string[]; counterexample_sources: string[] }) => {
    let t = '该条件在 ' + dim.supporting_sources.length + ' 条经验中被明确提及';
    if (dim.counterexample_sources.length > 0) {
      t += '，其中 ' + dim.counterexample_sources.length + ' 条在相近条件下出现了不同选择';
    }
    return t + '。';
  };

  return (
    <div className="drawer-overlay" onClick={closeDrawer}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="drawer-brand">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4Z"/></svg>
            知鉴 AI 透镜
          </span>
          <span className="lens-card-beta">BETA</span>
          <button className="drawer-close" type="button" onClick={closeDrawer} aria-label="关闭">×</button>
        </div>

        <h2 className="drawer-title">大家真正分歧在哪？</h2>
        <p className="drawer-subtitle">这些回答主要在下面几种条件下给出了不同判断。</p>

        {meta && (
          <div className="drawer-info">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>
            已从 {meta.source_count} 条真人内容中提炼出 {dimensions.length} 个可靠分歧条件
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
              <WhyDisclosure text={whyText(dim)} />
            </div>
          ))}
          {dimensions.length === 0 && <p className="drawer-empty">暂未提炼出可靠分歧条件。</p>}
        </section>

        <section className="drawer-section">
          <h3 className="drawer-section-title">你的情况</h3>
          <p className="drawer-section-sub">请选择更符合你当前状况的选项，知鉴将为你筛选更相关的建议。</p>
          {dimensions.map((dim, i) => (
            <div key={dim.id} className="dim-row">
              <span className="dim-index">{i + 1}</span>
              <span className="dim-label">{dimensionLabel(dim.id, dim.label)}</span>
              <span className="dim-pills">
                {dim.observed_values.map((v) => {
                  const selected = conditions[dim.id] === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      disabled={!dim.user_answerable}
                      className={'pill pill-btn' + (selected ? ' pill-active' : '')}
                      onClick={() => setCondition(dim.id, v)}
                    >
                      {valueLabel(v)}
                      {selected && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 13 4 4L19 7"/></svg>}
                    </button>
                  );
                })}
              </span>
            </div>
          ))}
        </section>

        {error && <p className="drawer-error">生成失败：{error.message}（{error.code}）</p>}

        <button className="btn btn-lens drawer-cta" type="button" onClick={onSubmit} disabled={packetLoading}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4Z"/></svg>
          {packetLoading ? '正在生成…' : '先看这几篇'}
        </button>
        <p className="drawer-cta-note">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3v.5"/></svg>
          仅展示与你的情况更匹配的回答，节省阅读时间
        </p>
      </aside>
    </div>
  );
}
