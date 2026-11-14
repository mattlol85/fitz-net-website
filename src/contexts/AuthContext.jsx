import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { flushSync } from 'react-dom';
import { loginUser, logoutUser, validateToken, updateUserProfile, getCurrentUser } from '../services/api';
import { DEFAULT_BOARD_COLOR } from '../constants';
import { registerSessionBridge, watchExpiry } from '../services/session';
import SessionExpiredCard from '../components/SessionExpiredCard';

// Create the AuthContext
const AuthContext = createContext(null);

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// AuthProvider component to wrap the app
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  // Tracks the live session token so late async responses can tell they are stale.
  const tokenRef = useRef(null);
  // The token ran out while a page was open: the session card asks for the password again.
  const [sessionExpired, setSessionExpired] = useState(false);
  // Requests (held by the session fetch wrapper) waiting for that sign-in; see services/session.js.
  const waitersRef = useRef([]);

  const settleWaiters = (nextToken) => {
    const waiters = waitersRef.current;
    waitersRef.current = [];
    waiters.forEach((resolve) => resolve(nextToken));
  };

  const normalizeUserData = (data = {}, fallbackUser = {}) => ({
    username: data.username ?? fallbackUser?.username ?? '',
    email: data.email ?? fallbackUser?.email ?? '',
    boardColor: data.boardColor || fallbackUser?.boardColor || DEFAULT_BOARD_COLOR,
    permissions: data.permissions ?? fallbackUser?.permissions ?? [],
  });

  const getStorage = () => {
    if (typeof window === 'undefined') return null;

    const storage = window.localStorage;
    if (!storage) return null;

    const hasApi =
      typeof storage.getItem === 'function' &&
      typeof storage.setItem === 'function' &&
      typeof storage.removeItem === 'function';

    return hasApi ? storage : null;
  };

  const safeGetItem = (key) => {
    const storage = getStorage();
    return storage ? storage.getItem(key) : null;
  };

  const safeSetItem = (key, value) => {
    const storage = getStorage();
    if (storage) {
      storage.setItem(key, value);
    }
  };

  const safeRemoveItem = (key) => {
    const storage = getStorage();
    if (storage) {
      storage.removeItem(key);
    }
  };

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const storedToken = safeGetItem('authToken');
    const storedUser = safeGetItem('authUser');

    if (storedToken && storedUser) {
      // Validate token before restoring session
      if (validateToken(storedToken)) {
        tokenRef.current = storedToken;
        setToken(storedToken);
        const restoredUser = normalizeUserData(JSON.parse(storedUser));
        setUser(restoredUser);

        // Permissions can change server-side (and the stored copy may be stale),
        // so refresh them in the background without blocking the session restore.
        getCurrentUser(storedToken)
          .then((response) => {
            // Ignore the response if the user logged out or signed in again meanwhile.
            if (tokenRef.current !== storedToken) return;
            if (response?.success) {
              const refreshed = normalizeUserData(response.data, restoredUser);
              setUser(refreshed);
              safeSetItem('authUser', JSON.stringify(refreshed));
            }
          })
          .catch(() => {});
      } else {
        // Token expired, clear storage
        safeRemoveItem('authToken');
        safeRemoveItem('authUser');
      }
    }
    setLoading(false);
  }, []);

  // A 401 on a signed-in request opens the card and waits for the new token.
  useEffect(
    () =>
      registerSessionBridge({
        currentToken: () => tokenRef.current,
        prompt: () =>
          new Promise((resolve) => {
            waitersRef.current.push(resolve);
            setSessionExpired(true);
          }),
      }),
    []
  );

  // Tokens last a couple of hours and a page left open outlives them: ask for the password when
  // the token runs out, before the next request fails.
  useEffect(() => watchExpiry(token, () => setSessionExpired(true)), [token]);

  // Login function
  const login = async (username, password) => {
    try {
      const response = await loginUser(username, password);

      if (response.success) {
        const userData = normalizeUserData(response);

        tokenRef.current = response.token;
        flushSync(() => {
          setUser(userData);
          setToken(response.token);
        });

        // Persist to localStorage
        safeSetItem('authToken', response.token);
        safeSetItem('authUser', JSON.stringify(userData));

        return { success: true, message: response.message };
      } else {
        return { success: false, message: response.message };
      }
    } catch (_error) {
      return { success: false, message: 'An error occurred during login' };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await logoutUser();

      // Clear state
      tokenRef.current = null;
      setUser(null);
      setToken(null);
      setSessionExpired(false);
      settleWaiters(null);

      // Clear localStorage
      safeRemoveItem('authToken');
      safeRemoveItem('authUser');

      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      return { success: false, message: 'An error occurred during logout' };
    }
  };

  // Signs the same user in again from the session card, then lets the waiting requests resend.
  const refreshSession = async (password) => {
    const result = await login(user?.username ?? '', password);
    if (result.success) {
      setSessionExpired(false);
      settleWaiters(tokenRef.current);
    }
    return result;
  };

  // Check if user is authenticated. A token that runs out mid-session still counts until the user
  // signs in again or signs out from the session card, so pages stay mounted and keep what was
  // typed; a stored session that has already expired is dropped on startup instead.
  const isAuthenticated = () => {
    return user !== null && token !== null;
  };

  // ADMIN implies every permission. This only controls what the UI shows; the
  // API enforces permissions on every protected endpoint.
  const hasPermission = (permission) => {
    const granted = user?.permissions ?? [];
    return granted.includes('ADMIN') || granted.includes(permission);
  };

  // Update user profile
  const updateProfile = async (updates) => {
    try {
      const response = await updateUserProfile(updates, token);

      if (response.success) {
        const updatedUserData = normalizeUserData(response, user);

        setUser(updatedUserData);
        safeSetItem('authUser', JSON.stringify(updatedUserData));
        return { success: true, message: response.message };
      } else {
        return { success: false, message: response.message };
      }
    } catch (_error) {
      return { success: false, message: 'An error occurred during profile update' };
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated,
    hasPermission,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {sessionExpired && user && (
        <SessionExpiredCard username={user.username} onSignIn={refreshSession} onSignOut={logout} />
      )}
    </AuthContext.Provider>
  );
};

export default AuthContext;
