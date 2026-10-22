import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useJoenetKeys } from '../contexts/JoenetKeyContext';
import { joenetRequest } from '../services/api';

/**
 * Bound Radarr/Sonarr client for one app. `call(path, { method, query, body })`
 * attaches the JWT and the verified key, and forgets the key when the proxy
 * answers 401 so the user is sent back to the key gate.
 */
export function useJoenetApi(app) {
  const { token } = useAuth();
  const { keys, forgetKey } = useJoenetKeys();
  const key = keys[app];

  const call = useCallback(
    async (path, options) => {
      const result = await joenetRequest(app, path, token, key, options);
      if (result.status === 401) forgetKey(app);
      return result;
    },
    [app, token, key, forgetKey]
  );

  return { call };
}

/**
 * GET a Joenet resource on mount (and whenever path/query change).
 * Returns { data, error, loading, reload, setData }; setData lets a caller
 * patch the loaded data after a successful write without refetching.
 */
export function useJoenetResource(app, path, query) {
  const { call } = useJoenetApi(app);
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const [reloadCount, setReloadCount] = useState(0);
  const queryKey = JSON.stringify(query ?? null);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, error: '', loading: true }));
    call(path, { query: JSON.parse(queryKey) ?? undefined }).then((result) => {
      if (cancelled) return;
      setState(
        result.success
          ? { data: result.data, error: '', loading: false }
          : { data: null, error: result.message, loading: false }
      );
    });
    return () => {
      cancelled = true;
    };
  }, [call, path, queryKey, reloadCount]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const setData = useCallback((data) => setState((prev) => ({ ...prev, data })), []);

  return { ...state, reload, setData };
}
