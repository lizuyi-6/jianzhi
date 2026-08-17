import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { showToast } from './Toast';

export default function TopBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [bellOpen, setBellOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, []);

  const submitSearch = () => {
    const q = query.trim();
    if (!q) return;
    navigate('/search?q=' + encodeURIComponent(q));
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="logo">知鉴</Link>
        <nav className="topnav">
          <Link to="/" className="topnav-item active">首页</Link>
          <span className="topnav-item muted" onClick={() => showToast('「发现」在演示版本中暂未开放')}>发现</span>
          <Link to="/follows" className="topnav-item">关注</Link>
        </nav>
        <div className="searchbox">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            ref={inputRef}
            placeholder="搜索问题、话题或人"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }}
          />
          <kbd>⌘ K</kbd>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-ask" type="button" onClick={() => showToast('「提问」在演示版本中暂未开放')}>提问</button>
          <div className="bell-wrap" ref={bellRef}>
            <button className="icon-btn" type="button" aria-label="通知" onClick={() => setBellOpen((v) => !v)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
            </button>
            {bellOpen && (
              <div className="bell-panel">
                <div className="bell-title">通知</div>
                <p className="bell-empty">演示版本暂未接入通知。</p>
              </div>
            )}
          </div>
          <span className="avatar avatar-sm">知</span>
        </div>
      </div>
    </header>
  );
}
