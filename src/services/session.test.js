import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshToken, installSessionRefresh, registerSessionBridge, tokenExpiresAt, watchExpiry } from './session';

const jwt = (payload) => {
  const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `h.${body}.s`;
};

const unauthorized = () => ({ ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) });
const ok = () => ({ ok: true, status: 200, json: async () => ({}) });
const bearer = (call) => new Headers(call[1].headers).get('Authorization');

describe('tokenExpiresAt', () => {
  it('reads the expiry of a base64url JWT', () => {
    expect(tokenExpiresAt(jwt({ sub: 'matt??>', exp: 1700000000 }))).toBe(1700000000 * 1000);
  });

  it('returns null for tokens without a readable expiry', () => {
    expect(tokenExpiresAt('not-a-jwt')).toBeNull();
    expect(tokenExpiresAt(jwt({ sub: 'matt' }))).toBeNull();
  });
});

describe('watchExpiry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires once the token runs out', () => {
    const onExpired = vi.fn();
    watchExpiry(jwt({ exp: Math.floor(Date.now() / 1000) + 60 }), onExpired);

    vi.advanceTimersByTime(59_000);
    expect(onExpired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('fires straight away for a token that has already expired', () => {
    const onExpired = vi.fn();
    watchExpiry(jwt({ exp: Math.floor(Date.now() / 1000) - 1 }), onExpired);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('does nothing once cancelled, or for a token without an expiry', () => {
    const onExpired = vi.fn();
    const cancel = watchExpiry(jwt({ exp: Math.floor(Date.now() / 1000) + 60 }), onExpired);
    watchExpiry('opaque-token', onExpired);
    watchExpiry(null, onExpired);
    cancel();

    vi.advanceTimersByTime(120_000);
    expect(onExpired).not.toHaveBeenCalled();
  });
});

describe('installSessionRefresh', () => {
  let originalFetch;
  let fetchSpy;
  let unregister;
  let currentToken;
  let prompt;

  beforeEach(() => {
    originalFetch = window.fetch;
    fetchSpy = vi.fn();
    window.fetch = fetchSpy;
    installSessionRefresh();
    currentToken = 'old';
    prompt = vi.fn(async () => {
      currentToken = 'new';
      return 'new';
    });
    unregister = registerSessionBridge({ currentToken: () => currentToken, prompt });
  });

  afterEach(() => {
    unregister();
    window.fetch = originalFetch;
  });

  it('passes responses other than 401 straight through', async () => {
    fetchSpy.mockResolvedValue(ok());
    const response = await window.fetch('/api/ai/models', { headers: { Authorization: 'Bearer old' } });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(prompt).not.toHaveBeenCalled();
  });

  it('asks the user to sign in again and resends the request with the new token', async () => {
    fetchSpy.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(ok());
    const body = JSON.stringify({ settings: { systemPrompt: 'Be terse.' } });
    const response = await window.fetch('/api/ai/conversations/c1', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer old', 'Content-Type': 'application/json' },
      body,
    });

    expect(response.status).toBe(200);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(bearer(fetchSpy.mock.calls[1])).toBe('Bearer new');
    expect(fetchSpy.mock.calls[1][1]).toMatchObject({ method: 'PATCH', body });
    expect(new Headers(fetchSpy.mock.calls[1][1].headers).get('Content-Type')).toBe('application/json');
  });

  it('shows one prompt for several requests that fail together', async () => {
    let finish;
    prompt.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => {
            currentToken = 'new';
            resolve('new');
          };
        })
    );
    fetchSpy.mockImplementation(async (url, init) =>
      new Headers(init.headers).get('Authorization') === 'Bearer new' ? ok() : unauthorized()
    );
    const init = { headers: { Authorization: 'Bearer old' } };

    const all = Promise.all([window.fetch('/api/ai/models', init), window.fetch('/api/ai/presets', init)]);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    finish();
    const responses = await all;

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
  });

  it('resends a request that went out with an old token without asking again', async () => {
    currentToken = 'new';
    fetchSpy.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(ok());
    const response = await window.fetch('/api/ai/models', { headers: { Authorization: 'Bearer old' } });

    expect(response.status).toBe(200);
    expect(prompt).not.toHaveBeenCalled();
    expect(bearer(fetchSpy.mock.calls[1])).toBe('Bearer new');
  });

  it('returns the original 401 when the user signs out instead', async () => {
    prompt.mockResolvedValue(null);
    const rejected = unauthorized();
    fetchSpy.mockResolvedValue(rejected);
    const response = await window.fetch('/api/ai/models', { headers: { Authorization: 'Bearer old' } });

    expect(response).toBe(rejected);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not prompt when nobody is signed in', async () => {
    currentToken = null;
    fetchSpy.mockResolvedValue(unauthorized());
    const response = await window.fetch('/api/ai/models', { headers: { Authorization: 'Bearer old' } });

    expect(response.status).toBe(401);
    expect(prompt).not.toHaveBeenCalled();
  });

  it('leaves requests without a bearer token, and other sites, alone', async () => {
    fetchSpy.mockResolvedValue(unauthorized());
    await window.fetch('/api/user/login', { method: 'POST', body: '{}' });
    await window.fetch('/api/joenet/apps', { headers: { 'X-API-Key': 'k' } });
    await window.fetch('https://example.com/data', { headers: { Authorization: 'Bearer old' } });

    expect(prompt).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('rejects with AbortError when the caller aborts while waiting for the sign-in', async () => {
    prompt.mockImplementation(() => new Promise(() => {}));
    fetchSpy.mockResolvedValue(unauthorized());
    const controller = new AbortController();
    const pending = window.fetch('/api/ai/conversations/c1', {
      headers: { Authorization: 'Bearer old' },
      signal: controller.signal,
    });

    await vi.waitFor(() => expect(prompt).toHaveBeenCalled());
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('freshToken', () => {
  it('resolves null when no session bridge is registered', async () => {
    await expect(freshToken('old')).resolves.toBeNull();
  });
});
