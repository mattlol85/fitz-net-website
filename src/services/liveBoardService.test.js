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
  subscribeCursors, subscribeMessages, FADE_DURATION_MS,
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

