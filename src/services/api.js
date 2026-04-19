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
    };
  } catch (error) {
    console.error('❌ Update profile error:', error);
    return {
      success: false,
      message: 'Network error. Please check your connection and try again.',
    };
  }
};

export const api = {
  createUser,
  loginUser,
  validateToken,
  logoutUser,
  updateUserProfile,
};

export default api;

