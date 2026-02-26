// Real API service for Fitz-Net backend authentication
// In development, requests to /api/* are proxied to the actual backend via Vite
// In production, set VITE_API_BASE_URL to the full backend URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

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
      },
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
  try {
    const url = `${API_BASE_URL}/user/login`;
    console.log('🔐 Attempting login to:', url);
    console.log('📤 Request body:', { username, password: '***' });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    console.log('📥 Response status:', response.status);
    const data = await response.json();
    console.log('📦 Response data:', data);

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Login failed',
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

export const api = {
  createUser,
  loginUser,
  validateToken,
  logoutUser,
};

export default api;

