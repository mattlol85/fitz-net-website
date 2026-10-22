import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'joenetKeys';

const JoenetKeyContext = createContext(null);

export const useJoenetKeys = () => {
  const context = useContext(JoenetKeyContext);
  if (!context) {
    throw new Error('useJoenetKeys must be used within a JoenetKeyProvider');
  }
  return context;
};

// Keys live in sessionStorage only (gone when the tab closes) - never localStorage.
// Storage can be unavailable or throw (private mode, quota), so every access is guarded.
const readStoredKeys = () => {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
};

const writeStoredKeys = (keys) => {
  try {
    if (Object.keys(keys).length === 0) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    }
  } catch (_error) {
    // Keep working from React state alone.
  }
};

/**
 * Holds the Radarr/Sonarr API keys the user has verified this session, as
 * { radarr?: string, sonarr?: string }. Must sit inside AuthProvider: the keys
 * are dropped as soon as there is no logged-in session.
 */
export const JoenetKeyProvider = ({ children }) => {
  const { token, loading } = useAuth();
  const [keys, setKeys] = useState(readStoredKeys);

  const update = useCallback((change) => {
    setKeys((prev) => {
      const next = change(prev);
      writeStoredKeys(next);
      return next;
    });
  }, []);

  const saveKey = useCallback((app, key) => update((prev) => ({ ...prev, [app]: key })), [update]);

  const forgetKey = useCallback(
    (app) =>
      update((prev) => {
        const next = { ...prev };
        delete next[app];
        return next;
      }),
    [update]
  );

  const forgetAll = useCallback(() => update(() => ({})), [update]);

  // Logout (or an expired session) means no token: wipe the keys. Wait for the
  // initial session restore first, or a page reload would drop them.
  useEffect(() => {
    if (!loading && !token) forgetAll();
  }, [loading, token, forgetAll]);

  const value = useMemo(
    () => ({ keys, saveKey, forgetKey, forgetAll }),
    [keys, saveKey, forgetKey, forgetAll]
  );

  return <JoenetKeyContext.Provider value={value}>{children}</JoenetKeyContext.Provider>;
};

export default JoenetKeyContext;
