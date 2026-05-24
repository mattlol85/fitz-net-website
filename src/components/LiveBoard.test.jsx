import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import LiveBoard from './LiveBoard';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockInit = vi.fn();
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
  init: (...args) => mockInit(...args),
  disconnect: () => mockDisconnect(),
  sendCursor: (...args) => mockSendCursor(...args),
  sendMessage: (...args) => mockSendMessage(...args),
  subscribeCursors:      mockSubscribe('cursors'),
  subscribeMessages:     mockSubscribe('messages'),
  subscribeCursorRemove: mockSubscribe('cursorRemove'),
  subscribeCleared:      mockSubscribe('cleared'),
  subscribeBoardState:   mockSubscribe('boardState'),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'testuser' },
    token: 'test-token',
    isAuthenticated: () => true,
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
      _handlers['cursors']?.({ username: 'otheruser', xRatio: 0.2, yRatio: 0.3 });
    });
    expect(screen.getByText('otheruser')).toBeInTheDocument();
  });

  test('own username cursor is NOT rendered', () => {
    renderBoard();
    act(() => {
      _handlers['cursors']?.({ username: 'testuser', xRatio: 0.5, yRatio: 0.5 });
    });
    // 'testuser' should not appear as a cursor label
    expect(screen.queryByTestId('live-cursor')).not.toBeInTheDocument();
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
      _handlers['cursors']?.({ username: 'otherguy', xRatio: 0.3, yRatio: 0.3 });
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
});
