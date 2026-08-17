import { Link } from 'react-router-dom';
import { useSyncExternalStore } from 'react';
import {
  clearHistory, collections, followedTopics, getPrefsVersion, history, isQuestionFollowed,
  removeHistory, subscribePrefs, toggleCollection, toggleQuestionFollowed, toggleTopic,
} from '../state/prefs';
import { showToast } from '../components/Toast';
import { QUESTION_TITLE } from '../content';

function formatTime(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

export function FollowsPage() {
  useSyncExternalStore(subscribePrefs, getPrefsVersion);
  const qf = isQuestionFollowed();
  const topics = followedTopics();
  return (
    <div className="page-main">
      <section className="card">
        <h1 className="question-title question-title-sm">我的关注</h1>
        <h3 className="list-subtitle">关注的问题</h3>
        {qf ? (
          <div className="list-row">
            <Link to="/" className="list-link">{QUESTION_TITLE}</Link>
            <button className="btn-mini followed" onClick={() => { toggleQuestionFollowed(); showToast('已取消关注问题'); }}>已关注</button>
          </div>
        ) : <p className="list-empty">还没有关注的问题。</p>}
        <h3 className="list-subtitle">关注的话题</h3>
        {topics.length === 0 ? <p className="list-empty">还没有关注的话题，可在左侧边栏点击 ☆ 关注。</p> : (
          topics.map((t) => (
            <div className="list-row" key={t}>
              <Link to={'/search?q=' + encodeURIComponent(t)} className="list-link"><span className="hash">#</span> {t}</Link>
              <button className="btn-mini followed" onClick={() => toggleTopic(t)}>已关注</button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

export function CollectionsPage() {
  useSyncExternalStore(subscribePrefs, getPrefsVersion);
  const list = collections();
  return (
    <div className="page-main">
      <section className="card">
        <h1 className="question-title question-title-sm">我的收藏</h1>
        {list.length === 0 ? <p className="list-empty">还没有收藏内容。打开任意来源原文，点击「☆ 收藏」。</p> : (
          list.map((c) => (
            <div className="list-row" key={c.source_id}>
              <Link to={'/source/' + encodeURIComponent(c.source_id)} className="list-link">{c.title}</Link>
              <span className="list-time">{formatTime(c.time)}</span>
              <button className="btn-mini followed" onClick={() => { toggleCollection(c); showToast('已取消收藏'); }}>已收藏</button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

export function HistoryPage() {
  useSyncExternalStore(subscribePrefs, getPrefsVersion);
  const list = history();
  return (
    <div className="page-main">
      <section className="card">
        <div className="list-head">
          <h1 className="question-title question-title-sm">浏览历史</h1>
          {list.length > 0 && <button className="btn-mini" onClick={() => { clearHistory(); showToast('历史已清空'); }}>清空</button>}
        </div>
        {list.length === 0 ? <p className="list-empty">还没有浏览记录。</p> : (
          list.map((h) => (
            <div className="list-row" key={h.source_id}>
              <Link to={'/source/' + encodeURIComponent(h.source_id)} className="list-link">{h.title}</Link>
              <span className="list-time">{formatTime(h.time)}</span>
              <button className="btn-mini" onClick={() => removeHistory(h.source_id)}>删除</button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
