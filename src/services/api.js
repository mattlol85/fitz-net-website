// Real API service for Fitz-Net backend authentication
// In development, requests to /api/* are proxied to the actual backend via Vite
// In production, set VITE_API_BASE_URL to the full backend URL
import { API_URLS } from '../constants';
import { mockApi } from './mockApi';

const API_BASE_URL = API_URLS.FITZ_NET_API;
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

const parseResponseData = async (response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (error) {
      return {};
    }
  }

  try {
    const text = await response.text();
    return text ? { message: text } : {};
  } catch (error) {
    return {};
  }
};


/**
 * Create a new user account
 * @param {string} username - The username
 * @param {string} email - The user's email address
 * @param {string} password - The user's password
 * @returns {Promise<Object>} Response object with success status, message, and user data
 */
export const createUser = async (username, email, password) => {
  try {
    const url = `${API_BASE_URL}/user/create`;
    console.log('👤 Creating user account at:', url);
    console.log('📤 Request body:', { username, email, password: '***' });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      credentials: 'omit',
      body: JSON.stringify({
        username,
        email,
        password,
      }),
    });

    console.log('📥 Response status:', response.status);
    const data = await response.json();
    console.log('📦 Response data:', data);

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to create user account',
      };
    }

    return {
      success: true,
      message: data.message || 'Account created successfully',
      id: data.id,
      username: data.username,
      email: data.email,
    };
  } catch (error) {
    console.error('❌ Create user error:', error);
    return {
      success: false,
      message: 'Network error. Please check your connection and try again.',
    };
  }
};

/**
 * Login with username and password
 * @param {string} username - The username
 * @param {string} password - The user's password
 * @returns {Promise<Object>} Response object with success status, message, user data, and token
 */
export const loginUser = async (username, password) => {
  if (USE_MOCK_API) {
    console.log('🎭 Using mock API for login');
    return mockApi.login(username, password);
  }

  try {
    const url = `${API_BASE_URL}/user/login`;
    console.log('🔐 Attempting login to:', url);
    console.log('📤 Request body:', { username, password: '***' });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      credentials: 'omit',
      body: JSON.stringify({
        username,
        password,
      }),
    });

    console.log('📥 Response status:', response.status);
    const data = await parseResponseData(response);
    console.log('📦 Response data:', data);

    if (!response.ok) {
      const authFallback = response.status === 401 || response.status === 403
        ? 'Invalid username or password'
        : 'Login failed';

      return {
        success: false,
        message: data.message || authFallback,
      };
    }

    return {
      success: data.success !== false,
      message: data.message || 'Login successful',
      username: data.username,
      email: data.email,
      token: data.token,
      boardColor: data.boardColor,
    };
  } catch (error) {
    console.error('❌ Login error:', error);
    return {
      success: false,
      message: 'Network error. Please check your connection and try again.',
    };
  }
};

/**
 * Validate JWT token
 * @param {string} token - The JWT token to validate
 * @returns {boolean} True if token is valid and not expired
 */
export const validateToken = (token) => {
  if (!token) return false;

  try {
    // Parse the token payload
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1]));
    const now = Math.floor(Date.now() / 1000);

    // Check if token is expired
    return payload.exp > now;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};

/**
 * Logout (clear client-side session)
 * @returns {Promise<Object>} Response object with success status
 */
export const logoutUser = async () => {
  // For now, just clear client-side session
  // If backend has a logout endpoint in the future, we can call it here
  return {
    success: true,
    message: 'Logged out successfully',
  };
};

/**
 * Update user profile (username, email, password)
 * @param {Object} updates - Object containing username, email, and optional password
 * @param {string} updates.username - The new username
 * @param {string} updates.email - The new email
 * @param {string} [updates.password] - The new password (optional)
 * @param {string} token - The authentication token
 * @returns {Promise<Object>} Response object with success status and updated user data
 */
export const updateUserProfile = async (updates, token) => {
  if (USE_MOCK_API) {
    console.log('🎭 Using mock API for profile update');
    return mockApi.updateProfile(updates, token);
  }

  if (!token) {
    return {
      success: false,
      message: 'Authentication token is required',
    };
  }

  try {
    const url = `${API_BASE_URL}/user/update`;
    console.log('👤 Updating user profile at:', url);
    console.log('📤 Request body:', { ...updates, password: updates.password ? '***' : undefined });

    const requestBody = {
      username: updates.username,
      email: updates.email,
    };

    // Only include password if provided
    if (updates.password) {
      requestBody.password = updates.password;
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      mode: 'cors',
      credentials: 'omit',
      body: JSON.stringify(requestBody),
    });

    console.log('📥 Response status:', response.status);
    const data = await parseResponseData(response);
    console.log('📦 Response data:', data);

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to update profile',
      };
    }

    return {
      success: true,
      message: data.message || 'Profile updated successfully',
      username: data.username,
      email: data.email,
      boardColor: data.boardColor,
    };
  } catch (error) {
    console.error('❌ Update profile error:', error);
    return {
      success: false,
      message: 'Network error. Please check your connection and try again.',
    };
  }
};

const buildAuthHeaders = (token) => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Authorization': `Bearer ${token}`,
});

const requireToken = (token) => {
  if (!token) {
    return {
      success: false,
      message: 'You must be logged in to use the Overwatch tracker.',
    };
  }

  return null;
};

