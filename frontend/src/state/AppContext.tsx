import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, QUESTION_KEY, ApiRequestError } from '../api/client';
import type { DiscussionLens, Meta, RenderPacket } from '../api/types';

const STORAGE_KEY = 'zj-conditions';

function loadStoredConditions(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

interface AppState {
  meta: Meta | null;
  lens: DiscussionLens | null;
  conditions: Record<string, string>;
  packet: RenderPacket | null;
  packetLoading: boolean;
  error: { code: string; message: string; requestId: string } | null;
  backendReady: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  setCondition: (dimensionId: string, value: string) => void;
  clearConditions: () => void;
  generateReadingSet: () => Promise<boolean>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [lens, setLens] = useState<DiscussionLens | null>(null);
  const [conditions, setConditions] = useState<Record<string, string>>(loadStoredConditions);
  const [packet, setPacket] = useState<RenderPacket | null>(null);
  const [packetLoading, setPacketLoading] = useState(false);
  const [error, setError] = useState<AppState['error']>(null);
  const [backendReady, setBackendReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(conditions)); } catch { /* ignore */ }
  }, [conditions]);

  const setCondition = useCallback((dimensionId: string, value: string) => {
    setConditions((prev) => ({ ...prev, [dimensionId]: value }));
  }, []);

  const clearConditions = useCallback(() => setConditions({}), []);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const generateReadingSet = useCallback(async (): Promise<boolean> => {
    setPacketLoading(true);
    setError(null);
    try {
      const res = await api.renderPacket(conditions, QUESTION_KEY);
      setPacket(res.render_packet);
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
  }, [conditions]);

  const value = useMemo<AppState>(() => ({
    meta, lens, conditions, packet, packetLoading, error, backendReady,
    drawerOpen, openDrawer, closeDrawer,
    setCondition, clearConditions, generateReadingSet,
  }), [meta, lens, conditions, packet, packetLoading, error, backendReady, drawerOpen, openDrawer, closeDrawer, setCondition, clearConditions, generateReadingSet]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctxValue = useContext(AppContext);
  if (!ctxValue) throw new Error('useApp must be used within AppProvider');
  return ctxValue;
}
