import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, buildUrl, request, requestBlob } from './apiClient';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('apiClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('should drop empty query values and repeat the key for arrays', () => {
    const url = buildUrl('/recipes', { ingredient: ['egg', 'flour', ''], q: '', chapterId: null, limit: 5 });
    expect(url).toMatch(/\/recipes\?ingredient=egg&ingredient=flour&limit=5$/);
  });

  it('should leave the URL bare when there is no query', () => {
    expect(buildUrl('/recipe-book')).toMatch(/\/recipe-book$/);
  });

  it('should send JSON with the bearer token and resolve the parsed body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await request('PUT', '/thing', { token: 'jwt', body: { a: 1 } });

    const [, options] = fetchMock.mock.calls[0];
    expect(result).toEqual({ ok: true });
    expect(options.method).toBe('PUT');
    expect(options.headers.Authorization).toBe('Bearer jwt');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ a: 1 });
  });

  it('should throw an ApiError with the server message and status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ message: 'Nope' }, 404)));

    const error = await request('GET', '/thing', { token: 'jwt' }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.message).toBe('Nope');
  });

  it('should explain a gateway timeout when the body has no message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 504 })));

    const error = await request('GET', '/thing', { token: 'jwt' }).catch((e) => e);

    expect(error.message).toMatch(/too long to respond/);
  });

  it('should resolve a Blob for raw downloads and use the fallback message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('abc')));
    const blob = await requestBlob('/img/1', { token: 'jwt' });
    expect(blob.size).toBe(3);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('', { status: 500 })));
    const error = await requestBlob('/img/1', { token: 'jwt', fallback: 'Image failed' }).catch((e) => e);
    expect(error.message).toBe('Image failed: 500');
  });
});
