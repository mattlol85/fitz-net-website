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

    const statusLink = screen.getByText(/Status/i);
    expect(statusLink).toBeInTheDocument();
    expect(container.querySelector('.site-nav-list--guest')).toBeInTheDocument();
    expect(container.querySelector('.nav-spacer')).toBeInTheDocument();
  });

  test('keeps the auth controls in a single group after the spacer', () => {
    const { container } = renderNavbar();

    const items = [...container.querySelectorAll('.site-nav-list > li')];
    const spacerIndex = items.findIndex((li) => li.classList.contains('nav-spacer'));
    const authIndex = items.findIndex((li) => li.classList.contains('nav-auth'));

    // The auth group is the last thing in the nav, so it renders top-right.
    expect(authIndex).toBe(items.length - 1);
    expect(authIndex).toBeGreaterThan(spacerIndex);

    const authGroup = container.querySelector('.nav-auth .nav-auth-list');
    expect(authGroup).toBeInTheDocument();
    expect(authGroup.querySelector('a[href="/login"]')).toBeInTheDocument();
    expect(authGroup.querySelector('a[href="/register"]')).toBeInTheDocument();
    expect(authGroup.querySelector('button[aria-label="Toggle theme"]')).toBeInTheDocument();
  });

  test('keeps the primary links in their own wrapping group', () => {
    const { container } = renderNavbar();

    const primary = container.querySelector('.nav-primary .nav-primary-list');
    expect(primary).toBeInTheDocument();
    expect(primary.querySelector('a[href="/status"]')).toBeInTheDocument();
    expect(primary.querySelector('a[href="/login"]')).not.toBeInTheDocument();
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
