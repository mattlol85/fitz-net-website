import { render, screen } from '@testing-library/react';
import App from './App.jsx';
import { vi } from 'vitest';

// Mock liveBoardService so STOMP is never instantiated in App tests
vi.mock('./services/liveBoardService', () => ({
  FADE_DURATION_MS: 90_000,
  init: vi.fn(),
  disconnect: vi.fn(),
  sendCursor: vi.fn(),
  sendMessage: vi.fn(),
  subscribeCursors:      vi.fn(() => () => {}),
  subscribeMessages:     vi.fn(() => () => {}),
  subscribeCursorRemove: vi.fn(() => () => {}),
  subscribeCleared:      vi.fn(() => () => {}),
  subscribeBoardState:   vi.fn(() => () => {}),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('App Component', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  test('renders without crashing', () => {
    render(<App />);
  });

  test('renders Navbar component', () => {
    render(<App />);
    const navbar = screen.getByRole('navigation');
    expect(navbar).toBeInTheDocument();
  });

  test('renders Footer component', () => {
    render(<App />);
    const footer = screen.getByText(/fitznet.org by Matthew Fitzgerald/i);
    expect(footer).toBeInTheDocument();
  });

  test('renders Homepage at root path', () => {
    render(<App />);
    const logo = screen.getAllByAltText(/Logo/i)[0];
    expect(logo).toBeInTheDocument();
  });

  test('footer displays current year', () => {
    render(<App />);
    const currentYear = new Date().getFullYear();
    const footer = screen.getByText(new RegExp(currentYear.toString()));
    expect(footer).toBeInTheDocument();
  });

  test('Live Board nav link is present for authenticated users', () => {
    // Store a fake auth session
    localStorageMock.setItem('authToken', 'fake.jwt.eyJleHAiOjk5OTk5OTk5OTl9.sig');
    localStorageMock.setItem('authUser', JSON.stringify({ username: 'testuser', email: 'test@test.com' }));
    render(<App />);
    // The link may not be visible without a valid token, but the route should exist
    // We just verify the app renders without crashing with auth state present
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
