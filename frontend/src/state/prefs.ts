// 关注 / 收藏 / 历史的本地持久化（localStorage），带订阅通知。

export interface SavedItem {
  source_id: string;
  title: string;
  time: number;
}

const KEYS = {
  questionFollowed: 'zj-follow-question',
  topics: 'zj-follow-topics',
  collections: 'zj-collections',
  history: 'zj-history',
} as const;

let prefsVersion = 0;

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribePrefs(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  prefsVersion += 1;
  for (const fn of listeners) fn();
}

export function getPrefsVersion(): number {
  return prefsVersion;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  notify();
}

export function isQuestionFollowed(): boolean {
  return read(KEYS.questionFollowed, false);
}

export function toggleQuestionFollowed(): boolean {
  const next = !isQuestionFollowed();
  write(KEYS.questionFollowed, next);
  return next;
}

export function followedTopics(): string[] {
  return read<string[]>(KEYS.topics, []);
}

export function toggleTopic(topic: string): boolean {
  const list = followedTopics();
  const idx = list.indexOf(topic);
  if (idx >= 0) list.splice(idx, 1); else list.push(topic);
  write(KEYS.topics, list);
  return idx < 0;
}

export function collections(): SavedItem[] {
  return read<SavedItem[]>(KEYS.collections, []);
}

export function isCollected(sourceId: string): boolean {
  return collections().some((c) => c.source_id === sourceId);
}

export function toggleCollection(item: { source_id: string; title: string }): boolean {
  const list = collections();
  const idx = list.findIndex((c) => c.source_id === item.source_id);
  if (idx >= 0) list.splice(idx, 1); else list.unshift({ ...item, time: Date.now() });
  write(KEYS.collections, list);
  return idx < 0;
}

export function history(): SavedItem[] {
  return read<SavedItem[]>(KEYS.history, []);
}

export function recordHistory(item: { source_id: string; title: string }) {
  const list = history().filter((h) => h.source_id !== item.source_id);
  list.unshift({ ...item, time: Date.now() });
  write(KEYS.history, list.slice(0, 50));
}

export function removeHistory(sourceId: string) {
  write(KEYS.history, history().filter((h) => h.source_id !== sourceId));
}

export function clearHistory() {
  write(KEYS.history, []);
}
