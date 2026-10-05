import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import * as api from '../services/api';

const makeToken = () => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `h.${payload}.s`;
};

let auth;
const Probe = () => {
  auth = useAuth();
  return <div data-testid="user">{auth.user?.username ?? 'none'}</div>;
};

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );

// The test environment doesn't provide a usable localStorage, so use an in-memory one.
const installLocalStorage = () => {
  const store = new Map();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
  });
};

describe('AuthContext permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installLocalStorage();
    localStorage.setItem('authToken', makeToken());
    localStorage.setItem('authUser', JSON.stringify({ username: 'matt', permissions: [] }));
  });

  it('refreshes permissions from /user/me on session restore', async () => {
    api.getCurrentUser.mockResolvedValue({
      success: true,
      data: { username: 'matt', permissions: ['RADARR'] },
    });
    renderProvider();

    await waitFor(() => expect(auth.hasPermission('RADARR')).toBe(true));
    expect(auth.hasPermission('SONARR')).toBe(false);
  });

  it('treats ADMIN as having every permission', async () => {
    api.getCurrentUser.mockResolvedValue({
      success: true,
      data: { username: 'matt', permissions: ['ADMIN'] },
    });
    renderProvider();

    await waitFor(() => expect(auth.hasPermission('ANYTHING')).toBe(true));
  });

  it('ignores a late /user/me response after logout', async () => {
    let resolveMe;
    api.getCurrentUser.mockReturnValue(new Promise((resolve) => (resolveMe = resolve)));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('matt'));

    await act(async () => {
      await auth.logout();
    });
    await act(async () => {
      resolveMe({ success: true, data: { username: 'matt', permissions: ['ADMIN'] } });
    });

    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(localStorage.getItem('authUser')).toBeNull();
  });
});
