import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, QUESTION_KEY, ApiRequestError } from '../api/client';
import type { DiscussionLens, Meta, RenderPacket } from '../api/types';
import { diffRenderPackets, type ChangeReport } from '../lens/diff';

const STORAGE_KEY = 'zj-context-v2';

interface StoredContext { values: Record<string, string>; rejected: string[]; custom: string | null }

function loadStoredContext(): StoredContext {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { values: {}, rejected: [], custom: null };
    const parsed = JSON.parse(raw) as StoredContext;
    return { values: parsed.values ?? {}, rejected: parsed.rejected ?? [], custom: parsed.custom ?? null };
  } catch {
    return { values: {}, rejected: [], custom: null };
  }
}

interface AppState {
  meta: Meta | null;
  lens: DiscussionLens | null;
  conditions: Record<string, string>;
  rejectedDimensions: string[];
  customCondition: string | null;
  packet: RenderPacket | null;
  previousPacket: RenderPacket | null;
  changeReport: ChangeReport | null;
  packetLoading: boolean;
  error: { code: string; message: string; requestId: string } | null;
  backendReady: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  setCondition: (dimensionId: string, value: string) => void;
  clearCondition: (dimensionId: string) => void;
  toggleRejected: (dimensionId: string) => void;
  setCustomCondition: (text: string | null) => void;
  clearConditions: () => void;
  generateReadingSet: () => Promise<boolean>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const initial = useRef(loadStoredContext());
  const [meta, setMeta] = useState<Meta | null>(null);
  const [lens, setLens] = useState<DiscussionLens | null>(null);
  const [conditions, setConditions] = useState<Record<string, string>>(initial.current.values);
  const [rejectedDimensions, setRejectedDimensions] = useState<string[]>(initial.current.rejected);
  const [customCondition, setCustomText] = useState<string | null>(initial.current.custom);
  // 同步 ref：同一事件 tick 内「选条件 + 提交」也必须读到最新条件（修复快速连点提交旧条件的竞态）
  const conditionsRef = useRef(initial.current.values);
  const rejectedRef = useRef(initial.current.rejected);
  const customRef = useRef(initial.current.custom);
  const [packet, setPacket] = useState<RenderPacket | null>(null);
  const [previousPacket, setPreviousPacket] = useState<RenderPacket | null>(null);
  const [changeReport, setChangeReport] = useState<ChangeReport | null>(null);
  const [packetLoading, setPacketLoading] = useState(false);
  const [error, setError] = useState<AppState['error']>(null);
  const [backendReady, setBackendReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const prevConditions = useRef<Record<string, string>>(initial.current.values);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await api.meta();
        if (cancelled) return;
        setMeta(m);
        setBackendReady(m.lens.ready);
        const l = await api.lens(QUESTION_KEY);
        if (cancelled) return;
        setLens(l.lens);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError) {
          setError({ code: e.apiError.code, message: e.apiError.message, requestId: e.apiError.request_id });
        } else {
          setError({ code: 'NETWORK_ERROR', message: '无法连接后端服务', requestId: 'local' });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ values: conditions, rejected: rejectedDimensions, custom: customCondition })); } catch { /* ignore */ }
  }, [conditions, rejectedDimensions, customCondition]);

  const setCondition = useCallback((dimensionId: string, value: string) => {
    conditionsRef.current = { ...conditionsRef.current, [dimensionId]: value };
    rejectedRef.current = rejectedRef.current.filter((id) => id !== dimensionId);
    setConditions(conditionsRef.current);
    setRejectedDimensions(rejectedRef.current);
  }, []);

  // F-005「不确定」：清空该维度的取值，比较时按未知处理
  const clearCondition = useCallback((dimensionId: string) => {
    const next = { ...conditionsRef.current }; delete next[dimensionId]; conditionsRef.current = next;
    setConditions(next);
  }, []);

  // F-005「都不像 / 不重要」：该维度不参与你的情况比较
  const toggleRejected = useCallback((dimensionId: string) => {
    const nextValues = { ...conditionsRef.current }; delete nextValues[dimensionId]; conditionsRef.current = nextValues;
    rejectedRef.current = rejectedRef.current.includes(dimensionId) ? rejectedRef.current.filter((id) => id !== dimensionId) : [...rejectedRef.current, dimensionId];
    setConditions(nextValues);
    setRejectedDimensions(rejectedRef.current);
  }, []);

  const setCustomCondition = useCallback((text: string | null) => {
    customRef.current = text && text.trim() ? text.trim().slice(0, 500) : null;
    setCustomText(customRef.current);
  }, []);

  const clearConditions = useCallback(() => { setConditions({}); setRejectedDimensions([]); setCustomCondition(null); }, []);

  const openDrawer = useCallback(() => { api.event('lens_open', {}); setDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const generateReadingSet = useCallback(async (): Promise<boolean> => {
    const values = conditionsRef.current;
    const rejected = rejectedRef.current;
    const custom = customRef.current;
    setPacketLoading(true);
    setError(null);
    api.event('context_submit', { values, rejected, custom });
    try {
      const res = await api.renderPacket(values, QUESTION_KEY, rejected, custom);
      // P0-08：保留上一次 ReadingSet，生成结构化变化解释
      const changedConditions = Object.keys({ ...prevConditions.current, ...values })
        .filter((key) => (prevConditions.current[key] ?? '') !== (values[key] ?? ''));
      if (packet) setPreviousPacket(packet);
      setChangeReport(packet ? diffRenderPackets(packet, res.render_packet, changedConditions) : null);
      prevConditions.current = values;
      setPacket(res.render_packet);
      api.event('reading_set_generated', { slots: res.render_packet.cards.map((card) => card.role) });
      return true;
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setError({ code: e.apiError.code, message: e.apiError.message, requestId: e.apiError.request_id });
      } else {
        setError({ code: 'NETWORK_ERROR', message: '无法连接后端服务', requestId: 'local' });
      }
      return false;
    } finally {
      setPacketLoading(false);
    }
    // packet 作为生成前的旧包参与 diff，依赖顺序有意如此
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packet]);

  const value = useMemo<AppState>(() => ({
    meta, lens, conditions, rejectedDimensions, customCondition, packet, previousPacket, changeReport, packetLoading, error, backendReady,
    drawerOpen, openDrawer, closeDrawer,
    setCondition, clearCondition, toggleRejected, setCustomCondition, clearConditions, generateReadingSet,
  }), [meta, lens, conditions, rejectedDimensions, customCondition, packet, previousPacket, changeReport, packetLoading, error, backendReady, drawerOpen, openDrawer, closeDrawer, setCondition, clearCondition, toggleRejected, setCustomCondition, clearConditions, generateReadingSet]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctxValue = useContext(AppContext);
  if (!ctxValue) throw new Error('useApp must be used within AppProvider');
  return ctxValue;
}
