import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Mock @react-three/fiber — Canvas can't render WebGL in jsdom
vi.mock('@react-three/fiber', () => ({
  Canvas: () => React.createElement('div', { 'data-testid': 'gamerbell-canvas' }),
  useThree: vi.fn(() => ({})),
  useFrame: vi.fn(),
  extend: vi.fn(),
}));

// Mock @react-three/drei components used in the scene
vi.mock('@react-three/drei', () => ({
  Text: ({ children }) => React.createElement('span', { 'data-testid': 'three-text' }, children),
  OrbitControls: () => null,
  PerspectiveCamera: () => null,
}));


// Mock the API service to prevent real API calls during tests
vi.mock('./services/api', () => ({
  createUser: vi.fn(async (username, email, password) => ({
    success: true,
    message: 'Account created successfully',
    id: '123',
    username,
    email,
  })),
  loginUser: vi.fn(async (username, password) => ({
    success: true,
    message: 'Login successful',
    username,
    email: `${username}@test.com`,
    token: 'mock-jwt-token-123',
  })),
  validateToken: vi.fn((token) => {
    if (!token) return false;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      return payload.exp > now;
    } catch (error) {
      return false;
    }
  }),
  logoutUser: vi.fn(async () => ({
    success: true,
    message: 'Logged out successfully',
  })),
}));

// Also mock mockApi for backward compatibility (in case it's still imported)
vi.mock('./services/mockApi', () => ({
  mockApi: {
    createUser: vi.fn(async (username, email, password) => ({
      success: true,
      username,
      email,
    })),
    login: vi.fn(async (username, password) => ({
      success: true,
      username,
      email: `${username}@test.com`,
      token: 'mock-token',
    })),
    validateToken: vi.fn(() => true),
    logout: vi.fn(async () => ({ success: true })),
  },
}));

