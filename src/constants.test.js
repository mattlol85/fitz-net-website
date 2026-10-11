import { afterEach, describe, expect, it, vi } from 'vitest';

describe('constants', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('should use the configured API and GamerBell URLs when they are set', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubEnv('VITE_GAMERBELL_URL', 'https://bell.example.com');
    const { API_URLS } = await import('./constants');

    expect(API_URLS.FITZ_NET_API).toBe('https://api.example.com');
    expect(API_URLS.GAMERBELL).toBe('https://bell.example.com');
  });

  it('should fall back to relative API and default GamerBell URLs when unset', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_GAMERBELL_URL', '');
    const { API_URLS } = await import('./constants');

    expect(API_URLS.FITZ_NET_API).toBe('/api');
    expect(API_URLS.GAMERBELL).toBe('https://gamerbell.fitznet.doomdns.org');
  });

  it('should point the website health check at the current origin in the browser', async () => {
    const { API_CONFIGS } = await import('./constants');

    expect(API_CONFIGS[0]).toEqual({
      name: 'fitz-net-website',
      url: window.location.origin,
      local: true,
    });
  });

  it('should fall back to localhost when there is no window', async () => {
    vi.stubGlobal('window', undefined);
    const { API_CONFIGS } = await import('./constants');

    expect(API_CONFIGS[0].url).toBe('http://localhost:3000');
  });

  it('should default the default export to the URL map', async () => {
    const mod = await import('./constants');

    expect(mod.default).toBe(mod.API_URLS);
  });
});
