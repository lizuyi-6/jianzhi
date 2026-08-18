import { useApp } from '../state/AppContext';

// P0-09：知鉴不是建议系统。这里描述的是「构造多元 Reading Set」，不是「筛选更匹配的建议」。
export default function LensCard({ mode }: { mode: 'intro' | 'generated' }) {
  const { openDrawer, meta, lens } = useApp();
  return (
    <div className="lens-card">
      <div className="lens-card-head">
        <span className="lens-card-brand">知鉴 AI 透镜</span>
        <span className="lens-card-beta">BETA</span>
      </div>
      <h3 className="lens-card-title">从真实经验中，<br />为你构造可比较的多元阅读集</h3>
      <ul className="lens-card-points">
        <li>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>
          理解你的机会、动机与约束等公开条件
        </li>
        <li>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>
          找出经验真正分歧的条件，回到原文证据
        </li>
        <li>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          保留相似处境下的不同选择，不替你下结论
        </li>
      </ul>
      <button className="btn btn-lens" type="button" onClick={openDrawer}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4Z"/><path d="M19 15l.9 2.6L22 18.5l-2.1.9L19 22l-.9-2.6-2.1-.9 2.1-.9Z"/></svg>
        {mode === 'intro' ? '按我的情况看' : '调整条件'}
      </button>
      <p className="lens-card-foot">
        {mode === 'intro'
          ? '看看哪些真人经验值得你先读。'
          : '已基于你的条件生成阅读集，可随时调整条件再看'}
      </p>
      {meta && lens && mode === 'intro' && (
        <p className="lens-card-stats">共 {meta.source_count} 条来源内容 · {meta.lens.experience_records} 条通过 Evidence 校验 · {lens.dimensions.length} 个候选分歧维度</p>
      )}
    </div>
  );
}
