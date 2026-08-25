import React, { createContext, useState, useEffect, useContext } from 'react';
import { flushSync } from 'react-dom';
import { loginUser, logoutUser, validateToken, updateUserProfile } from '../services/api';
import { DEFAULT_BOARD_COLOR } from '../constants';

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

  const normalizeUserData = (data = {}, fallbackUser = {}) => ({
    username: data.username ?? fallbackUser?.username ?? '',
    email: data.email ?? fallbackUser?.email ?? '',
    boardColor: data.boardColor || fallbackUser?.boardColor || DEFAULT_BOARD_COLOR,
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
        setToken(storedToken);
        setUser(normalizeUserData(JSON.parse(storedUser)));
      } else {
        // Token expired, clear storage
        safeRemoveItem('authToken');
        safeRemoveItem('authUser');
      }
    }
    setLoading(false);
  }, []);

  // Login function
  const login = async (username, password) => {
    try {
      const response = await loginUser(username, password);

      if (response.success) {
        const userData = normalizeUserData(response);

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
      setUser(null);
      setToken(null);

      // Clear localStorage
      safeRemoveItem('authToken');
      safeRemoveItem('authUser');

      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      return { success: false, message: 'An error occurred during logout' };
    }
  };

  // Check if user is authenticated
  const isAuthenticated = () => {
    return user !== null && token !== null && validateToken(token);
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
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
