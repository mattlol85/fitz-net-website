import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from './ThemeToggle';

describe('ThemeToggle', () => {
  it('renders theme toggle button', () => {
    const mockToggleTheme = vi.fn();
    render(<ThemeToggle theme="light" toggleTheme={mockToggleTheme} />);

    const button = screen.getByRole('button', { name: /toggle theme/i });
    expect(button).toBeInTheDocument();
  });

  it('displays moon icon in light mode', () => {
    const mockToggleTheme = vi.fn();
    render(<ThemeToggle theme="light" toggleTheme={mockToggleTheme} />);

    const button = screen.getByTitle('Switch to dark mode');
    expect(button).toBeInTheDocument();
  });

  it('displays sun icon in dark mode', () => {
    const mockToggleTheme = vi.fn();
    render(<ThemeToggle theme="dark" toggleTheme={mockToggleTheme} />);

    const button = screen.getByTitle('Switch to light mode');
    expect(button).toBeInTheDocument();
  });

  it('calls toggleTheme when clicked', () => {
    const mockToggleTheme = vi.fn();
    render(<ThemeToggle theme="light" toggleTheme={mockToggleTheme} />);

    const button = screen.getByRole('button', { name: /toggle theme/i });
    fireEvent.click(button);

    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });
});

