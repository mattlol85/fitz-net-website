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
