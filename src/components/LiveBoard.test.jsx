import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, beforeAll } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import LiveBoard from './LiveBoard';

// ── Global stubs needed by LiveBoard ─────────────────────────────────────────

beforeAll(() => {
  // jsdom's HTMLCanvasElement.width/height getters trigger custom-element
  // reactions that cause a stack-overflow. Override them with simple storage.
  // NOTE: this override is global across all test files in the suite.
  Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
    get() { return this._w || 0; },
    set(v) { this._w = v; },
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
    get() { return this._h || 0; },
    set(v) { this._h = v; },
    configurable: true,
  });

  // jsdom does not implement canvas context
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc:       vi.fn(),
    fill:      vi.fn(),
    get globalAlpha() { return 1; },
    set globalAlpha(_) {},
    get fillStyle() { return ''; },
    set fillStyle(_) {},
  }));

  // jsdom does not implement ResizeObserver
  global.ResizeObserver = vi.fn(function ResizeObserver() {
    return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
  });

  // Depth-limited RAF: executes the callback only at the top level (depth 0).
  // This allows single-shot work (e.g. sendCursor throttle) while preventing
  // the recursive draw loop from causing a stack overflow.
  let rafDepth = 0;
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
    if (rafDepth === 0) {
      rafDepth++;
      try { cb(); } catch (_) {}
      rafDepth--;
    }
    return 0;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockInit       = vi.fn();
const mockDisconnect = vi.fn();
const mockSendCursor = vi.fn();
const mockSendMessage = vi.fn();

const _handlers = {};
function mockSubscribe(event) {
  return (cb) => {
    _handlers[event] = cb;
    return () => { delete _handlers[event]; };
  };
}

vi.mock('../services/liveBoardService', () => ({
  FADE_DURATION_MS: 90_000,
  init:        (...args) => mockInit(...args),
  disconnect:  () => mockDisconnect(),
  sendCursor:  (...args) => mockSendCursor(...args),
  sendMessage: (...args) => mockSendMessage(...args),
  subscribeCursors:      mockSubscribe('cursors'),
  subscribeMessages:     mockSubscribe('messages'),
  subscribeCursorRemove: mockSubscribe('cursorRemove'),
  subscribeCleared:      mockSubscribe('cleared'),
  subscribeBoardState:   mockSubscribe('boardState'),
}));

const authState = vi.hoisted(() => ({
  user: { username: 'testuser', boardColor: 'hsl(340,72%,50%)' },
  token: 'test-token',
  authed: true,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
    token: authState.token,
    isAuthenticated: () => authState.authed,
  }),
}));

