import { useCallback, useEffect, useRef, useState } from 'react';
import { listModels } from '../services/aiChatApi';

export const CATALOGUE_POLL_MS = 60_000;
/** While the picker is open the loaded badges and VRAM should feel live. */
export const CATALOGUE_POLL_OPEN_MS = 15_000;

/**
 * The picker catalogue (GET /ai/models): every node with its models, plus the Auto rows.
 * Polled every 60 s, every 15 s while `fast` (the picker is open), and refetched when `fast`
 * turns on. `refresh()` forces the API past its caches.
 */
export default function useModelCatalogue({ token, enabled = true, fast = false }) {
  const [state, setState] = useState({ catalogue: null, loading: true, error: null });
  const requestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async ({ refresh = false } = {}) => {
      const request = ++requestRef.current;
      try {
        const catalogue = await listModels(token, { refresh });
        if (mountedRef.current && request === requestRef.current) {
          setState({ catalogue, loading: false, error: null });
        }
      } catch (err) {
        if (mountedRef.current && request === requestRef.current) {
          // Keep the last good catalogue on screen; only report the failure.
          setState((s) => ({ ...s, loading: false, error: err.message || 'Could not load models' }));
        }
      }
    },
    [token]
  );

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  const wasFast = useRef(fast);
  useEffect(() => {
    if (enabled && fast && !wasFast.current) load();
    wasFast.current = fast;
  }, [enabled, fast, load]);

  useEffect(() => {
    if (!enabled) return undefined;
    // A hidden tab has nobody to show the list to: skip ticks, and catch up when it is shown again.
    const interval = setInterval(
      () => {
        if (!document.hidden) load();
      },
      fast ? CATALOGUE_POLL_OPEN_MS : CATALOGUE_POLL_MS
    );
    const onVisibility = () => {
      if (!document.hidden) load();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, fast, load]);

  const refresh = useCallback(() => load({ refresh: true }), [load]);

  return { ...state, refresh };
}
