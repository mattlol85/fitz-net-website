import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Capture the mock Client instance so we can assert publish() calls
let mockClientInstance = null;

vi.mock('@stomp/stompjs', () => {
  // Must use a regular function (not arrow) so it can be called with `new`
  const Client = vi.fn(function(config) {
    this.activate = vi.fn(() => { config.onConnect?.(); });
    this.deactivate = vi.fn();
    this.publish = vi.fn();
    this.subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
    Object.defineProperty(this, 'active', { get: () => true });
    mockClientInstance = this;
  });
  return { Client };
});

import { Client } from '@stomp/stompjs';
import {
  init, disconnect, sendCursor, sendMessage,
  subscribeCursors, subscribeMessages, subscribeCursorRemove, subscribeCleared, subscribeBoardState,
  FADE_DURATION_MS,
} from './liveBoardService.js';

describe('liveBoardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClientInstance = null;
    disconnect();
  });

  afterEach(() => {
    disconnect();
  });

  test('FADE_DURATION_MS is 86400000 (24 hours)', () => {
    expect(FADE_DURATION_MS).toBe(86_400_000);
  });

  test('subscribeCursors registers a callback and returns an unsubscribe function', () => {
    const cb = vi.fn();
    const unsub = subscribeCursors(cb);
    expect(typeof unsub).toBe('function');
    unsub();
  });

  test('subscribeMessages registers a callback and returns an unsubscribe function', () => {
    const cb = vi.fn();
    const unsub = subscribeMessages(cb);
    expect(typeof unsub).toBe('function');
    unsub();
  });

  test('init passes JWT as Authorization header to STOMP client', () => {
    init('test-jwt-token');
    expect(Client).toHaveBeenCalledWith(
      expect.objectContaining({
        connectHeaders: { Authorization: 'Bearer test-jwt-token' },
      })
    );
  });

  test('sendCursor publishes to /app/board/cursor', () => {
    init('test-jwt-token');
    sendCursor(0.3, 0.7);
    expect(mockClientInstance.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: '/app/board/cursor',
        body: JSON.stringify({ xRatio: 0.3, yRatio: 0.7, painting: false, color: '' }),
      })
    );
  });

  test('sendCursor includes painting=true and color when provided', () => {
    init('test-jwt-token');
    sendCursor(0.5, 0.5, true, 'hsl(200,72%,50%)');
    expect(mockClientInstance.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: '/app/board/cursor',
        body: JSON.stringify({ xRatio: 0.5, yRatio: 0.5, painting: true, color: 'hsl(200,72%,50%)' }),
      })
    );
  });

  test('sendMessage publishes to /app/board/message', () => {
    init('test-jwt-token');
    sendMessage(0.5, 0.5, 'hello world');
    expect(mockClientInstance.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: '/app/board/message',
        body: JSON.stringify({ xRatio: 0.5, yRatio: 0.5, content: 'hello world' }),
      })
    );
  });
});