export const searchOverwatchPlayers = async (name, token) => {
  if (USE_MOCK_API) {
    return mockApi.searchOverwatchPlayers(name, token);
  }

  const tokenError = requireToken(token);
  if (tokenError) return tokenError;

  const trimmedName = name?.trim();
  if (!trimmedName) {
    return {
      success: false,
      message: 'Enter an Overwatch username or BattleTag.',
    };
  }

  try {
    const url = `${API_BASE_URL}/overwatch/search?name=${encodeURIComponent(trimmedName)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: buildAuthHeaders(token),
      mode: 'cors',
      credentials: 'omit',
    });
    const data = await parseResponseData(response);

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Unable to search Overwatch players.',
      };
    }

    const players = Array.isArray(data) ? data : data.results || data.players || [];
    return {
      success: true,
      players,
    };
  } catch (error) {
    console.error('Overwatch search error:', error);
    return {
      success: false,
      message: 'Network error while searching Overwatch players.',
    };
  }
};

export const saveOverwatchProfile = async (playerId, token) => {
  if (USE_MOCK_API) {
    return mockApi.saveOverwatchProfile(playerId, token);
  }

  const tokenError = requireToken(token);
  if (tokenError) return tokenError;

  if (!playerId) {
    return {
      success: false,
      message: 'Choose an Overwatch player to save.',
    };
  }

  try {
    const url = `${API_BASE_URL}/overwatch/profile`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: buildAuthHeaders(token),
      mode: 'cors',
      credentials: 'omit',
      body: JSON.stringify({ playerId, battleTag: playerId, bnetString: playerId }),
    });
    const data = await parseResponseData(response);

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Unable to save Overwatch profile.',
      };
    }

    return {
      success: true,
      profile: data.profile || data,
      message: data.message || 'Overwatch profile saved.',
    };
  } catch (error) {
    console.error('Overwatch save error:', error);
    return {
      success: false,
      message: 'Network error while saving Overwatch profile.',
    };
  }
};

export const getOverwatchProfile = async (token) => {
  if (USE_MOCK_API) {
    return mockApi.getOverwatchProfile(token);
  }

  const tokenError = requireToken(token);
  if (tokenError) return tokenError;

  try {
    const response = await fetch(`${API_BASE_URL}/overwatch/me`, {
      method: 'GET',
      headers: buildAuthHeaders(token),
      mode: 'cors',
      credentials: 'omit',
    });
    const data = await parseResponseData(response);

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Unable to load your Overwatch profile.',
      };
    }

    return {
      success: true,
      profile: data.profile || data,
    };
  } catch (error) {
    console.error('Overwatch profile error:', error);
    return {
      success: false,
      message: 'Network error while loading your Overwatch profile.',
    };
  }
};

export const getOverwatchLeaderboard = async (token) => {
  if (USE_MOCK_API) {
    return mockApi.getOverwatchLeaderboard(token);
  }

  const tokenError = requireToken(token);
  if (tokenError) return tokenError;

  try {
    const response = await fetch(`${API_BASE_URL}/overwatch/leaderboard`, {
      method: 'GET',
      headers: buildAuthHeaders(token),
      mode: 'cors',
      credentials: 'omit',
    });
    const data = await parseResponseData(response);

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Unable to load the Overwatch leaderboard.',
      };
    }

    const leaderboard = Array.isArray(data) ? data : data.leaderboard || data.users || [];
    return {
      success: true,
      leaderboard,
    };
  } catch (error) {
    console.error('Overwatch leaderboard error:', error);
    return {
      success: false,
      message: 'Network error while loading the Overwatch leaderboard.',
    };
  }
};

export const getOverwatchHistory = async (token, playerId) => {
  if (USE_MOCK_API) {
    return mockApi.getOverwatchHistory(token, playerId);
  }

  const tokenError = requireToken(token);
  if (tokenError) return tokenError;

  try {
    const endpoint = playerId
      ? `${API_BASE_URL}/overwatch/${encodeURIComponent(playerId)}/history`
      : `${API_BASE_URL}/overwatch/me/history`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: buildAuthHeaders(token),
      mode: 'cors',
      credentials: 'omit',
    });
    const data = await parseResponseData(response);

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Unable to load Overwatch history.',
      };
    }

    return {
      success: true,
      history: data.history || data,
    };
  } catch (error) {
    console.error('Overwatch history error:', error);
    return {
      success: false,
      message: 'Network error while loading Overwatch history.',
    };
  }
};

export const forgotPassword = async (email) => {
  try {
    const url = `${API_BASE_URL}/user/forgot-password`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      mode: 'cors',
      credentials: 'omit',
      body: JSON.stringify({ email }),
    });
    const data = await parseResponseData(response);
    return { success: response.ok, message: data.message || 'Check your email for a reset link.' };
  } catch (error) {
    console.error('Forgot password error:', error);
    return { success: false, message: 'Network error. Please try again.' };
  }
};

export const resetPassword = async (token, newPassword) => {
  try {
    const url = `${API_BASE_URL}/user/reset-password`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      mode: 'cors',
      credentials: 'omit',
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await parseResponseData(response);
    if (!response.ok) {
      return { success: false, message: data.message || 'Invalid or expired reset link.' };
    }
    return { success: true, message: data.message || 'Password reset successfully.' };
  } catch (error) {
    console.error('Reset password error:', error);
    return { success: false, message: 'Network error. Please try again.' };
  }
};

export const api = {
  createUser,
  loginUser,
  validateToken,
  logoutUser,
  updateUserProfile,
  forgotPassword,
  resetPassword,
  searchOverwatchPlayers,
  saveOverwatchProfile,
  getOverwatchProfile,
  getOverwatchLeaderboard,
  getOverwatchHistory,
};

export default api;