function renderBoard() {
  return render(
    <BrowserRouter>
      <LiveBoard />
    </BrowserRouter>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LiveBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(_handlers).forEach(k => delete _handlers[k]);
    authState.user = { username: 'testuser', boardColor: 'hsl(340,72%,50%)' };
    authState.token = 'test-token';
    authState.authed = true;
  });

  test('renders the canvas container', () => {
    renderBoard();
    expect(screen.getByTestId('liveboard-canvas')).toBeInTheDocument();
  });

  test('calls init with the auth token on mount', () => {
    renderBoard();
    expect(mockInit).toHaveBeenCalledWith('test-token');
  });

  test('calls disconnect on unmount', () => {
    const { unmount } = renderBoard();
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  test('shows hint text', () => {
    renderBoard();
    expect(screen.getByText(/Right-click to leave a message/i)).toBeInTheDocument();
    expect(screen.getByText(/Click for a ripple/i)).toBeInTheDocument();
    expect(screen.getByText(/Hold to paint/i)).toBeInTheDocument();
  });

  test('right-click opens compose textarea at that position', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
    fireEvent.contextMenu(canvas, { clientX: 300, clientY: 150 });
    expect(screen.getByTestId('liveboard-compose')).toBeInTheDocument();
  });

  test('Escape key dismisses compose without sending', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
    fireEvent.contextMenu(canvas, { clientX: 300, clientY: 150 });

    const textarea = screen.getByTestId('liveboard-compose');
    fireEvent.keyDown(textarea, { key: 'Escape' });

    expect(screen.queryByTestId('liveboard-compose')).not.toBeInTheDocument();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test('Enter key submits message and removes compose', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
    fireEvent.contextMenu(canvas, { clientX: 500, clientY: 300 });

    const textarea = screen.getByTestId('liveboard-compose');
    fireEvent.change(textarea, { target: { value: 'hello board' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(mockSendMessage).toHaveBeenCalledWith(0.5, 0.5, 'hello board');
    expect(screen.queryByTestId('liveboard-compose')).not.toBeInTheDocument();
  });

  test('Shift+Enter does NOT submit and keeps compose open', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
    fireEvent.contextMenu(canvas, { clientX: 100, clientY: 100 });

    const textarea = screen.getByTestId('liveboard-compose');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(screen.getByTestId('liveboard-compose')).toBeInTheDocument();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test('left-click creates a ripple element', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
    fireEvent.click(canvas, { clientX: 200, clientY: 200 });
    expect(screen.getByTestId('board-ripple')).toBeInTheDocument();
  });

  test('incoming cursor event renders LiveCursor (not own username)', () => {
    renderBoard();
    act(() => {
      _handlers['cursors']?.({ username: 'otheruser', xRatio: 0.2, yRatio: 0.3, color: 'hsl(120,72%,50%)', painting: false });
    });
    expect(screen.getByText('otheruser')).toBeInTheDocument();
  });

  test('incoming cursor passes color to LiveCursor', () => {
    renderBoard();
    act(() => {
      _handlers['cursors']?.({ username: 'coloreduser', xRatio: 0.5, yRatio: 0.5, color: 'hsl(200,72%,50%)', painting: false });
    });
    // The label background must reflect the user's board color.
    // jsdom normalizes hsl() → rgb() when assigned to element.style.
    const label = screen.getByTestId('live-cursor-label');
    expect(label).toBeInTheDocument();
    expect(label.style.background).toBe('rgb(36, 158, 219)'); // hsl(200,72%,50%)
  });

  test('own username cursor is NOT rendered', () => {
    renderBoard();
    act(() => {
      _handlers['cursors']?.({ username: 'testuser', xRatio: 0.5, yRatio: 0.5, color: 'hsl(340,72%,50%)', painting: false });
    });
    expect(screen.queryByTestId('live-cursor')).not.toBeInTheDocument();
  });

  test('incoming painting=true cursor creates a paint dot', () => {
    renderBoard();
    act(() => {
      _handlers['cursors']?.({ username: 'painter', xRatio: 0.4, yRatio: 0.4, color: 'hsl(60,72%,50%)', painting: true });
    });
    expect(screen.getByTestId('paint-dot')).toBeInTheDocument();
  });

  test('incoming painting=false cursor does NOT create a paint dot', () => {
    renderBoard();
    act(() => {
      _handlers['cursors']?.({ username: 'mover', xRatio: 0.4, yRatio: 0.4, color: 'hsl(60,72%,50%)', painting: false });
    });
    expect(screen.queryByTestId('paint-dot')).not.toBeInTheDocument();
  });

  test('paint dot has color applied via background style', () => {
    renderBoard();
    act(() => {
      _handlers['cursors']?.({ username: 'dotpainter', xRatio: 0.3, yRatio: 0.6, color: 'hsl(300,72%,50%)', painting: true });
    });
    const dot = screen.getByTestId('paint-dot');
    expect(dot.style.background).toBeTruthy();
    // NOTE: onAnimationEnd-based cleanup (removePaintDot) is not tested here
    // because jsdom does not run CSS animations.
  });

  test('sendCursor is called with painting=false when mouse is just moving', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
    fireEvent.mouseMove(canvas, { clientX: 300, clientY: 200 });
    // painting=false when mouse is up (default)
    expect(mockSendCursor).toHaveBeenCalledWith(0.3, expect.any(Number), false, 'hsl(340,72%,50%)');
  });

  test('sendCursor is called with painting=true when mouse is held down', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
    fireEvent.mouseDown(canvas);
    fireEvent.mouseMove(canvas, { clientX: 400, clientY: 300 });
    expect(mockSendCursor).toHaveBeenCalledWith(0.4, 0.5, true, 'hsl(340,72%,50%)');
  });

  test('sendCursor includes user boardColor', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
    const calls = mockSendCursor.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    // 4th argument is the color
    expect(calls[calls.length - 1][3]).toBe('hsl(340,72%,50%)');
  });

  test('sparkle appears when cursors are in close proximity', () => {
    renderBoard();
    // Place another cursor at a known position
    act(() => {
      _handlers['cursors']?.({ username: 'nearby', xRatio: 0.5, yRatio: 0.5, color: 'hsl(120,72%,50%)', painting: false });
    });
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
    // Move own cursor very close to 'nearby' cursor
    fireEvent.mouseMove(canvas, { clientX: 501, clientY: 301 }); // xRatio≈0.501, yRatio≈0.502
    expect(screen.getByTestId('board-sparkle')).toBeInTheDocument();
  });

  test('incoming message event renders a BoardMessage', () => {
    renderBoard();
    act(() => {
      _handlers['messages']?.({
        id: 'msg-1',
        username: 'alice',
        xRatio: 0.4,
        yRatio: 0.4,
        content: 'hi there',
        postedAt: new Date().toISOString(),
      });
    });
    expect(screen.getByTestId('board-message')).toBeInTheDocument();
    expect(screen.getByText('hi there')).toBeInTheDocument();
  });

  test('board-cleared event removes all messages', () => {
    renderBoard();
    act(() => {
      _handlers['messages']?.({
        id: 'msg-1', username: 'alice', xRatio: 0.4, yRatio: 0.4,
        content: 'will be cleared', postedAt: new Date().toISOString(),
      });
    });
    expect(screen.getByTestId('board-message')).toBeInTheDocument();

    act(() => { _handlers['cleared']?.(); });
    expect(screen.queryByTestId('board-message')).not.toBeInTheDocument();
  });

  test('cursor-remove event removes that cursor', () => {
    renderBoard();
    act(() => {
      _handlers['cursors']?.({ username: 'otherguy', xRatio: 0.3, yRatio: 0.3, color: 'hsl(60,72%,50%)', painting: false });
    });
    expect(screen.getByText('otherguy')).toBeInTheDocument();

    act(() => { _handlers['cursorRemove']?.({ username: 'otherguy' }); });
    expect(screen.queryByText('otherguy')).not.toBeInTheDocument();
  });

  test('boardState event pre-populates messages from server', () => {
    renderBoard();
    act(() => {
      _handlers['boardState']?.({
        messages: [{
          id: 'existing-1', username: 'bob', xRatio: 0.6, yRatio: 0.6,
          content: 'pre-existing', postedAt: new Date().toISOString(),
        }],
      });
    });
    expect(screen.getByText('pre-existing')).toBeInTheDocument();
  });

  test('trail canvas element is rendered', () => {
    renderBoard();
    expect(screen.getByTestId('trail-canvas')).toBeInTheDocument();
  });

  test('should ask visitors to log in and not connect when signed out', () => {
    authState.authed = false;
    renderBoard();

    expect(screen.getByRole('link', { name: 'log in' })).toHaveAttribute('href', '/login');
    expect(screen.queryByTestId('liveboard-canvas')).not.toBeInTheDocument();
    expect(mockInit).not.toHaveBeenCalled();
  });

  test('should fall back to the default board colour when the user has none', () => {
    authState.user = { username: 'anon' };
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });

    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });

    expect(mockSendCursor).toHaveBeenLastCalledWith(0.1, expect.closeTo(1 / 6, 3), false, 'hsl(200,72%,50%)');
  });

  test('should send a cursor with painting off after the mouse button is released', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });

    fireEvent.mouseDown(canvas);
    fireEvent.mouseUp(canvas);
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });

    expect(mockSendCursor).toHaveBeenLastCalledWith(0.1, expect.closeTo(1 / 6, 3), false, 'hsl(340,72%,50%)');
  });

  test('should stop painting when the button is released outside the board', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });

    fireEvent.mouseDown(canvas);
    fireEvent(window, new MouseEvent('mouseup'));
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });

    expect(mockSendCursor).toHaveBeenLastCalledWith(0.1, expect.closeTo(1 / 6, 3), false, 'hsl(340,72%,50%)');
  });

  test('should clamp cursor positions to the board edges', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });

    fireEvent.mouseMove(canvas, { clientX: -50, clientY: 9999 });

    expect(mockSendCursor).toHaveBeenLastCalledWith(0, 1, false, 'hsl(340,72%,50%)');
  });

  test('should throttle paint dots from one user to a few per second', () => {
    renderBoard();
    act(() => {
      _handlers['cursors']?.({ username: 'painter', xRatio: 0.2, yRatio: 0.2, color: 'hsl(10,72%,50%)', painting: true });
      _handlers['cursors']?.({ username: 'painter', xRatio: 0.21, yRatio: 0.21, color: 'hsl(10,72%,50%)', painting: true });
    });

    expect(screen.getAllByTestId('paint-dot')).toHaveLength(1);
  });

  test('should remove a paint dot once its animation ends', () => {
    renderBoard();
    act(() => {
      _handlers['cursors']?.({ username: 'painter', xRatio: 0.2, yRatio: 0.2, color: 'hsl(10,72%,50%)', painting: true });
    });
    fireEvent.animationEnd(screen.getByTestId('paint-dot'));

    expect(screen.queryByTestId('paint-dot')).not.toBeInTheDocument();
  });

  test('should remove a ripple and a sparkle once their animations end', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
    act(() => {
      _handlers['cursors']?.({ username: 'nearby', xRatio: 0.5, yRatio: 0.5, color: 'hsl(120,72%,50%)', painting: false });
    });
    fireEvent.click(canvas, { clientX: 200, clientY: 200 });
    fireEvent.mouseMove(canvas, { clientX: 501, clientY: 301 });

    fireEvent.animationEnd(screen.getByTestId('board-ripple'));
    fireEvent.animationEnd(screen.getByTestId('board-sparkle'));

    expect(screen.queryByTestId('board-ripple')).not.toBeInTheDocument();
    expect(screen.queryByTestId('board-sparkle')).not.toBeInTheDocument();
  });

  test('should allow a fresh sparkle after the nearby user leaves and returns', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
    act(() => {
      _handlers['cursors']?.({ username: 'nearby', xRatio: 0.5, yRatio: 0.5, color: 'hsl(120,72%,50%)', painting: false });
    });
    fireEvent.mouseMove(canvas, { clientX: 501, clientY: 301 });
    fireEvent.animationEnd(screen.getByTestId('board-sparkle'));

    act(() => { _handlers['cursorRemove']?.({ username: 'nearby' }); });
    act(() => {
      _handlers['cursors']?.({ username: 'nearby', xRatio: 0.5, yRatio: 0.5, color: 'hsl(120,72%,50%)', painting: false });
    });
    fireEvent.mouseMove(canvas, { clientX: 501, clientY: 301 });

    expect(screen.getByTestId('board-sparkle')).toBeInTheDocument();
  });

  test('should not spark with anonymous users who have no username', () => {
    authState.user = null;
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
    act(() => {
      _handlers['cursors']?.({ username: 'nearby', xRatio: 0.5, yRatio: 0.5, painting: false });
    });
    fireEvent.mouseMove(canvas, { clientX: 501, clientY: 301 });

    expect(screen.queryByTestId('board-sparkle')).not.toBeInTheDocument();
  });

  test('should ignore a right-click that lands inside the open compose box', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
    fireEvent.contextMenu(canvas, { clientX: 300, clientY: 150 });
    const textarea = screen.getByTestId('liveboard-compose');

    fireEvent.contextMenu(textarea, { clientX: 500, clientY: 400 });

    expect(screen.getByTestId('liveboard-compose-wrap')).toHaveStyle({ left: '300px', top: '150px' });
  });

  test('should ignore a left-click that lands inside the open compose box', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
    fireEvent.contextMenu(canvas, { clientX: 300, clientY: 150 });

    fireEvent.click(screen.getByTestId('liveboard-compose'), { clientX: 310, clientY: 160 });

    expect(screen.queryByTestId('board-ripple')).not.toBeInTheDocument();
  });

  test('should close compose without sending when the message is blank', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
    fireEvent.contextMenu(canvas, { clientX: 300, clientY: 150 });
    const textarea = screen.getByTestId('liveboard-compose');
    fireEvent.change(textarea, { target: { value: '   ' } });

    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(screen.queryByTestId('liveboard-compose')).not.toBeInTheDocument();
  });

  test('should close compose when focus leaves the textarea', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
    fireEvent.contextMenu(canvas, { clientX: 300, clientY: 150 });

    fireEvent.blur(screen.getByTestId('liveboard-compose'));

    expect(screen.queryByTestId('liveboard-compose')).not.toBeInTheDocument();
  });

  test('should clear the whole board when the cleared event arrives', () => {
    renderBoard();
    act(() => {
      _handlers['cursors']?.({ username: 'otherguy', xRatio: 0.3, yRatio: 0.3, color: 'hsl(60,72%,50%)', painting: false });
    });
    act(() => { _handlers['cleared']?.(); });

    expect(screen.queryByText('otherguy')).not.toBeInTheDocument();
  });

  test('should ignore a board state payload that has no message list', () => {
    renderBoard();
    act(() => { _handlers['boardState']?.({}); });

    expect(screen.queryByTestId('board-message')).not.toBeInTheDocument();
  });

  test('should resize the trail canvas to match its container', () => {
    renderBoard();
    const observerCallback = global.ResizeObserver.mock.calls.at(-1)[0];
    const trail = screen.getByTestId('trail-canvas');
    Object.defineProperty(trail.parentElement, 'clientWidth', { configurable: true, value: 640 });
    Object.defineProperty(trail.parentElement, 'clientHeight', { configurable: true, value: 480 });

    act(() => observerCallback());

    expect(trail.width).toBe(640);
    expect(trail.height).toBe(480);
  });

  test('should draw fresh trail points and prune stale ones on each frame', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const originalRaf = globalThis.requestAnimationFrame;
    const queued = [];
    globalThis.requestAnimationFrame = vi.fn((cb) => {
      queued.push(cb);
      return queued.length;
    });
    const flush = () => queued.splice(0).forEach((cb) => cb());

    try {
      renderBoard();
      const canvas = screen.getByTestId('liveboard-canvas');
      canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
      fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });

      vi.setSystemTime(new Date('2025-01-01T00:00:00.500Z'));
      flush();
      const ctx = HTMLCanvasElement.prototype.getContext.mock.results.at(-1).value;
      expect(ctx.arc).toHaveBeenCalled();

      vi.setSystemTime(new Date('2025-01-01T00:00:03.000Z'));
      flush();
      expect(ctx.clearRect).toHaveBeenCalled();
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      vi.useRealTimers();
    }
  });
});

