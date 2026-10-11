import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./nodeService', () => ({
  streamChatWithNode: vi.fn(),
}));

import { streamChatWithNode } from './nodeService';
import { sendMessage, sendMessageToNode } from './aiChatService';

describe('aiChatService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('sendMessage (mock mode)', () => {
    it('should reveal a canned reply progressively and mark the final chunk as done', async () => {
      const onToken = vi.fn();
      sendMessage('hello', onToken);

      await vi.advanceTimersByTimeAsync(1000);
      await vi.runAllTimersAsync();

      const lastCall = onToken.mock.calls.at(-1);
      expect(lastCall[1]).toBe(true);
      expect(lastCall[0].length).toBeGreaterThan(0);
      expect(onToken.mock.calls.length).toBeGreaterThan(1);
      const partials = onToken.mock.calls.map(([partial]) => partial);
      expect(partials).toEqual([...partials].sort((a, b) => a.length - b.length));
    });

    it('should not emit anything before the simulated thinking delay has passed', async () => {
      const onToken = vi.fn();
      sendMessage('hello', onToken);

      await vi.advanceTimersByTimeAsync(400);

      expect(onToken).not.toHaveBeenCalled();
    });

    it('should stop emitting after the returned cancel function is called', async () => {
      const onToken = vi.fn();
      const cancel = sendMessage('hello', onToken);

      await vi.advanceTimersByTimeAsync(1000);
      const callsBeforeCancel = onToken.mock.calls.length;
      cancel();
      await vi.runAllTimersAsync();

      expect(onToken.mock.calls.length).toBe(callsBeforeCancel);
    });

    it('should cancel before the reveal starts without emitting anything', async () => {
      const onToken = vi.fn();
      const cancel = sendMessage('hello', onToken);

      cancel();
      await vi.runAllTimersAsync();

      expect(onToken).not.toHaveBeenCalled();
    });

    it('should cycle through the canned replies on successive calls', async () => {
      const first = vi.fn();
      const second = vi.fn();
      sendMessage('a', first);
      sendMessage('b', second);
      await vi.runAllTimersAsync();

      expect(first.mock.calls.at(-1)[0]).not.toBe(second.mock.calls.at(-1)[0]);
    });
  });

  describe('sendMessageToNode (real mode)', () => {
    it('should forward streamed tokens and resolve with the full reply', async () => {
      streamChatWithNode.mockImplementation(async (_id, _p, _m, _t, { onToken }) => {
        onToken('Hel');
        onToken('lo');
        return 'Hello';
      });
      const onToken = vi.fn();

      sendMessageToNode('n1', 'qwen', 'hi', 'jwt', onToken);
      await vi.runAllTimersAsync();

      expect(onToken.mock.calls).toEqual([
        ['Hel', false],
        ['Hello', false],
        ['Hello', true],
      ]);
      expect(streamChatWithNode).toHaveBeenCalledWith(
        'n1',
        'hi',
        'qwen',
        'jwt',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should append the error message to any partial reply when the stream fails', async () => {
      streamChatWithNode.mockImplementation(async (_id, _p, _m, _t, { onToken }) => {
        onToken('partial');
        throw new Error('node gone');
      });
      const onToken = vi.fn();

      sendMessageToNode('n1', null, 'hi', 'jwt', onToken);
      await vi.runAllTimersAsync();

      expect(onToken).toHaveBeenLastCalledWith('partial\n\n⚠️ node gone', true);
    });

    it('should show only the error message when the stream fails before any token', async () => {
      streamChatWithNode.mockRejectedValue(new Error('unreachable'));
      const onToken = vi.fn();

      sendMessageToNode('n1', null, 'hi', 'jwt', onToken);
      await vi.runAllTimersAsync();

      expect(onToken).toHaveBeenLastCalledWith('⚠️ unreachable', true);
    });

    it('should abort the request and emit nothing when cancelled', async () => {
      let capturedSignal;
      streamChatWithNode.mockImplementation((_id, _p, _m, _t, { signal }) => {
        capturedSignal = signal;
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      });
      const onToken = vi.fn();

      const cancel = sendMessageToNode('n1', null, 'hi', 'jwt', onToken);
      cancel();
      await vi.runAllTimersAsync();

      expect(capturedSignal.aborted).toBe(true);
      expect(onToken).not.toHaveBeenCalled();
    });

    it('should not emit a completion when the stream resolves after cancellation', async () => {
      let resolveStream;
      streamChatWithNode.mockImplementation(() => new Promise((resolve) => { resolveStream = resolve; }));
      const onToken = vi.fn();

      const cancel = sendMessageToNode('n1', null, 'hi', 'jwt', onToken);
      cancel();
      resolveStream('late reply');
      await vi.runAllTimersAsync();

      expect(onToken).not.toHaveBeenCalled();
    });

    it('should not emit an error when the request fails after cancellation', async () => {
      let rejectStream;
      streamChatWithNode.mockImplementation(() => new Promise((_resolve, reject) => { rejectStream = reject; }));
      const onToken = vi.fn();

      const cancel = sendMessageToNode('n1', null, 'hi', 'jwt', onToken);
      cancel();
      rejectStream(new Error('late'));
      await vi.runAllTimersAsync();

      expect(onToken).not.toHaveBeenCalled();
    });
  });
});
