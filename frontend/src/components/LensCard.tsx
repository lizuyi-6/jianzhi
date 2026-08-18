import { useApp } from '../state/AppContext';

export default function LensCard({ mode }: { mode: 'intro' | 'generated' }) {
  const { openDrawer, meta, lens } = useApp();
  return (
    <div className="lens-card judge-lens-card">
      <div className="lens-card-head">
        <span className="lens-card-brand">知鉴 AI 透镜</span>
        <span className="lens-card-beta">BETA</span>
      </div>

      {mode === 'intro' && <div className="judge-kicker">不要先问 AI 该选哪条路</div>}
      <h3 className="lens-card-title">
        {mode === 'intro' ? <>先找到<br />最值得听的几个人</> : <>条件一变，<br />值得先读的人也会变</>}
      </h3>

      <ul className="lens-card-points judge-steps">
        <li><span className="judge-step-index">1</span><span>从真人经验里找出真正改变选择的条件</span></li>
        <li><span className="judge-step-index">2</span><span>按你的情况构造可比较 / 反向 / 经典三类视角</span></li>
        <li><span className="judge-step-index">3</span><span>每个判断都能点回原文 Evidence，不靠 AI 脑补</span></li>
      </ul>

      <button className="btn btn-lens judge-primary-cta" type="button" onClick={openDrawer}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4Z"/><path d="M19 15l.9 2.6L22 18.5l-2.1.9L19 22l-.9-2.6-2.1-.9 2.1-.9Z"/></svg>
        {mode === 'intro' ? '按我的情况看' : '改一个条件，再看一次'}
      </button>
      <p className="lens-card-foot">
        {mode === 'intro'
          ? '10 秒看见：为什么同一个问题，会得到完全相反的经验。'
          : '试着只改一个条件，观察三席里谁会换人。'}
      </p>
      {meta && lens && mode === 'intro' && (
        <p className="lens-card-stats">{meta.source_count} 条来源 · {meta.lens.experience_records} 条通过 Evidence 校验 · {lens.dimensions.length} 个候选分歧维度</p>
      )}
    </div>
  );
}
