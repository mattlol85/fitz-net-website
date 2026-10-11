import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamChatWithNode } from './nodeService';
import { sendMessageToNode } from './aiChatService';

function sseResponse(chunks, init = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' }, ...init });
}

const META = 'event: meta\ndata: {"model":"qwen3:14b","nodeId":"n1"}\n\n';

describe('streamChatWithNode', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('emits tokens (even when split across chunks) and resolves with the full reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        META,
        ':\n\n',
        'event: token\ndata: {"content":"Hel',
        'lo"}\n\nevent: token\ndata: {"content":" world"}\n\n',
        'event: done\ndata: {}\n\n',
      ])
    );
    vi.stubGlobal('fetch', fetchMock);
    const onToken = vi.fn();

    const reply = await streamChatWithNode('n1', 'hi', 'qwen3:14b', 'jwt', { onToken });

    expect(reply).toBe('Hello world');
    expect(onToken.mock.calls).toEqual([['Hello'], [' world']]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/node\/n1\/chat\/stream$/);
    expect(options.headers.Authorization).toBe('Bearer jwt');
  });

  it('sends the full history and reports meta and usage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        'event: meta\ndata: {"model":"m","nodeId":"n1","contextLength":8192}\n\n',
        'event: token\ndata: {"content":"x"}\n\n',
        'event: done\ndata: {"promptTokens":12,"completionTokens":3,"contextLength":8192}\n\n',
      ])
    );
    vi.stubGlobal('fetch', fetchMock);
    const onMeta = vi.fn();
    const onDone = vi.fn();
    const messages = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ];

    await streamChatWithNode('n1', messages, 'm', 'jwt', { onMeta, onDone });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ messages, model: 'm' });
    expect(onMeta).toHaveBeenCalledWith({ model: 'm', nodeId: 'n1', contextLength: 8192 });
    expect(onDone).toHaveBeenCalledWith({ promptTokens: 12, completionTokens: 3, contextLength: 8192 });
  });

  it('rejects with the API message on an error event', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([META, 'event: error\ndata: {"message":"Node stopped responding for 180s"}\n\n'])
      )
    );

    await expect(streamChatWithNode('n1', 'hi', null, 'jwt')).rejects.toThrow(
      'Node stopped responding for 180s'
    );
  });

  it('rejects when the stream ends without done', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse([META])));

    await expect(streamChatWithNode('n1', 'hi', null, 'jwt')).rejects.toThrow(/closed before/);
  });

  it('reports proxy timeouts clearly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Gateway Timeout</html>', { status: 504 }))
    );

    await expect(streamChatWithNode('n1', 'hi', null, 'jwt')).rejects.toThrow(
      'The node took too long to respond (HTTP 504).'
    );
  });

  it('surfaces the API error message for non-timeout failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Node not found' }), { status: 404 })
      )
    );

    await expect(streamChatWithNode('n1', 'hi', null, 'jwt')).rejects.toThrow('Node not found');
  });
});

describe('sendMessageToNode', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports the growing reply and then done', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          META,
          'event: token\ndata: {"content":"a"}\n\n',
          'event: token\ndata: {"content":"b"}\n\n',
          'event: done\ndata: {}\n\n',
        ])
      )
    );
    const onToken = vi.fn();

    sendMessageToNode('n1', 'qwen3:14b', 'hi', 'jwt', onToken);

    await vi.waitFor(() => expect(onToken).toHaveBeenLastCalledWith('ab', true));
    expect(onToken).toHaveBeenCalledWith('a', false);
  });

  it('aborts the request on cancel and reports nothing further', async () => {
    let seenSignal;
    vi.stubGlobal(
      'fetch',
      vi.fn((url, { signal }) => {
        seenSignal = signal;
        return new Promise((_, reject) =>
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        );
      })
    );
    const onToken = vi.fn();

    const cancel = sendMessageToNode('n1', 'qwen3:14b', 'hi', 'jwt', onToken);
    cancel();
    await Promise.resolve();

    expect(seenSignal.aborted).toBe(true);
    expect(onToken).not.toHaveBeenCalled();
  });
});

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

  it('should report a missing message for failed streams without a JSON body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad gateway', { status: 500 })));
    const { streamChatWithNode } = await import('./nodeService');

    await expect(streamChatWithNode('n1', 'hi', null, 'jwt')).rejects.toThrow('Failed to reach node: 500');
  });

  it('should skip unknown events and keep-alive frames while streaming', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('event: meta\n\n'));
        controller.enqueue(encoder.encode('event: token\ndata: {"content":"ok"}\n\n'));
        controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    const { streamChatWithNode } = await import('./nodeService');

    expect(await streamChatWithNode('n1', 'hi', null, 'jwt')).toBe('ok');
  });

  it('should use a default error message when an error event has no message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(sseResponse(['event: error\ndata: {}\n\n']))
    );
    const { streamChatWithNode } = await import('./nodeService');

    await expect(streamChatWithNode('n1', 'hi', null, 'jwt')).rejects.toThrow('The node reported an error.');
  });

  it('should omit the model from the request body when none is given', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(['event: done\ndata: {}\n\n']));
    vi.stubGlobal('fetch', fetchMock);
    const { streamChatWithNode } = await import('./nodeService');

    await streamChatWithNode('n1', 'hi', null, 'jwt');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ prompt: 'hi' });
  });

  it('should tolerate a streamed reply with no onToken callback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse(['event: token\ndata: {"content":"a"}\n\n', 'event: done\ndata: {}\n\n'])
      )
    );
    const { streamChatWithNode } = await import('./nodeService');

    expect(await streamChatWithNode('n1', 'hi', 'm', 'jwt')).toBe('a');
  });
});
