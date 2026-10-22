import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// setupTests.js replaces this module globally; exercise the real implementation.
vi.unmock('./mockApi');
import { mockApi } from './mockApi';

const makeToken = (payload) => {
  const enc = (o) => btoa(JSON.stringify(o));
  return `${enc({ alg: 'HS384' })}.${enc(payload)}.sig`;
};

describe('mockApi', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('login', () => {
    it('should return user details and a token for a known user with the right password', async () => {
      const promise = mockApi.login('changmin', 'testing123');
      await vi.advanceTimersByTimeAsync(500);
      const result = await promise;

      expect(result).toMatchObject({
        success: true,
        message: 'Login successful',
        username: 'changmin',
        email: 'changminlee@gmail.com',
        boardColor: 'hsl(210,72%,50%)',
      });
      expect(result.token.split('.')).toHaveLength(3);
    });

    it('shouldLoginRegardlessOfUsernameCase', async () => {
      const promise = mockApi.login('  ChAnGmIn ', 'testing123');
      await vi.advanceTimersByTimeAsync(500);
      const result = await promise;

      expect(result).toMatchObject({
        success: true,
        message: 'Login successful',
        username: 'changmin',
        email: 'changminlee@gmail.com',
      });
    });

    it('should return an unknown-user failure when the username does not exist', async () => {
      const promise = mockApi.login('nobody', 'x');
      await vi.advanceTimersByTimeAsync(500);

      expect(await promise).toEqual({ success: false, message: 'User not found' });
    });

    it('should return an invalid-password failure when the password is wrong', async () => {
      const promise = mockApi.login('testuser', 'wrong');
      await vi.advanceTimersByTimeAsync(500);

      expect(await promise).toEqual({ success: false, message: 'Invalid password' });
    });
  });

  describe('logout', () => {
    it('should report a successful logout after a short delay', async () => {
      const promise = mockApi.logout();
      await vi.advanceTimersByTimeAsync(200);

      expect(await promise).toEqual({ success: true, message: 'Logout successful' });
    });
  });

  describe('validateToken', () => {
    it('should return false when no token is provided', () => {
      expect(mockApi.validateToken(undefined)).toBe(false);
    });

    it('should return false when the token has the wrong number of parts', () => {
      expect(mockApi.validateToken('a.b')).toBe(false);
    });

    it('should return false when the payload cannot be decoded', () => {
      expect(mockApi.validateToken('a.@@@.c')).toBe(false);
    });

    it('should return true for an unexpired token', () => {
      const exp = Math.floor(Date.now() / 1000) + 60;
      expect(mockApi.validateToken(makeToken({ exp }))).toBe(true);
    });

    it('should return false for an expired token', () => {
      const exp = Math.floor(Date.now() / 1000) - 60;
      expect(mockApi.validateToken(makeToken({ exp }))).toBe(false);
    });
  });

  describe('updateProfile', () => {
    it('should require a token', async () => {
      const promise = mockApi.updateProfile({ username: 'a', email: 'a@b.c' }, null);
      await vi.advanceTimersByTimeAsync(400);

      expect(await promise).toEqual({ success: false, message: 'Authentication token is required' });
    });

    it('should echo the updated profile and default the board colour', async () => {
      const promise = mockApi.updateProfile({ username: 'a', email: 'a@b.c' }, 'tok');
      await vi.advanceTimersByTimeAsync(400);

      expect(await promise).toEqual({
        success: true,
        message: 'Profile updated successfully',
        username: 'a',
        email: 'a@b.c',
        boardColor: 'hsl(210,72%,50%)',
      });
    });

    it('should use the requested board colour when one is provided', async () => {
      const promise = mockApi.updateProfile({ username: 'a', email: 'a@b.c', boardColor: 'hsl(1,2%,3%)' }, 'tok');
      await vi.advanceTimersByTimeAsync(400);

      expect((await promise).boardColor).toBe('hsl(1,2%,3%)');
    });
  });

  describe('joenetRequest', () => {
    const call = async (...args) => {
      const promise = mockApi.joenetRequest(...args);
      await vi.advanceTimersByTimeAsync(150);
      return promise;
    };

    it('should reject a missing or invalid key with a 401', async () => {
      expect(await call('radarr', 'system/status', '')).toMatchObject({ success: false, status: 401 });
      expect(await call('radarr', 'system/status', 'invalid')).toMatchObject({ success: false, status: 401 });
    });

    it('should answer system/status for both apps', async () => {
      expect((await call('radarr', 'system/status', 'k')).data.appName).toBe('Radarr');
      expect((await call('sonarr', 'system/status', 'k')).data.appName).toBe('Sonarr');
    });

    it('should keep library changes in memory', async () => {
      const before = (await call('radarr', 'movie', 'k')).data;
      expect(before.length).toBeGreaterThan(1);

      await call('radarr', `movie/${before[0].id}`, 'k', { method: 'PUT', body: { monitored: false } });
      expect((await call('radarr', `movie/${before[0].id}`, 'k')).data.monitored).toBe(false);

      await call('radarr', `movie/${before[0].id}`, 'k', { method: 'DELETE' });
      expect((await call('radarr', 'movie', 'k')).data).toHaveLength(before.length - 1);
    });

    it('should add a looked-up title to the library', async () => {
      const lookup = (await call('sonarr', 'series/lookup?term=silo', 'k')).data;
      const created = await call('sonarr', 'series', 'k', { method: 'POST', body: lookup[0] });

      expect(created).toMatchObject({ success: true, status: 201 });
      expect(created.data.id).toBeGreaterThan(0);
    });

    it('should paginate queue and history as records', async () => {
      expect((await call('radarr', 'queue', 'k')).data.records.length).toBeGreaterThan(0);
      expect((await call('sonarr', 'history', 'k')).data.records.length).toBeGreaterThan(0);
    });

    it('should accept commands and 404 on unknown paths', async () => {
      expect(await call('radarr', 'command', 'k', { method: 'POST', body: { name: 'RssSync' } })).toMatchObject({
        success: true,
        data: { name: 'RssSync' },
      });
      expect(await call('radarr', 'nope', 'k')).toMatchObject({ success: false, status: 404 });
      expect(await call('lidarr', 'system/status', 'k')).toMatchObject({ success: false, status: 404 });
    });
  });
});
