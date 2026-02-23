import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Navbar from './Navbar.jsx';

describe('Navbar Component', () => {
  const mockTheme = 'light';
  const mockToggleTheme = vi.fn();

  test('renders navigation links', () => {
    render(
      <BrowserRouter>
        <Navbar theme={mockTheme} toggleTheme={mockToggleTheme} />
      </BrowserRouter>
    );

    const aboutLink = screen.getByText(/About/i);
    expect(aboutLink).toBeInTheDocument();
  });

  test('renders logo image', () => {
    render(
      <BrowserRouter>
        <Navbar theme={mockTheme} toggleTheme={mockToggleTheme} />
      </BrowserRouter>
    );

    const logo = screen.getByAltText(/Fitz-Net Logo/i);
    expect(logo).toBeInTheDocument();
  });

  test('logo links to home page', () => {
    render(
      <BrowserRouter>
        <Navbar theme={mockTheme} toggleTheme={mockToggleTheme} />
      </BrowserRouter>
    );

    const logoLink = screen.getByRole('link', { name: /Fitz-Net Logo/i });
    expect(logoLink).toHaveAttribute('href', '/');
  });

  test('About link has correct href', () => {
    render(
      <BrowserRouter>
        <Navbar theme={mockTheme} toggleTheme={mockToggleTheme} />
      </BrowserRouter>
    );

    const aboutLink = screen.getByRole('link', { name: /About/i });
    expect(aboutLink).toHaveAttribute('href', '/info');
  });

  test('renders theme toggle button', () => {
    render(
      <BrowserRouter>
        <Navbar theme={mockTheme} toggleTheme={mockToggleTheme} />
      </BrowserRouter>
    );

    const themeToggle = screen.getByRole('button', { name: /Toggle theme/i });
    expect(themeToggle).toBeInTheDocument();
  });
});
