import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JoenetKeyProvider, useJoenetKeys } from './JoenetKeyContext';
import * as AuthContext from './AuthContext';

vi.mock('./AuthContext', () => ({
  useAuth: vi.fn(),
}));

let latest;
function Probe() {
  latest = useJoenetKeys();
  return <p>keys: {Object.keys(latest.keys).join(',') || 'none'}</p>;
}

describe('JoenetKeyContext', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    AuthContext.useAuth.mockReturnValue({ token: 'tok', loading: false });
  });

  it('should keep saved keys in sessionStorage and never in localStorage', () => {
    const localStore = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('localStorage', localStore);
    render(<JoenetKeyProvider><Probe /></JoenetKeyProvider>);

    act(() => latest.saveKey('radarr', 'abc'));

    expect(JSON.parse(window.sessionStorage.getItem('joenetKeys'))).toEqual({ radarr: 'abc' });
    expect(localStore.setItem).not.toHaveBeenCalled();
  });

  it('should restore keys from sessionStorage on mount', () => {
    window.sessionStorage.setItem('joenetKeys', JSON.stringify({ sonarr: 'xyz' }));

    render(<JoenetKeyProvider><Probe /></JoenetKeyProvider>);

    expect(screen.getByText('keys: sonarr')).toBeInTheDocument();
  });

  it('should forget a single key', () => {
    window.sessionStorage.setItem('joenetKeys', JSON.stringify({ radarr: 'a', sonarr: 'b' }));
    render(<JoenetKeyProvider><Probe /></JoenetKeyProvider>);

    act(() => latest.forgetKey('radarr'));

    expect(screen.getByText('keys: sonarr')).toBeInTheDocument();
    expect(JSON.parse(window.sessionStorage.getItem('joenetKeys'))).toEqual({ sonarr: 'b' });
  });

  it('should clear every key and the stored copy when the user logs out', () => {
    window.sessionStorage.setItem('joenetKeys', JSON.stringify({ radarr: 'a', sonarr: 'b' }));
    const { rerender } = render(<JoenetKeyProvider><Probe /></JoenetKeyProvider>);
    expect(screen.getByText('keys: radarr,sonarr')).toBeInTheDocument();

    AuthContext.useAuth.mockReturnValue({ token: null, loading: false });
    rerender(<JoenetKeyProvider><Probe /></JoenetKeyProvider>);

    expect(screen.getByText('keys: none')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('joenetKeys')).toBeNull();
  });

  it('should not drop restored keys while the session is still loading', () => {
    window.sessionStorage.setItem('joenetKeys', JSON.stringify({ radarr: 'a' }));
    AuthContext.useAuth.mockReturnValue({ token: null, loading: true });

    render(<JoenetKeyProvider><Probe /></JoenetKeyProvider>);

    expect(screen.getByText('keys: radarr')).toBeInTheDocument();
  });

  it('should keep working when sessionStorage throws', () => {
    const fail = () => {
      throw new Error('storage unavailable');
    };
    vi.stubGlobal('sessionStorage', { getItem: fail, setItem: fail, removeItem: fail });
    render(<JoenetKeyProvider><Probe /></JoenetKeyProvider>);

    act(() => latest.saveKey('radarr', 'abc'));

    expect(screen.getByText('keys: radarr')).toBeInTheDocument();
  });
});
