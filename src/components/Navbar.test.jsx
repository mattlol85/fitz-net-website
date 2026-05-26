import { render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import Navbar from './Navbar.jsx';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

global.localStorage = localStorageMock;

describe('Navbar Component', () => {
  const mockTheme = 'light';
  const mockToggleTheme = vi.fn();

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    document.documentElement.style.removeProperty('--navbar-height');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderNavbar = () => {
    return render(
      <AuthProvider>
        <BrowserRouter>
          <Navbar theme={mockTheme} toggleTheme={mockToggleTheme} />
        </BrowserRouter>
      </AuthProvider>
    );
  };

  test('renders navigation links', () => {
    const { container } = renderNavbar();

    const aboutLink = screen.getByText(/About/i);
    expect(aboutLink).toBeInTheDocument();
    expect(container.querySelector('.site-nav-list--guest')).toBeInTheDocument();
    expect(container.querySelector('.nav-spacer')).toBeInTheDocument();
  });

  test('renders logo image', () => {
    renderNavbar();

    const logo = screen.getByAltText(/Fitz-Net Logo/i);
    expect(logo).toBeInTheDocument();
  });

  test('logo links to home page', () => {
    renderNavbar();

    const logoLink = screen.getByRole('link', { name: /Fitz-Net Logo/i });
    expect(logoLink).toHaveAttribute('href', '/');
  });

  test('About link has correct href', () => {
    renderNavbar();

    const aboutLink = screen.getByRole('link', { name: /About/i });
    expect(aboutLink).toHaveAttribute('href', '/info');
  });

  test('renders theme toggle button', () => {
    renderNavbar();

    const themeToggle = screen.getByRole('button', { name: /Toggle theme/i });
    expect(themeToggle).toBeInTheDocument();
  });

  test('updates navbar height CSS variable from rendered height', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 96,
      width: 800,
      top: 0,
      right: 800,
      bottom: 96,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    renderNavbar();

    expect(document.documentElement.style.getPropertyValue('--navbar-height')).toBe('96px');
  });
});
