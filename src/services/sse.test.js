import { describe, expect, it, vi } from 'vitest';
import { parseSseFrame, readSseStream, StreamClosedError } from './sse';

const encoder = new TextEncoder();

function bodyOf(chunks) {
  return new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(typeof c === 'string' ? encoder.encode(c) : c));
      controller.close();
    },
  });
}

/** A stream that stays open until cancelled, like a real response the browser is still reading. */
function openBody(chunks) {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
    },
    cancel() {
      cancelled = true;
    },
  });
  return { body, wasCancelled: () => cancelled };
}

const collect = async (chunks, options) => {
  const events = [];
  const terminal = await readSseStream(bodyOf(chunks), (name, data) => events.push([name, data]), options);
  return { events, terminal };
};

describe('parseSseFrame', () => {
  it('should read the event name and JSON data', () => {
    expect(parseSseFrame('event: token\ndata: {"content":"hi"}')).toEqual({
      event: 'token',
      data: { content: 'hi' },
    });
  });

  it('should join multi-line data before parsing', () => {
    expect(parseSseFrame('event: meta\ndata: {"a":\ndata: 1}')).toEqual({ event: 'meta', data: { a: 1 } });
  });

  it('should return null for comment frames, data-less frames and invalid JSON', () => {
    expect(parseSseFrame(':')).toBeNull();
    expect(parseSseFrame(': keep-alive')).toBeNull();
    expect(parseSseFrame('event: token')).toBeNull();
    expect(parseSseFrame('event: token\ndata: {nope')).toBeNull();
  });
});

describe('readSseStream', () => {
  it('should deliver events in order and resolve with the done event', async () => {
    const { events, terminal } = await collect([
      'event: meta\ndata: {"model":"m"}\n\n',
      'event: token\ndata: {"content":"Hi"}\n\n',
      'event: done\ndata: {"promptTokens":3}\n\n',
    ]);

    expect(events.map(([name]) => name)).toEqual(['meta', 'token', 'done']);
    expect(terminal).toEqual({ event: 'done', data: { promptTokens: 3 } });
  });

  it('should reassemble frames split across chunks, even mid-line and mid-character', async () => {
    const bytes = encoder.encode('event: token\ndata: {"content":"héllo"}\n\n');
    const cut = bytes.indexOf(0xc3) + 1; // split inside the two-byte é
    const { events } = await collect([
      bytes.slice(0, 10),
      bytes.slice(10, cut),
      bytes.slice(cut),
      'event: done\ndata: {}\n\n',
    ]);

    expect(events[0]).toEqual(['token', { content: 'héllo' }]);
  });

  it('should handle CRLF line endings, including a CRLF split between chunks', async () => {
    const { events } = await collect([
      'event: token\r\ndata: {"content":"a"}\r\n\r',
      '\nevent: token\r\ndata: {"content":"b"}\r\n\r\n',
      'event: done\r\ndata: {}\r\n\r\n',
    ]);

    expect(events.map(([, data]) => data.content)).toEqual(['a', 'b', undefined]);
  });

  it('should skip comment frames and comment lines inside a frame', async () => {
    const { events } = await collect([
      ':\n\n',
      ': ping\nevent: token\ndata: {"content":"x"}\n\n',
      ':\n\nevent: done\ndata: {}\n\n',
    ]);

    expect(events).toEqual([
      ['token', { content: 'x' }],
      ['done', {}],
    ]);
  });

  it('should ignore unknown events and malformed JSON', async () => {
    const { events } = await collect([
      'event: tool_call\ndata: {"id":"1"}\n\n',
      'event: token\ndata: {broken\n\n',
      'data: {"anonymous":true}\n\n',
      'event: token\ndata: {"content":"ok"}\n\n',
      'event: done\ndata: {}\n\n',
    ]);

    expect(events.map(([name]) => name)).toEqual(['token', 'done']);
  });

  it('should resolve with the error event and stop reading after it', async () => {
    const { events, terminal } = await collect([
      'event: error\ndata: {"code":"NODE_OFFLINE","message":"Matt-PC is offline."}\n\n',
      'event: token\ndata: {"content":"never seen"}\n\n',
    ]);

    expect(terminal.event).toBe('error');
    expect(terminal.data.code).toBe('NODE_OFFLINE');
    expect(events).toHaveLength(1);
  });

  it('should reject with StreamClosedError when the stream ends without done or error', async () => {
    const onEvent = vi.fn();

    await expect(
      readSseStream(bodyOf(['event: token\ndata: {"content":"partial"}\n\n']), onEvent)
    ).rejects.toBeInstanceOf(StreamClosedError);
    expect(onEvent).toHaveBeenCalledWith('token', { content: 'partial' });
  });

  it('should accept a final frame that is missing its trailing blank line', async () => {
    const { terminal } = await collect(['event: done\ndata: {"promptTokens":1}']);

    expect(terminal.event).toBe('done');
  });

  it('should reject with an AbortError and cancel the body when the signal aborts', async () => {
    const controller = new AbortController();
    const { body, wasCancelled } = openBody(['event: token\ndata: {"content":"a"}\n\n']);
    const onEvent = vi.fn(() => controller.abort());

    await expect(readSseStream(body, onEvent, { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(wasCancelled()).toBe(true);
  });

  it('should reject immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      readSseStream(bodyOf(['event: done\ndata: {}\n\n']), vi.fn(), { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('should stop and cancel the body when the callback throws', async () => {
    const { body, wasCancelled } = openBody(['event: token\ndata: {"content":"a"}\n\n']);

    await expect(
      readSseStream(body, () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    await vi.waitFor(() => expect(wasCancelled()).toBe(true));
  });
});
