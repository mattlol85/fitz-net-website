import { render, screen } from '@testing-library/react';
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
    renderNavbar();

    const aboutLink = screen.getByText(/About/i);
    expect(aboutLink).toBeInTheDocument();
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
});