describe('LiveBoard message lifetime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('should remove a message once its fade-out lifetime has run out', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    renderBoard();

    act(() => {
      _handlers['messages']?.({
        id: 'm-life', username: 'alice', xRatio: 0.4, yRatio: 0.4,
        content: 'fleeting', postedAt: new Date().toISOString(),
      });
    });
    expect(screen.getByTestId('board-message')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(90_001);
    });
    expect(screen.queryByTestId('board-message')).not.toBeInTheDocument();
  });

  test('should drop a message that had already expired when it arrives', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    renderBoard();

    act(() => {
      _handlers['messages']?.({
        id: 'm-stale', username: 'bob', xRatio: 0.4, yRatio: 0.4,
        content: 'stale words', postedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      });
    });

    expect(screen.queryByText('stale words')).not.toBeInTheDocument();
  });
});

describe('LiveBoard throttling and sparkle bookkeeping', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('should send at most one cursor update per animation frame', () => {
    const queued = [];
    const originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = vi.fn((cb) => {
      queued.push(cb);
      return queued.length;
    });
    try {
      renderBoard();
      const canvas = screen.getByTestId('liveboard-canvas');
      canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
      mockSendCursor.mockClear();

      fireEvent.mouseMove(canvas, { clientX: 10, clientY: 10 });
      fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
      queued.splice(0).forEach((cb) => cb());

      expect(mockSendCursor).toHaveBeenCalledTimes(1);
      expect(mockSendCursor).toHaveBeenCalledWith(0.02, expect.closeTo(1 / 30, 3), false, 'hsl(340,72%,50%)');
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
    }
  });

  test('should keep working through a long burst of movement', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });

    for (let i = 0; i < 90; i += 1) {
      fireEvent.mouseMove(canvas, { clientX: i, clientY: 5 });
    }

    expect(mockSendCursor).toHaveBeenCalled();
  });

  test('should keep the sparkle debounce for other users when one of them leaves', () => {
    renderBoard();
    const canvas = screen.getByTestId('liveboard-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
    act(() => {
      _handlers['cursors']?.({ username: 'alpha', xRatio: 0.5, yRatio: 0.5, color: 'hsl(1,1%,1%)', painting: false });
      _handlers['cursors']?.({ username: 'beta', xRatio: 0.9, yRatio: 0.9, color: 'hsl(2,2%,2%)', painting: false });
    });
    fireEvent.mouseMove(canvas, { clientX: 501, clientY: 301 });
    fireEvent.mouseMove(canvas, { clientX: 901, clientY: 541 });
    expect(screen.getAllByTestId('board-sparkle')).toHaveLength(2);

    act(() => {
      _handlers['cursorRemove']?.({ username: 'alpha' });
    });
    fireEvent.mouseMove(canvas, { clientX: 902, clientY: 542 });

    expect(screen.getAllByTestId('board-sparkle')).toHaveLength(2);
  });
});
