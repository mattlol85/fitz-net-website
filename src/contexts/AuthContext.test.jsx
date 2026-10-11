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

describe('AuthContext session lifecycle', () => {
  const expiredToken = () => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }));
    return `h.${payload}.s`;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    installLocalStorage();
    api.getCurrentUser.mockResolvedValue({ success: false });
    api.loginUser.mockResolvedValue({ success: false, message: 'nope' });
  });

  it('should throw when useAuth is used outside an AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow('useAuth must be used within an AuthProvider');

    consoleError.mockRestore();
  });

  it('should clear an expired stored session on startup', async () => {
    localStorage.setItem('authToken', expiredToken());
    localStorage.setItem('authUser', JSON.stringify({ username: 'old' }));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('authUser')).toBeNull();
  });

  it('should keep the stored session when refreshing permissions fails', async () => {
    localStorage.setItem('authToken', makeToken());
    localStorage.setItem('authUser', JSON.stringify({ username: 'matt', permissions: ['X'] }));
    api.getCurrentUser.mockRejectedValue(new Error('offline'));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('matt'));
    expect(auth.hasPermission('X')).toBe(true);
  });

  it('should keep the stored user when the permission refresh is unsuccessful', async () => {
    localStorage.setItem('authToken', makeToken());
    localStorage.setItem('authUser', JSON.stringify({ username: 'matt', permissions: ['X'] }));
    api.getCurrentUser.mockResolvedValue({ success: false });

    renderProvider();

    await waitFor(() => expect(api.getCurrentUser).toHaveBeenCalled());
    expect(auth.hasPermission('X')).toBe(true);
  });

  it('should default a missing board colour and permission list on restore', async () => {
    localStorage.setItem('authToken', makeToken());
    localStorage.setItem('authUser', JSON.stringify({ username: 'matt' }));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('matt'));
    expect(auth.user.boardColor).toBe('hsl(200,72%,50%)');
    expect(auth.user.permissions).toEqual([]);
  });

  it('should sign in, persist the session and report success', async () => {
    api.loginUser.mockResolvedValue({
      success: true,
      message: 'Welcome',
      username: 'bob',
      email: 'bob@x.io',
      token: makeToken(),
      boardColor: 'hsl(1,2%,3%)',
      permissions: ['ADMIN'],
    });
    renderProvider();

    let outcome;
    await act(async () => {
      outcome = await auth.login('bob', 'pw');
    });

    expect(outcome).toEqual({ success: true, message: 'Welcome' });
    expect(screen.getByTestId('user')).toHaveTextContent('bob');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.hasPermission('ANYTHING')).toBe(true);
    expect(JSON.parse(localStorage.getItem('authUser')).boardColor).toBe('hsl(1,2%,3%)');
  });

  it('should return the API message when sign-in is rejected', async () => {
    renderProvider();

    let outcome;
    await act(async () => {
      outcome = await auth.login('bob', 'bad');
    });

    expect(outcome).toEqual({ success: false, message: 'nope' });
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('should report a generic error when sign-in throws', async () => {
    api.loginUser.mockRejectedValue(new Error('boom'));
    renderProvider();

    let outcome;
    await act(async () => {
      outcome = await auth.login('bob', 'pw');
    });

    expect(outcome).toEqual({ success: false, message: 'An error occurred during login' });
  });

  it('should report a generic error and keep the session when logout throws', async () => {
    localStorage.setItem('authToken', makeToken());
    localStorage.setItem('authUser', JSON.stringify({ username: 'matt' }));
    api.logoutUser.mockRejectedValueOnce(new Error('boom'));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('matt'));

    let outcome;
    await act(async () => {
      outcome = await auth.logout();
    });

    expect(outcome).toEqual({ success: false, message: 'An error occurred during logout' });
    expect(screen.getByTestId('user')).toHaveTextContent('matt');
  });

  it('should update the stored profile after a successful profile update', async () => {
    localStorage.setItem('authToken', makeToken());
    localStorage.setItem('authUser', JSON.stringify({ username: 'matt', email: 'm@x.io' }));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('matt'));
    api.updateUserProfile.mockResolvedValueOnce({
      success: true,
      message: 'Saved',
      username: 'matt2',
      email: 'm2@x.io',
    });

    let outcome;
    await act(async () => {
      outcome = await auth.updateProfile({ username: 'matt2', email: 'm2@x.io' });
    });

    expect(outcome).toEqual({ success: true, message: 'Saved' });
    expect(screen.getByTestId('user')).toHaveTextContent('matt2');
    expect(JSON.parse(localStorage.getItem('authUser')).email).toBe('m2@x.io');
  });

  it('should return the API message when a profile update is rejected', async () => {
    localStorage.setItem('authToken', makeToken());
    localStorage.setItem('authUser', JSON.stringify({ username: 'matt' }));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('matt'));
    api.updateUserProfile.mockResolvedValueOnce({ success: false, message: 'Taken' });

    let outcome;
    await act(async () => {
      outcome = await auth.updateProfile({ username: 'taken', email: 'x' });
    });

    expect(outcome).toEqual({ success: false, message: 'Taken' });
    expect(screen.getByTestId('user')).toHaveTextContent('matt');
  });

  it('should report a generic error when a profile update throws', async () => {
    renderProvider();
    api.updateUserProfile.mockRejectedValueOnce(new Error('boom'));

    let outcome;
    await act(async () => {
      outcome = await auth.updateProfile({ username: 'x', email: 'y' });
    });

    expect(outcome).toEqual({ success: false, message: 'An error occurred during profile update' });
  });

  it('should not report any permission when signed out', () => {
    renderProvider();

    expect(auth.hasPermission('ADMIN')).toBe(false);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('should work without persisting when localStorage is unavailable', async () => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: undefined });
    renderProvider();

    let outcome;
    api.loginUser.mockResolvedValueOnce({ success: true, username: 'ghost', token: makeToken() });
    await act(async () => {
      outcome = await auth.login('ghost', 'pw');
    });

    expect(outcome.success).toBe(true);
    expect(screen.getByTestId('user')).toHaveTextContent('ghost');
    installLocalStorage();
  });

  it('should skip storage writes when the storage object lacks removeItem', async () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: { getItem: () => null, setItem: vi.fn() },
    });
    renderProvider();

    api.loginUser.mockResolvedValueOnce({ success: true, username: 'partial', token: makeToken() });
    await act(async () => {
      await auth.login('partial', 'pw');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('partial');
    installLocalStorage();
  });
});
