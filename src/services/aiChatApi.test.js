import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from './aiChatApi';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function sseResponse(chunks) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function stubFetch(response) {
  // Responses are single-use, so hand out a fresh clone per call.
  const fetchMock = vi.fn().mockImplementation(async () => response.clone());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Splits a recorded fetch call into method, URL path + query, headers and parsed body. */
function lastCall(fetchMock) {
  const [url, options] = fetchMock.mock.calls.at(-1);
  return {
    method: options.method,
    url,
    path: url.replace(/^.*?(\/ai\/)/, '/ai/'),
    headers: options.headers,
    body: options.body === undefined ? undefined : JSON.parse(options.body),
    signal: options.signal,
  };
}

describe('aiChatApi requests', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('should GET the catalogue with the bearer token and no body', async () => {
    const fetchMock = stubFetch(json({ nodes: [], models: [] }));

    const result = await api.listModels('jwt');

    const call = lastCall(fetchMock);
    expect(result).toEqual({ nodes: [], models: [] });
    expect(call.method).toBe('GET');
    expect(call.path).toBe('/ai/models');
    expect(call.headers.Authorization).toBe('Bearer jwt');
    expect(call.headers['Content-Type']).toBeUndefined();
    expect(call.body).toBeUndefined();
  });

  it('should ask the catalogue to bypass its caches when refreshing', async () => {
    const fetchMock = stubFetch(json({}));

    await api.listModels('jwt', { refresh: true });

    expect(lastCall(fetchMock).path).toBe('/ai/models?refresh=true');
  });

  it('should POST the warm-up target as JSON', async () => {
    const fetchMock = stubFetch(json({ state: 'loading' }));

    await api.warmUp('jwt', { model: 'llama3.1:8b' });

    const call = lastCall(fetchMock);
    expect(call.method).toBe('POST');
    expect(call.path).toBe('/ai/warmup');
    expect(call.headers['Content-Type']).toBe('application/json');
    expect(call.body).toEqual({ model: 'llama3.1:8b', nodeId: null });
  });

  it('should GET and PUT the preferences', async () => {
    const fetchMock = stubFetch(json({ lastTarget: null }));

    await api.getPreferences('jwt');
    expect(lastCall(fetchMock)).toMatchObject({ method: 'GET', path: '/ai/preferences' });

    await api.updatePreferences('jwt', { lastTarget: { model: 'm', nodeId: 'n1' } });
    expect(lastCall(fetchMock)).toMatchObject({
      method: 'PUT',
      path: '/ai/preferences',
      body: { lastTarget: { model: 'm', nodeId: 'n1' } },
    });
  });

  it('should list conversations with q, limit and offset and skip empty parameters', async () => {
    const fetchMock = stubFetch(json({ items: [], hasMore: false }));

    await api.listConversations('jwt', { q: 'bell & co', limit: 50, offset: 0 });
    expect(lastCall(fetchMock).path).toBe('/ai/conversations?q=bell+%26+co&limit=50&offset=0');

    await api.listConversations('jwt', { q: '' });
    expect(lastCall(fetchMock).path).toBe('/ai/conversations');
  });

  it('should cover conversation create, read, patch, delete and title with the right verbs', async () => {
    const fetchMock = stubFetch(json({ id: 'c1' }));

    await api.createConversation('jwt', { target: { model: 'm', nodeId: null } });
    expect(lastCall(fetchMock)).toMatchObject({
      method: 'POST',
      path: '/ai/conversations',
      body: { target: { model: 'm', nodeId: null } },
    });

    await api.getConversation('jwt', 'c1');
    expect(lastCall(fetchMock)).toMatchObject({ method: 'GET', path: '/ai/conversations/c1' });

    await api.updateConversation('jwt', 'c1', { title: 'New name', pinned: true });
    expect(lastCall(fetchMock)).toMatchObject({
      method: 'PATCH',
      path: '/ai/conversations/c1',
      body: { title: 'New name', pinned: true },
    });

    await api.deleteConversation('jwt', 'c1');
    expect(lastCall(fetchMock)).toMatchObject({ method: 'DELETE', path: '/ai/conversations/c1' });

    await api.generateTitle('jwt', 'c1');
    expect(lastCall(fetchMock)).toMatchObject({ method: 'POST', path: '/ai/conversations/c1/title' });
  });

  it('should send the preflight target as query parameters and summarize with POST', async () => {
    const fetchMock = stubFetch(json({}));

    await api.getContextUsage('jwt', 'c1', { model: 'phi3:mini', nodeId: 'n2' });
    expect(lastCall(fetchMock)).toMatchObject({
      method: 'GET',
      path: '/ai/conversations/c1/context?model=phi3%3Amini&nodeId=n2',
    });

    await api.summarizeConversation('jwt', 'c1');
    expect(lastCall(fetchMock)).toMatchObject({ method: 'POST', path: '/ai/conversations/c1/summarize' });
  });

  it('should URL-encode path ids', async () => {
    const fetchMock = stubFetch(json({}));

    await api.getConversation('jwt', 'a/b c');

    expect(lastCall(fetchMock).path).toBe('/ai/conversations/a%2Fb%20c');
  });

  it('should cover the preset and attachment endpoints', async () => {
    const fetchMock = stubFetch(json({}));

    await api.listPresets('jwt');
    expect(lastCall(fetchMock)).toMatchObject({ method: 'GET', path: '/ai/presets' });
    await api.createPreset('jwt', { name: 'Reviewer' });
    expect(lastCall(fetchMock)).toMatchObject({ method: 'POST', path: '/ai/presets', body: { name: 'Reviewer' } });
    await api.updatePreset('jwt', 'p1', { name: 'Reviewer 2' });
    expect(lastCall(fetchMock)).toMatchObject({ method: 'PUT', path: '/ai/presets/p1' });
    await api.deletePreset('jwt', 'p1');
    expect(lastCall(fetchMock)).toMatchObject({ method: 'DELETE', path: '/ai/presets/p1' });
    await api.uploadAttachment('jwt', { name: 'a.png', mimeType: 'image/png', dataBase64: 'AAAA' });
    expect(lastCall(fetchMock)).toMatchObject({
      method: 'POST',
      path: '/ai/attachments',
      body: { name: 'a.png', mimeType: 'image/png', dataBase64: 'AAAA' },
    });
  });

  it('should fetch an attachment as a Blob with the bearer token', async () => {
    const fetchMock = stubFetch(new Response('bytes', { status: 200, headers: { 'Content-Type': 'image/png' } }));

    const blob = await api.fetchAttachment('jwt', 'att1');

    // Not instanceof: Response.blob() comes from Node, Blob from jsdom (two realms on CI).
    expect(blob.size).toBe(5);
    expect(blob.type).toBe('image/png');
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/ai\/attachments\/att1$/);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt');
  });

  it('should throw an ApiError carrying the status and the server message', async () => {
    stubFetch(json({ message: 'Conversation not found' }, 404));

    const error = await api.getConversation('jwt', 'nope').catch((e) => e);

    expect(error).toBeInstanceOf(api.ApiError);
    expect(error.status).toBe(404);
    expect(error.message).toBe('Conversation not found');
  });

  it('should fall back to a status message when the error body is not JSON', async () => {
    stubFetch(new Response('<html>oops</html>', { status: 500 }));

    await expect(api.listModels('jwt')).rejects.toMatchObject({
      status: 500,
      message: 'Request failed: 500',
    });
  });

  it('should explain proxy timeouts clearly', async () => {
    stubFetch(new Response('<html>Gateway Timeout</html>', { status: 504 }));

    await expect(api.listModels('jwt')).rejects.toMatchObject({
      status: 504,
      message: 'The server took too long to respond (HTTP 504).',
    });
  });

  it('should pass the abort signal to fetch', async () => {
    const fetchMock = stubFetch(json({}));
    const controller = new AbortController();

    await api.listModels('jwt', { signal: controller.signal });

    expect(lastCall(fetchMock).signal).toBe(controller.signal);
  });
});