describe('liveBoardService STOMP routing', () => {
  // Capture the destination callbacks the service registers on connect.
  const callbackFor = (destination) => {
    const call = mockClientInstance.subscribe.mock.calls.find(([dest]) => dest === destination);
    return call?.[1];
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientInstance = null;
    disconnect();
  });

  afterEach(() => {
    disconnect();
    vi.unstubAllEnvs();
  });

  it('should route inbound STOMP frames to the matching subscribers', () => {
    const cursors = vi.fn();
    const messages = vi.fn();
    const removed = vi.fn();
    const cleared = vi.fn();
    const boardState = vi.fn();
    const unsubs = [
      subscribeCursors(cursors),
      subscribeMessages(messages),
      subscribeCursorRemove(removed),
      subscribeCleared(cleared),
      subscribeBoardState(boardState),
    ];

    init('tok');
    callbackFor('/topic/board/cursors')({ body: '{"username":"a"}' });
    callbackFor('/topic/board/messages')({ body: '{"id":"m1"}' });
    callbackFor('/topic/board/cursor-remove')({ body: '{"username":"a"}' });
    callbackFor('/topic/board/cleared')({ body: '' });
    callbackFor('/app/board/join')({ body: '{"messages":[]}' });

    expect(cursors).toHaveBeenCalledWith({ username: 'a' });
    expect(messages).toHaveBeenCalledWith({ id: 'm1' });
    expect(removed).toHaveBeenCalledWith({ username: 'a' });
    expect(cleared).toHaveBeenCalledWith(null);
    expect(boardState).toHaveBeenCalledWith({ messages: [] });
    unsubs.forEach((unsub) => unsub());
  });

  it('should keep delivering to other handlers when one handler throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = vi.fn(() => {
      throw new Error('handler failed');
    });
    const good = vi.fn();
    const unsubBad = subscribeCursors(bad);
    const unsubGood = subscribeCursors(good);

    init('tok');
    callbackFor('/topic/board/cursors')({ body: '{"username":"a"}' });

    expect(bad).toHaveBeenCalled();
    expect(good).toHaveBeenCalledWith({ username: 'a' });
    expect(consoleError).toHaveBeenCalledWith('liveBoardService handler error', expect.any(Error));
    unsubBad();
    unsubGood();
    consoleError.mockRestore();
  });

  it('should stop delivering to a subscriber after it unsubscribes', () => {
    const cb = vi.fn();
    const unsub = subscribeCursors(cb);
    unsub();

    init('tok');
    callbackFor('/topic/board/cursors')({ body: '{"username":"a"}' });

    expect(cb).not.toHaveBeenCalled();
  });

  it('should log STOMP protocol errors reported by the broker', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    init('tok');
    const config = Client.mock.calls.at(-1)[0];

    config.onStompError({ headers: { message: 'bad' } });

    expect(consoleError).toHaveBeenCalledWith('[LiveBoard] STOMP error:', { headers: { message: 'bad' } });
    consoleError.mockRestore();
  });

  it('should not open a second connection while one is active', () => {
    init('tok');
    init('tok');

    expect(Client).toHaveBeenCalledTimes(1);
  });

  it('should send the full cursor payload when the connection is active', () => {
    init('tok');

    sendCursor(0.1, 0.2, true, 'red');

    expect(mockClientInstance.publish).toHaveBeenCalledWith({
      destination: '/app/board/cursor',
      body: JSON.stringify({ xRatio: 0.1, yRatio: 0.2, painting: true, color: 'red' }),
    });
  });

  it('should not publish when the connection is not active', () => {
    Client.mockImplementationOnce(function () {
      this.activate = vi.fn();
      this.deactivate = vi.fn();
      this.publish = vi.fn();
      this.subscribe = vi.fn();
      this.active = false;
      mockClientInstance = this;
    });

    init('tok');
    sendCursor(0.1, 0.2);
    sendMessage(0.1, 0.2, 'hi');

    expect(mockClientInstance.publish).not.toHaveBeenCalled();
  });

  it('should tolerate a subscription that fails to unsubscribe on disconnect', () => {
    Client.mockImplementationOnce(function (config) {
      this.activate = () => config.onConnect();
      this.deactivate = vi.fn();
      this.publish = vi.fn();
      this.subscribe = vi.fn(() => ({
        unsubscribe: () => {
          throw new Error('already gone');
        },
      }));
      this.active = true;
      mockClientInstance = this;
    });
    init('tok');

    expect(() => disconnect()).not.toThrow();
    expect(mockClientInstance.deactivate).toHaveBeenCalled();
  });

  it('should build a wss URL from an https API base', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    init('tok');

    expect(Client.mock.calls.at(-1)[0].brokerURL).toBe('wss://api.example.com/ws-board');
  });

  it('should build a ws URL from an http API base', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.local');
    init('tok');

    expect(Client.mock.calls.at(-1)[0].brokerURL).toBe('ws://api.local/ws-board');
  });

  it('should derive the WebSocket URL from the page when no API base is set', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    init('tok');

    const expectedProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    expect(Client.mock.calls.at(-1)[0].brokerURL).toBe(`${expectedProto}//${window.location.host}/api/ws-board`);
  });
});

describe('liveBoardService mock mode', () => {
  let mock;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.stubEnv('VITE_USE_MOCK_API', 'true');
    mock = await import('./liveBoardService.js');
  });

  afterEach(() => {
    mock.disconnect();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('should emit a seeded cursor and message shortly after init', async () => {
    const cursors = vi.fn();
    const messages = vi.fn();
    const unsubCursors = mock.subscribeCursors(cursors);
    const unsubMessages = mock.subscribeMessages(messages);

    mock.init('tok');
    await vi.advanceTimersByTimeAsync(1200);

    expect(cursors).toHaveBeenCalledWith(expect.objectContaining({ username: 'ghost_user' }));
    expect(messages).toHaveBeenCalledWith(expect.objectContaining({ id: 'mock-1', username: 'ghost_user' }));
    unsubCursors();
    unsubMessages();
  });

  it('should seed the mock board only once while active', async () => {
    const cursors = vi.fn();
    const unsub = mock.subscribeCursors(cursors);

    mock.init('tok');
    mock.init('tok');
    await vi.advanceTimersByTimeAsync(1200);

    expect(cursors).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('should echo the caller as the author of a mock message using the token subject', () => {
    const messages = vi.fn();
    const unsub = mock.subscribeMessages(messages);
    const payload = btoa(JSON.stringify({ sub: 'matt' }));

    mock.init(`h.${payload}.s`);
    mock.sendMessage(0.5, 0.6, 'hello');

    expect(messages).toHaveBeenLastCalledWith(
      expect.objectContaining({ username: 'matt', xRatio: 0.5, yRatio: 0.6, content: 'hello' })
    );
    unsub();
  });

  it('should fall back to "you" when the token is malformed or has no subject', () => {
    const messages = vi.fn();
    const unsub = mock.subscribeMessages(messages);

    mock.init('not-a-jwt');
    mock.sendMessage(0.1, 0.1, 'malformed');
    mock.disconnect();
    mock.init(`h.${btoa(JSON.stringify({}))}.s`);
    mock.sendMessage(0.1, 0.1, 'no-subject');

    expect(messages).toHaveBeenNthCalledWith(1, expect.objectContaining({ username: 'you', content: 'malformed' }));
    expect(messages).toHaveBeenNthCalledWith(2, expect.objectContaining({ username: 'you', content: 'no-subject' }));
    unsub();
  });

  it('should ignore cursor sends because mock mode renders no own cursor', () => {
    const cursors = vi.fn();
    const unsub = mock.subscribeCursors(cursors);

    mock.init('tok');
    mock.sendCursor(0.3, 0.3, true, 'red');

    expect(cursors).not.toHaveBeenCalled();
    unsub();
  });
});

