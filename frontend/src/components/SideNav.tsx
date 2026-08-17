import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useSyncExternalStore } from 'react';
import { followedTopics, getPrefsVersion, subscribePrefs, toggleTopic } from '../state/prefs';

const TOPICS = ['计算机科学', '职业发展', '考研', '校招经验', '互联网行业'];

export default function SideNav() {
  const navigate = useNavigate();
  useSyncExternalStore(subscribePrefs, getPrefsVersion);
  const topics = followedTopics();

  return (
    <aside className="sidenav">
      <nav className="sidenav-main">
        <NavLink to="/" end className={({ isActive }) => 'sidenav-item' + (isActive ? ' active' : '')}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/></svg>
          推荐
        </NavLink>
        <NavLink to="/follows" className={({ isActive }) => 'sidenav-item' + (isActive ? ' active' : '')}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></svg>
          关注
        </NavLink>
        <NavLink to="/collections" className={({ isActive }) => 'sidenav-item' + (isActive ? ' active' : '')}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/></svg>
          收藏
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => 'sidenav-item' + (isActive ? ' active' : '')}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
          历史
        </NavLink>
      </nav>
      <div className="sidenav-topics">
        <div className="sidenav-topics-title">我的话题</div>
        {TOPICS.map((t) => (
          <span key={t} className="sidenav-topic">
            <button type="button" className="topic-link" onClick={() => navigate('/search?q=' + encodeURIComponent(t))}>
              <span className="hash">#</span>{t}
            </button>
            <button
              type="button"
              className={'topic-star' + (topics.includes(t) ? ' starred' : '')}
              title={topics.includes(t) ? '取消关注话题' : '关注话题'}
              onClick={() => toggleTopic(t)}
            >
              {topics.includes(t) ? '★' : '☆'}
            </button>
          </span>
        ))}
        <Link to="/follows" className="sidenav-topic more">更多话题<span className="chev">›</span></Link>
      </div>
    </aside>
  );
}