describe('aiChatApi turn streams', () => {
  afterEach(() => vi.unstubAllGlobals());

  const DONE = 'event: done\ndata: {"messageId":"m2","promptTokens":5,"completionTokens":2}\n\n';

  it('should POST the message with SSE headers and deliver events to the callback', async () => {
    const fetchMock = stubFetch(
      sseResponse([
        'event: meta\ndata: {"model":"m"}\n\n',
        ':\n\n',
        'event: token\ndata: {"content":"Hi"}\n\n',
        DONE,
      ])
    );
    const onEvent = vi.fn();
    const controller = new AbortController();

    const result = await api.sendMessage(
      'jwt',
      'c1',
      { content: 'hello', target: { model: 'm', nodeId: null } },
      { signal: controller.signal, onEvent }
    );

    const call = lastCall(fetchMock);
    expect(call.method).toBe('POST');
    expect(call.path).toBe('/ai/conversations/c1/messages');
    expect(call.headers.Accept).toBe('text/event-stream');
    expect(call.headers.Authorization).toBe('Bearer jwt');
    expect(call.body).toEqual({ content: 'hello', target: { model: 'm', nodeId: null } });
    expect(call.signal).toBe(controller.signal);
    expect(onEvent.mock.calls.map(([name]) => name)).toEqual(['meta', 'token', 'done']);
    expect(result.event).toBe('done');
  });

  it('should hit the regenerate and edit endpoints', async () => {
    const fetchMock = stubFetch(sseResponse([DONE]));
    await api.regenerateMessage('jwt', 'c1', 'm9', { target: { model: 'm', nodeId: 'n2' } });
    expect(lastCall(fetchMock)).toMatchObject({
      method: 'POST',
      path: '/ai/conversations/c1/messages/m9/regenerate',
      body: { target: { model: 'm', nodeId: 'n2' } },
    });

    await api.editMessage('jwt', 'c1', 'm1', { content: 'fixed' });
    expect(lastCall(fetchMock)).toMatchObject({
      method: 'POST',
      path: '/ai/conversations/c1/messages/m1/edit',
      body: { content: 'fixed' },
    });
  });

  it('should send an empty JSON object when regenerating without a body', async () => {
    const fetchMock = stubFetch(sseResponse([DONE]));

    await api.regenerateMessage('jwt', 'c1', 'm9');

    expect(lastCall(fetchMock).body).toEqual({});
  });

  it('should throw an ApiError before any event when the API rejects the turn', async () => {
    stubFetch(json({ message: 'A reply is already being generated.' }, 409));
    const onEvent = vi.fn();

    await expect(api.sendMessage('jwt', 'c1', { content: 'x' }, { onEvent })).rejects.toMatchObject({
      status: 409,
      message: 'A reply is already being generated.',
    });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('should reject when the stream closes without a terminal event', async () => {
    stubFetch(sseResponse(['event: token\ndata: {"content":"x"}\n\n']));

    await expect(api.sendMessage('jwt', 'c1', { content: 'x' })).rejects.toMatchObject({
      code: 'STREAM_CLOSED',
    });
  });

  it('should resolve with the error event rather than throwing', async () => {
    stubFetch(sseResponse(['event: error\ndata: {"code":"NODE_OFFLINE","message":"offline"}\n\n']));

    const result = await api.sendMessage('jwt', 'c1', { content: 'x' });

    expect(result).toEqual({ event: 'error', data: { code: 'NODE_OFFLINE', message: 'offline' } });
  });
});

describe('aiChatApi in mock mode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('should answer from the in-memory mock without calling fetch', async () => {
    vi.stubEnv('VITE_USE_MOCK_API', 'true');
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const mockApi = await import('./aiChatApi');
    const { configureMock } = await import('./mocks/aiChatMock');
    configureMock({ latencyMs: 0, tokenDelayMs: 0, thinkDelayMs: 0, loadDelayMs: 0 });

    const catalogue = await mockApi.listModels('jwt');
    const events = [];
    const conversation = await mockApi.createConversation('jwt', { target: { model: 'llama3.1:8b', nodeId: null } });
    const result = await mockApi.sendMessage('jwt', conversation.id, { content: 'hello' }, {
      onEvent: (name) => events.push(name),
    });

    expect(catalogue.nodes).toHaveLength(3);
    expect(events[0]).toBe('meta');
    expect(result.event).toBe('done');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
