import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// setupTests.js mocks these modules globally; the tests here exercise the real code.
vi.unmock('./api');
vi.unmock('./mockApi');

const jsonResponse = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

const textResponse = (text, init = {}) =>
  new Response(text, { status: 200, headers: { 'Content-Type': 'text/plain' }, ...init });

const makeJwt = (payload) => {
  const enc = (o) => btoa(JSON.stringify(o));
  return `${enc({ alg: 'HS384' })}.${enc(payload)}.sig`;
};

const loadApi = async () => import('./api');

describe('api service (real API)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_USE_MOCK_API', 'false');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe('createUser', () => {
    it('should return the created account details on success', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({ id: '1', username: 'bob', email: 'bob@x.io', message: 'Created' })
      );
      vi.stubGlobal('fetch', fetchMock);
      const { createUser } = await loadApi();

      const result = await createUser('bob', 'bob@x.io', 'pw');

      expect(result).toEqual({ success: true, message: 'Created', id: '1', username: 'bob', email: 'bob@x.io' });
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/user\/create$/);
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ username: 'bob', email: 'bob@x.io', password: 'pw' });
    });

    it('should use a default success message when the API sends none', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: '1' })));
      const { createUser } = await loadApi();

      const result = await createUser('bob', 'bob@x.io', 'pw');

      expect(result.message).toBe('Account created successfully');
    });

    it('should return the API error message when the request fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'Username taken' }, { status: 409 })));
      const { createUser } = await loadApi();

      expect(await createUser('bob', 'bob@x.io', 'pw')).toEqual({ success: false, message: 'Username taken' });
    });

    it('should fall back to a generic message when a failed response has no message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, { status: 500 })));
      const { createUser } = await loadApi();

      expect(await createUser('bob', 'bob@x.io', 'pw')).toEqual({
        success: false,
        message: 'Failed to create user account',
      });
    });

    it('should report a server error (not a network error) when the failure body is not JSON', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(textResponse('<html>boom</html>', { status: 500 })));
      const { createUser } = await loadApi();

      const result = await createUser('bob', 'bob@x.io', 'pw');

      expect(result.success).toBe(false);
      expect(result.message).toBe('<html>boom</html>');
      expect(result.message).not.toMatch(/Network error/);
    });

    it('should return a network error message when fetch rejects', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      const { createUser } = await loadApi();

      const result = await createUser('bob', 'bob@x.io', 'pw');

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Network error/);
    });
  });

  describe('loginUser', () => {
    it('should return user details and token on success', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          jsonResponse({
            username: 'bob',
            email: 'bob@x.io',
            token: 'tok',
            boardColor: 'hsl(1,2%,3%)',
            permissions: ['ADMIN'],
          })
        )
      );
      const { loginUser } = await loadApi();

      expect(await loginUser('bob', 'pw')).toEqual({
        success: true,
        message: 'Login successful',
        username: 'bob',
        email: 'bob@x.io',
        token: 'tok',
        boardColor: 'hsl(1,2%,3%)',
        permissions: ['ADMIN'],
      });
    });

    it('should treat an explicit success:false body as a failed login', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: false, message: 'nope' })));
      const { loginUser } = await loadApi();

      const result = await loginUser('bob', 'pw');

      expect(result.success).toBe(false);
      expect(result.message).toBe('nope');
    });

    it('should use an invalid-credentials message for 401 responses without a message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, { status: 401 })));
      const { loginUser } = await loadApi();

      expect(await loginUser('bob', 'pw')).toEqual({ success: false, message: 'Invalid username or password' });
    });

    it('should use the same invalid-credentials message for 403 responses', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, { status: 403 })));
      const { loginUser } = await loadApi();

      expect((await loginUser('bob', 'pw')).message).toBe('Invalid username or password');
    });

    it('should use a generic failure message for other error statuses', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, { status: 500 })));
      const { loginUser } = await loadApi();

      expect((await loginUser('bob', 'pw')).message).toBe('Login failed');
    });

    it('should surface the API message on error statuses when provided', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'Locked' }, { status: 423 })));
      const { loginUser } = await loadApi();

      expect((await loginUser('bob', 'pw')).message).toBe('Locked');
    });

    it('should handle a non-JSON content-type on a successful response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(textResponse('')));
      const { loginUser } = await loadApi();

      const result = await loginUser('bob', 'pw');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Login successful');
    });

    it('should return a network error when fetch rejects', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
      const { loginUser } = await loadApi();

      expect((await loginUser('bob', 'pw')).message).toMatch(/Network error/);
    });

    it('should delegate to the mock API when mock mode is enabled', async () => {
      vi.stubEnv('VITE_USE_MOCK_API', 'true');
      vi.resetModules();
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const { loginUser } = await loadApi();

      const result = await loginUser('changmin', 'testing123');

      expect(result.success).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('parseResponseData (via loginUser)', () => {
    it('should return an empty message fallback when a non-JSON body cannot be read', async () => {
      const brokenResponse = {
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.reject(new Error('stream error')),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(brokenResponse));
      const { loginUser } = await loadApi();

      expect((await loginUser('bob', 'pw')).message).toBe('Login failed');
    });

    it('should return an empty object when a JSON body fails to parse', async () => {
      const badJson = new Response('{not json', {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(badJson));
      const { loginUser } = await loadApi();

      expect((await loginUser('bob', 'pw')).message).toBe('Login failed');
    });

    it('should return an empty object when a response has no content-type', async () => {
      const noType = new Response('', { status: 500, headers: {} });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(noType));
      const { loginUser } = await loadApi();

      expect((await loginUser('bob', 'pw')).message).toBe('Login failed');
    });
  });

  describe('validateToken', () => {
    it('should return false when no token is provided', async () => {
      const { validateToken } = await loadApi();
      expect(validateToken(null)).toBe(false);
      expect(validateToken('')).toBe(false);
    });

    it('should return false when the token does not have three parts', async () => {
      const { validateToken } = await loadApi();
      expect(validateToken('only.two')).toBe(false);
    });

    it('should return false when the payload is not valid base64 JSON', async () => {
      const { validateToken } = await loadApi();
      expect(validateToken('a.%%%.c')).toBe(false);
    });

    it('should return true for a token that has not expired', async () => {
      const { validateToken } = await loadApi();
      const exp = Math.floor(Date.now() / 1000) + 600;
      expect(validateToken(makeJwt({ exp }))).toBe(true);
    });

    it('should return false for an expired token', async () => {
      const { validateToken } = await loadApi();
      const exp = Math.floor(Date.now() / 1000) - 600;
      expect(validateToken(makeJwt({ exp }))).toBe(false);
    });
  });

  describe('logoutUser', () => {
    it('should report a successful client-side logout', async () => {
      const { logoutUser } = await loadApi();
      expect(await logoutUser()).toEqual({ success: true, message: 'Logged out successfully' });
    });
  });

  describe('updateUserProfile', () => {
    it('should require a token', async () => {
      const { updateUserProfile } = await loadApi();
      expect(await updateUserProfile({ username: 'a', email: 'a@b.c' }, null)).toEqual({
        success: false,
        message: 'Authentication token is required',
      });
    });

    it('should send username and email without a password when none is given', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({ username: 'a', email: 'a@b.c', boardColor: 'hsl(1,1%,1%)', permissions: [] })
      );
      vi.stubGlobal('fetch', fetchMock);
      const { updateUserProfile } = await loadApi();

      const result = await updateUserProfile({ username: 'a', email: 'a@b.c' }, 'tok');

      expect(result).toEqual({
        success: true,
        message: 'Profile updated successfully',
        username: 'a',
        email: 'a@b.c',
        boardColor: 'hsl(1,1%,1%)',
        permissions: [],
      });
      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe('PUT');
      expect(options.headers.Authorization).toBe('Bearer tok');
      expect(JSON.parse(options.body)).toEqual({ username: 'a', email: 'a@b.c' });
    });

    it('should include the password when one is provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ username: 'a', email: 'a@b.c' }));
      vi.stubGlobal('fetch', fetchMock);
      const { updateUserProfile } = await loadApi();

      await updateUserProfile({ username: 'a', email: 'a@b.c', password: 'new' }, 'tok');

      expect(JSON.parse(fetchMock.mock.calls[0][1].body).password).toBe('new');
    });

    it('should return the API error message when the update fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'Email in use' }, { status: 409 })));
      const { updateUserProfile } = await loadApi();

      expect(await updateUserProfile({ username: 'a', email: 'a@b.c' }, 'tok')).toEqual({
        success: false,
        message: 'Email in use',
      });
    });

    it('should use a generic message when a failed update has no message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, { status: 500 })));
      const { updateUserProfile } = await loadApi();

      expect((await updateUserProfile({ username: 'a', email: 'a@b.c' }, 'tok')).message).toBe(
        'Failed to update profile'
      );
    });

    it('should return a network error when fetch rejects', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
      const { updateUserProfile } = await loadApi();

      expect((await updateUserProfile({ username: 'a', email: 'a@b.c' }, 'tok')).message).toMatch(/Network error/);
    });

    it('should delegate to the mock API in mock mode', async () => {
      vi.stubEnv('VITE_USE_MOCK_API', 'true');
      vi.resetModules();
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const { updateUserProfile } = await loadApi();

      const result = await updateUserProfile({ username: 'a', email: 'a@b.c' }, 'tok');

      expect(result.success).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('authenticated admin endpoints', () => {
    it('should fetch the current user with the bearer token', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ username: 'a' }));
      vi.stubGlobal('fetch', fetchMock);
      const { getCurrentUser } = await loadApi();

      expect(await getCurrentUser('tok')).toEqual({ success: true, data: { username: 'a' } });
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/user\/me$/);
      expect(options.method).toBe('GET');
      expect(options.headers.Authorization).toBe('Bearer tok');
      expect(options.body).toBeUndefined();
    });

    it('should require a token for authenticated requests', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const { getCurrentUser, getAdminUsers } = await loadApi();

      expect(await getCurrentUser('')).toEqual({ success: false, message: 'Authentication token is required' });
      expect(await getAdminUsers(undefined)).toEqual({
        success: false,
        message: 'Authentication token is required',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should return the HTTP status and message when an authenticated request fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'Forbidden' }, { status: 403 })));
      const { getAdminUsers } = await loadApi();

      expect(await getAdminUsers('tok')).toEqual({ success: false, status: 403, message: 'Forbidden' });
    });

    it('should use a generic message when an authenticated failure has no message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, { status: 500 })));
      const { getAvailablePermissions } = await loadApi();

      expect(await getAvailablePermissions('tok')).toEqual({
        success: false,
        status: 500,
        message: 'Request failed',
      });
    });

    it('should return a network error when an authenticated request rejects', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
      const { getAdminUsers } = await loadApi();

      expect((await getAdminUsers('tok')).message).toMatch(/Network error/);
    });

    it('should list available permissions', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ name: 'ADMIN' }]));
      vi.stubGlobal('fetch', fetchMock);
      const { getAvailablePermissions } = await loadApi();

      const result = await getAvailablePermissions('tok');

      expect(result.data).toEqual([{ name: 'ADMIN' }]);
      expect(fetchMock.mock.calls[0][0]).toMatch(/\/admin\/permissions$/);
    });

    it('should create a permission with a JSON body', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ name: 'X' }));
      vi.stubGlobal('fetch', fetchMock);
      const { createPermission } = await loadApi();

      await createPermission('X', 'desc', 'tok');

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/admin\/permissions$/);
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ name: 'X', description: 'desc' });
    });

    it('should delete a permission with an encoded name', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      vi.stubGlobal('fetch', fetchMock);
      const { deletePermission } = await loadApi();

      const result = await deletePermission('needs space/x', 'tok');

      expect(fetchMock.mock.calls[0][0]).toMatch(/\/admin\/permissions\/needs%20space%2Fx$/);
      expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
      expect(result.success).toBe(true);
    });

    it('should replace a user permission set with an encoded username', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ username: 'a b' }));
      vi.stubGlobal('fetch', fetchMock);
      const { setUserPermissions } = await loadApi();

      await setUserPermissions('a b', ['ADMIN'], 'tok');

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/admin\/users\/a%20b\/permissions$/);
      expect(options.method).toBe('PUT');
      expect(JSON.parse(options.body)).toEqual({ permissions: ['ADMIN'] });
    });

    it('should return mock-unavailable results for every admin call in mock mode', async () => {
      vi.stubEnv('VITE_USE_MOCK_API', 'true');
      vi.resetModules();
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const api = await loadApi();
      const unavailable = { success: false, message: 'Not available in mock mode' };

      expect(await api.getCurrentUser('t')).toEqual(unavailable);
      expect(await api.getAvailablePermissions('t')).toEqual(unavailable);
      expect(await api.createPermission('n', 'd', 't')).toEqual(unavailable);
      expect(await api.deletePermission('n', 't')).toEqual(unavailable);
      expect(await api.getAdminUsers('t')).toEqual(unavailable);
      expect(await api.setUserPermissions('u', [], 't')).toEqual(unavailable);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('default export', () => {
    it('should expose every endpoint on the api object', async () => {
      const mod = await loadApi();

      expect(mod.default).toBe(mod.api);
      expect(Object.keys(mod.api).sort()).toEqual(
        [
          'createUser', 'loginUser', 'validateToken', 'logoutUser', 'updateUserProfile',
          'getCurrentUser', 'getAvailablePermissions', 'createPermission', 'deletePermission',
          'getAdminUsers', 'setUserPermissions',
        ].sort()
      );
    });
  });
});
