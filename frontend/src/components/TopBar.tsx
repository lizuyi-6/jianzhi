import { Link, useNavigate } from 'react-router-dom';

export default function TopBar() {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="logo">知鉴</Link>
        <nav className="topnav">
          <Link to="/" className="topnav-item active">首页</Link>
          <span className="topnav-item muted" title="演示版本暂未开放">发现</span>
          <span className="topnav-item muted" title="演示版本暂未开放">关注</span>
        </nav>
        <div className="searchbox" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input placeholder="搜索问题、话题或人" readOnly />
          <kbd>⌘ K</kbd>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-ask" type="button" title="演示版本暂未开放">提问</button>
          <button className="icon-btn" type="button" aria-label="通知">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
            <span className="badge-dot">3</span>
          </button>
          <span className="avatar avatar-sm">知</span>
        </div>
      </div>
    </header>
  );
}
