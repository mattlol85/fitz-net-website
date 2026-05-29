import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import WebSocketButton from './WebSocketButton';
import { useAuth } from '../contexts/AuthContext';
import { vi } from 'vitest';

vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: vi.fn(),
}));

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static autoOpen = true;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.send = vi.fn();
    MockWebSocket.instances.push(this);

    if (MockWebSocket.autoOpen) {
      setTimeout(() => {
        if (this.readyState !== MockWebSocket.CLOSED) {
          this.readyState = MockWebSocket.OPEN;
          this.onopen?.();
        }
      }, 0);
    }
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  emitError(error = new Event('error')) {
    this.onerror?.(error);
  }
}

describe('WebSocketButton Component', () => {
  const defaultAuthState = {
    user: { username: 'testuser' },
    isAuthenticated: () => true,
  };

  const renderComponent = () => render(
    <BrowserRouter>
      <WebSocketButton />
    </BrowserRouter>
  );

  beforeAll(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  beforeEach(() => {
    MockWebSocket.autoOpen = true;
    MockWebSocket.instances = [];
    vi.mocked(useAuth).mockReturnValue(defaultAuthState);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  test('renders WebSocket button for authenticated user', async () => {
    renderComponent();

    expect(screen.getByText(/FitzNet Bell Web Edition/i)).toBeInTheDocument();
    expect(screen.getByText(/Press Me/i)).toBeInTheDocument();
  });

  test('shows connection status', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Connected/i)).toBeInTheDocument();
    });
  });

  test('displays device ID', () => {
    renderComponent();

    expect(screen.getByText(/Device ID:/i)).toBeInTheDocument();
    expect(screen.getByText(/web-testuser/i)).toBeInTheDocument();
  });

  test('uses the local websocket URL on localhost', () => {
    renderComponent();

    expect(MockWebSocket.instances[0]?.url).toBe('ws://localhost:8080/ws');
  });

  test('shows login gate when not authenticated', () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      user: null,
      isAuthenticated: () => false,
    });

    renderComponent();

    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
    expect(screen.queryByText(/FitzNet Bell Web Edition/i)).not.toBeInTheDocument();
  });

  test('shows error UI after retry attempts are exhausted and can retry manually', async () => {
    vi.useFakeTimers();
    MockWebSocket.autoOpen = false;

    renderComponent();

    act(() => {
      MockWebSocket.instances[0].emitError();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    act(() => {
      MockWebSocket.instances[1].emitError();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    act(() => {
      MockWebSocket.instances[2].emitError();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    act(() => {
      MockWebSocket.instances[3].emitError();
    });

    expect(screen.getByText(/Unable to connect to FitzNet Bell/i)).toBeInTheDocument();

    MockWebSocket.autoOpen = true;
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Retry Connection/i }));
    });

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
  });
});

