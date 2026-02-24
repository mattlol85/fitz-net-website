import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import WebSocketButton from './WebSocketButton';
import { vi } from 'vitest';

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 0);
  }

  send(data) {
    // Mock send
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }
}

global.WebSocket = MockWebSocket;

// Mock useAuth hook
vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: () => ({
    user: { username: 'testuser' },
    isAuthenticated: () => true,
  }),
}));

describe('WebSocketButton Component', () => {
  test('renders WebSocket button for authenticated user', async () => {
    render(
      <BrowserRouter>
        <WebSocketButton />
      </BrowserRouter>
    );

    expect(screen.getByText(/FitzNet Bell Web Edition/i)).toBeInTheDocument();
    expect(screen.getByText(/Press Me/i)).toBeInTheDocument();
  });

  test('shows connection status', async () => {
    render(
      <BrowserRouter>
        <WebSocketButton />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Connected/i)).toBeInTheDocument();
    });
  });

  test('displays device ID', () => {
    render(
      <BrowserRouter>
        <WebSocketButton />
      </BrowserRouter>
    );

    expect(screen.getByText(/Device ID:/i)).toBeInTheDocument();
    expect(screen.getByText(/web-testuser/i)).toBeInTheDocument();
  });
});

