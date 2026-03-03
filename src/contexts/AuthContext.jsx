import React, { createContext, useState, useEffect, useContext } from 'react';
  import { loginUser, logoutUser, validateToken, updateUserProfile } from '../services/api';

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

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');

    if (storedToken && storedUser) {
      // Validate token before restoring session
      if (validateToken(storedToken)) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } else {
        // Token expired, clear storage
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
      }
    }
    setLoading(false);
  }, []);

  // Login function
  const login = async (username, password) => {
    try {
      console.log('🔑 Login initiated for user:', username);
      const response = await loginUser(username, password);
      console.log('🔑 Login response:', response);

      if (response.success) {
        const userData = {
          username: response.username,
          email: response.email,
        };

        setUser(userData);
        setToken(response.token);

        // Persist to localStorage
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('authUser', JSON.stringify(userData));

        console.log('✅ Login successful, user data stored');
        return { success: true, message: response.message };
      } else {
        console.log('❌ Login failed:', response.message);
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.error('❌ Login error caught:', error);
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
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');

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
      console.log('🔄 Updating user profile');
      const response = await updateUserProfile(updates, token);

      if (response.success) {
        const updatedUserData = {
          username: response.username,
          email: response.email,
        };

        setUser(updatedUserData);
        localStorage.setItem('authUser', JSON.stringify(updatedUserData));
        console.log('✅ Profile updated successfully');
        return { success: true, message: response.message };
      } else {
        console.log('❌ Profile update failed:', response.message);
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.error('❌ Profile update error caught:', error);
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

