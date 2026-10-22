import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useJoenetApi, useJoenetResource } from './useJoenetApi';
import { JoenetKeyProvider, useJoenetKeys } from '../contexts/JoenetKeyContext';
import * as AuthContext from '../contexts/AuthContext';
import * as api from '../services/api';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const wrapper = ({ children }) => <JoenetKeyProvider>{children}</JoenetKeyProvider>;

describe('useJoenetApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.setItem('joenetKeys', JSON.stringify({ radarr: 'key-1' }));
    AuthContext.useAuth.mockReturnValue({ token: 'jwt', loading: false });
  });

  it('should send the JWT and the verified key with each call', async () => {
    api.joenetRequest.mockResolvedValue({ success: true, status: 200, data: [] });
    const { result } = renderHook(() => useJoenetApi('radarr'), { wrapper });

    await act(() => result.current.call('movie', { method: 'GET' }));

    expect(api.joenetRequest).toHaveBeenCalledWith('radarr', 'movie', 'jwt', 'key-1', { method: 'GET' });
  });

  it('should forget the key when the proxy answers 401', async () => {
    api.joenetRequest.mockResolvedValue({ success: false, status: 401, message: 'nope' });
    const { result } = renderHook(
      () => ({ api: useJoenetApi('radarr'), keys: useJoenetKeys().keys }),
      { wrapper }
    );

    await act(() => result.current.api.call('movie'));

    expect(result.current.keys).toEqual({});
    expect(window.sessionStorage.getItem('joenetKeys')).toBeNull();
  });

  it('should load a resource and expose errors', async () => {
    api.joenetRequest.mockResolvedValueOnce({ success: true, status: 200, data: [{ id: 1 }] });
    const { result } = renderHook(() => useJoenetResource('radarr', 'tag'), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([{ id: 1 }]);

    api.joenetRequest.mockResolvedValueOnce({ success: false, status: 502, message: 'unreachable' });
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.error).toBe('unreachable'));
  });
});
