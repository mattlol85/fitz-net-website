import { afterEach, describe, expect, it, vi } from 'vitest';

describe('nodeService registry and enrollment', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('should fetch the node list from the API', async () => {
    const nodes = [{ id: 'n1', status: 'ONLINE' }];
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(nodes), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchNodes } = await import('./nodeService');

    expect(await fetchNodes()).toEqual(nodes);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/node\/list$/);
  });

  it('should throw with the HTTP status when the node list cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    const { fetchNodes } = await import('./nodeService');

    await expect(fetchNodes()).rejects.toThrow('Failed to fetch node list: 503');
  });

  it('should return mock nodes without calling the API in mock mode', async () => {
    vi.stubEnv('VITE_USE_MOCK_API', 'true');
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { fetchNodes, generateEnrollmentToken } = await import('./nodeService');

    const nodes = await fetchNodes();

    expect(nodes.map((n) => n.status)).toEqual(['ONLINE', 'OFFLINE']);
    expect(fetchMock).not.toHaveBeenCalled();
    const token = await generateEnrollmentToken('jwt', 'label');
    expect(token.token).toMatch(/^mock-token-/);
    expect(new Date(token.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('should request an enrollment token with the label and bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: 'abc', expiresAt: 'later' }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { generateEnrollmentToken } = await import('./nodeService');

    const data = await generateEnrollmentToken('jwt', 'garage-pc');

    expect(data).toEqual({ token: 'abc', expiresAt: 'later' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/node\/enrollment-token$/);
    expect(options.headers.Authorization).toBe('Bearer jwt');
    expect(JSON.parse(options.body)).toEqual({ label: 'garage-pc' });
  });

  it('should send an empty body when no label is given', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"token":"x"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { generateEnrollmentToken } = await import('./nodeService');

    await generateEnrollmentToken('jwt');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({});
  });

  it('should throw the API message when enrollment token generation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Admins only' }), { status: 403 }))
    );
    const { generateEnrollmentToken } = await import('./nodeService');

    await expect(generateEnrollmentToken('jwt')).rejects.toThrow('Admins only');
  });

  it('should throw with the HTTP status when enrollment fails without a JSON message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 500 })));
    const { generateEnrollmentToken } = await import('./nodeService');

    await expect(generateEnrollmentToken('jwt')).rejects.toThrow('Failed to generate enrollment token: 500');
  });
});
