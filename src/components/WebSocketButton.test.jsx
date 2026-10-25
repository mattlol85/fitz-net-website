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

    expect(MockWebSocket.instances[0]?.url.split('?')[0]).toBe('ws://localhost:8080/ws');
    expect(MockWebSocket.instances[0]?.url).toContain('?correlationId=web-');
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

  test('should light the LED and show the device while the bell is pressed', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText(/Connected/i)).toBeInTheDocument());

    act(() => {
      MockWebSocket.instances[0].onmessage({
        data: JSON.stringify({ deviceId: 'esp-1', buttonEvent: 'PRESSED' }),
      });
    });

    expect(screen.getByText('Device esp-1 Pressed!')).toBeInTheDocument();
    expect(document.querySelector('.led')).toHaveClass('on');
    expect(document.querySelector('.ws-button')).toHaveClass('pressed');
  });

  test('should clear the LED and screen when the bell is released', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText(/Connected/i)).toBeInTheDocument());
    act(() => {
      MockWebSocket.instances[0].onmessage({
        data: JSON.stringify({ deviceId: 'esp-1', buttonEvent: 'PRESSED' }),
      });
    });

    act(() => {
      MockWebSocket.instances[0].onmessage({
        data: JSON.stringify({ deviceId: 'esp-1', buttonEvent: 'RELEASED' }),
      });
    });

    expect(screen.getByText(/Waiting for button press/i)).toBeInTheDocument();
    expect(document.querySelector('.led')).toHaveClass('off');
  });

  test('should ignore frames that are not button events', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText(/Connected/i)).toBeInTheDocument());

    act(() => {
      MockWebSocket.instances[0].onmessage({ data: JSON.stringify({ deviceId: 'esp-1', buttonEvent: 'OTHER' }) });
      MockWebSocket.instances[0].onmessage({ data: JSON.stringify({ hello: 'world' }) });
    });

    expect(screen.getByText(/Waiting for button press/i)).toBeInTheDocument();
  });

  test('should survive a frame that is not valid JSON', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderComponent();
    await waitFor(() => expect(screen.getByText(/Connected/i)).toBeInTheDocument());

    act(() => {
      MockWebSocket.instances[0].onmessage({ data: '{not json' });
    });

    expect(consoleError).toHaveBeenCalledWith('Error parsing WebSocket message:', expect.any(Error));
    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
    consoleError.mockRestore();
  });

  test('should send press and release events over an open socket', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText(/Connected/i)).toBeInTheDocument());
    const button = screen.getByRole('button', { name: /Press Me/i });

    fireEvent.mouseDown(button);
    fireEvent.mouseUp(button);
    fireEvent.touchStart(button);
    fireEvent.touchEnd(button);

    const sent = MockWebSocket.instances[0].send.mock.calls.map(([payload]) => JSON.parse(payload));
    expect(sent).toEqual([
      { deviceId: 'web-testuser', buttonEvent: 'PRESSED' },
      { deviceId: 'web-testuser', buttonEvent: 'RELEASED' },
      { deviceId: 'web-testuser', buttonEvent: 'PRESSED' },
      { deviceId: 'web-testuser', buttonEvent: 'RELEASED' },
    ]);
  });

  test('should send release when the pointer leaves the button', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText(/Connected/i)).toBeInTheDocument());
    const button = screen.getByRole('button', { name: /Press Me/i });

    fireEvent.mouseLeave(button);

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({ deviceId: 'web-testuser', buttonEvent: 'RELEASED' })
    );
  });

  test('should not send anything while the socket is not open', async () => {
    MockWebSocket.autoOpen = false;
    renderComponent();
    const button = screen.getByRole('button', { name: /Press Me/i });

    fireEvent.mouseDown(button);

    expect(MockWebSocket.instances[0].send).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  test('should keep the button disabled until the connection opens', () => {
    MockWebSocket.autoOpen = false;
    renderComponent();

    expect(screen.getByRole('button', { name: /Press Me/i })).toBeDisabled();
    expect(screen.getByText(/Connecting to FitzNet websocket/i)).toBeInTheDocument();
  });

  test('should use the public gamerbell host for non-local sites', () => {
    const originalLocation = window.location;
    delete window.location;
    window.location = { hostname: 'www.fitznet.org', protocol: 'https:', host: 'www.fitznet.org' };
    try {
      renderComponent();

      expect(MockWebSocket.instances[0].url.split('?')[0]).toBe('wss://gamerbell.fitznet.org/ws');
    } finally {
      window.location = originalLocation;
    }
  });

  test('should use plain ws for a non-local http site', () => {
    const originalLocation = window.location;
    delete window.location;
    window.location = { hostname: 'fitznet.org', protocol: 'http:', host: 'fitznet.org' };
    try {
      renderComponent();

      expect(MockWebSocket.instances[0].url.split('?')[0]).toBe('ws://gamerbell.fitznet.org/ws');
    } finally {
      window.location = originalLocation;
    }
  });

  test('should use the loopback bell URL for 127.x addresses', () => {
    const originalLocation = window.location;
    delete window.location;
    window.location = { hostname: '127.0.0.5', protocol: 'http:', host: '127.0.0.5' };
    try {
      renderComponent();

      expect(MockWebSocket.instances[0].url.split('?')[0]).toBe('ws://localhost:8080/ws');
    } finally {
      window.location = originalLocation;
    }
  });

  test('should use an anonymous device id when the user has no username', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, isAuthenticated: () => true });
    renderComponent();

    expect(await screen.findByText('web-anonymous')).toBeInTheDocument();
  });

  test('should retry a dropped connection after a delay and recover', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText(/Connected/i)).toBeInTheDocument());

    vi.useFakeTimers();
    act(() => {
      MockWebSocket.instances[0].onclose();
    });
    expect(screen.getByText(/Connecting to FitzNet websocket/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(MockWebSocket.instances).toHaveLength(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
  });

  test('should clear the pressed state when a dropped connection is retried', async () => {
    vi.useFakeTimers();
    renderComponent();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    act(() => {
      MockWebSocket.instances[0].onmessage({
        data: JSON.stringify({ deviceId: 'esp-1', buttonEvent: 'PRESSED' }),
      });
    });

    act(() => {
      MockWebSocket.instances[0].onerror(new Event('error'));
    });

    expect(screen.queryByText('Device esp-1 Pressed!')).not.toBeInTheDocument();
    expect(document.querySelector('.led')).toHaveClass('off');
  });

  test('should report a single failure once even if both error and close fire', async () => {
    vi.useFakeTimers();
    MockWebSocket.autoOpen = false;
    renderComponent();

    act(() => {
      MockWebSocket.instances[0].onerror(new Event('error'));
      MockWebSocket.instances[0].onclose();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(MockWebSocket.instances).toHaveLength(2);
  });

  test('should stop reconnecting once the component unmounts', async () => {
    vi.useFakeTimers();
    MockWebSocket.autoOpen = false;
    const { unmount } = renderComponent();
    act(() => {
      MockWebSocket.instances[0].onerror(new Event('error'));
    });

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  test('should not open a socket when the user signs out', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, isAuthenticated: () => false });
    renderComponent();

    expect(MockWebSocket.instances).toHaveLength(0);
  });

  test('should close an open socket when the component unmounts', async () => {
    const { unmount } = renderComponent();
    await waitFor(() => expect(screen.getByText(/Connected/i)).toBeInTheDocument());
    const socket = MockWebSocket.instances[0];

    unmount();

    expect(socket.readyState).toBe(MockWebSocket.CLOSED);
  });
});

