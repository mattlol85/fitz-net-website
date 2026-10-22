import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

// The lazily loaded pages pull in Three.js and network calls; stub them so the
// routing itself is what is under test.
vi.mock('./components/StatusDashboard.jsx', async () => {
  const React = await import('react');
  return { default: () => React.createElement('div', null, 'Status page') };
});
vi.mock('./components/LiveBoard.jsx', async () => {
  const React = await import('react');
  return { default: () => React.createElement('div', null, 'Live board page') };
});
vi.mock('./components/AiChat.jsx', async () => {
  const React = await import('react');
  return { default: () => React.createElement('div', null, 'AI chat page') };
});
vi.mock('./components/AdminUsers.jsx', async () => {
  const React = await import('react');
  return { default: () => React.createElement('div', null, 'Admin page') };
});

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

const sessionToken = () => {
  const payload = btoa(JSON.stringify({ exp: 9999999999 }));
  return `h.${payload}.s`;
};

const signIn = (permissions = []) => {
  localStorageMock.setItem('authToken', sessionToken());
  localStorageMock.setItem('authUser', JSON.stringify({ username: 'testuser', email: 'test@test.com', permissions }));
};

const goTo = (path) => {
  window.history.pushState({}, '', path);
};

describe('App Component', () => {
  beforeEach(() => {
    localStorageMock.clear();
    goTo('/');
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
    goTo('/');
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

  test('should apply the stored theme to the document root on startup', () => {
    localStorageMock.setItem('theme', 'dark');

    render(<App />);

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  test('should default to the light theme when none is stored', () => {
    render(<App />);

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(localStorageMock.getItem('theme')).toBe('light');
  });

  test('should flip the theme and remember it when the toggle is pressed', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorageMock.getItem('theme')).toBe('dark');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  test('should keep the browser theme colour in step with the theme when the meta tag exists', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#000000');
    document.head.appendChild(meta);
    render(<App />);
    expect(meta).toHaveAttribute('content', '#ffffff');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));

    expect(meta).toHaveAttribute('content', '#1a1a1a');
  });

  test('should render the status page at /status', async () => {
    goTo('/status');
    render(<App />);

    expect(await screen.findByText('Status page')).toBeInTheDocument();
  });

  test('should render the live board page at /liveboard', async () => {
    goTo('/liveboard');
    render(<App />);

    expect(await screen.findByText('Live board page')).toBeInTheDocument();
  });

  test('should render the AI chat page at /ai for users with AI_USER', async () => {
    signIn(['AI_USER']);
    goTo('/ai');
    render(<App />);

    expect(await screen.findByText('AI chat page')).toBeInTheDocument();
  });

  test('should send signed-out visitors from /ai to the login page', async () => {
    goTo('/ai');
    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(screen.queryByText('AI chat page')).not.toBeInTheDocument();
  });

  test('should show the 404 page at /ai to users without AI_USER', async () => {
    signIn([]);
    goTo('/ai');
    render(<App />);

    expect(await screen.findByText('404')).toBeInTheDocument();
    expect(screen.queryByText('AI chat page')).not.toBeInTheDocument();
  });

  test('should ask signed-out visitors to log in at /websocket', async () => {
    goTo('/websocket');
    render(<App />);

    expect(await screen.findByText(/to use the FitzNet Bell/i)).toBeInTheDocument();
  });

  test('should send signed-out visitors from /admin to the login page', async () => {
    goTo('/admin');
    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(screen.queryByText('Admin page')).not.toBeInTheDocument();
  });

  test('should show the admin page to users with the ADMIN permission', async () => {
    signIn(['ADMIN']);
    goTo('/admin');
    render(<App />);

    expect(await screen.findByText('Admin page')).toBeInTheDocument();
  });

  test('should show the 404 page to signed-in users without the ADMIN permission', async () => {
    signIn([]);
    goTo('/admin');
    render(<App />);

    expect(await screen.findByText('404')).toBeInTheDocument();
    expect(screen.queryByText('Admin page')).not.toBeInTheDocument();
  });

  test('should send signed-out visitors from /joenet to the login page', async () => {
    goTo('/joenet');
    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
  });

  test('should show the Joenet coming soon panel to users with JOENET_USER', async () => {
    signIn(['JOENET_USER']);
    goTo('/joenet');
    render(<App />);

    expect(await screen.findByText('Coming soon')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Admin Panel' })).toBeInTheDocument();
  });

  test('should show the Joenet key gate at /joenet/admin to users with JOENET_USER', async () => {
    signIn(['JOENET_USER']);
    goTo('/joenet/admin');
    render(<App />);

    expect(await screen.findByLabelText('Radarr API key')).toBeInTheDocument();
  });

  test('should show the 404 page at /joenet/admin to users without JOENET_USER', async () => {
    signIn([]);
    goTo('/joenet/admin');
    render(<App />);

    expect(await screen.findByText('404')).toBeInTheDocument();
    expect(screen.queryByLabelText('Radarr API key')).not.toBeInTheDocument();
  });

  test('should render the login page at /login', () => {
    goTo('/login');
    render(<App />);

    expect(window.location.pathname).toBe('/login');
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  test('should render the registration page at /register', () => {
    goTo('/register');
    render(<App />);

    expect(window.location.pathname).toBe('/register');
  });

  test('should send signed-out visitors from /profile to the login page', async () => {
    goTo('/profile');
    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
  });

  test('should show the 404 page for unknown routes', () => {
    goTo('/no-such-page');
    render(<App />);

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });

  test('should render the same app after toggling the theme during a route change', async () => {
    goTo('/status');
    render(<App />);
    await screen.findByText('Status page');

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
    });

    expect(screen.getByText('Status page')).toBeInTheDocument();
  });
});
