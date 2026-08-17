import { useApp } from '../state/AppContext';

export default function LensCard({ mode }: { mode: 'intro' | 'generated' }) {
  const { openDrawer, meta, lens } = useApp();
  return (
    <div className="lens-card">
      <div className="lens-card-head">
        <span className="lens-card-brand">知鉴 AI 透镜</span>
        <span className="lens-card-beta">BETA</span>
      </div>
      <h3 className="lens-card-title">从海量真实经验中，<br />为你找出更值得参考的答案</h3>
      <ul className="lens-card-points">
        <li>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>
          理解你的教育背景、目标与偏好
        </li>
        <li>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>
          筛选与你情况相似的高价值经验
        </li>
        <li>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          对比不同路径的利弊与可能结果
        </li>
      </ul>
      <button className="btn btn-lens" type="button" onClick={openDrawer}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4Z"/><path d="M19 15l.9 2.6L22 18.5l-2.1.9L19 22l-.9-2.6-2.1-.9 2.1-.9Z"/></svg>
        {mode === 'intro' ? '按我的情况看' : '调整条件'}
      </button>
      <p className="lens-card-foot">
        {mode === 'intro'
          ? '看看哪些真人经验更值得你先读。'
          : '已基于你的条件生成阅读集'}
      </p>
      {meta && lens && mode === 'intro' && (
        <p className="lens-card-stats">当前已收录 {meta.source_count} 条真实内容 · {lens.dimensions.length} 个可靠分歧条件</p>
      )}
    </div>
  );
}
