import { render, screen } from '@testing-library/react';
import BoxLogo from './BoxLogo.jsx';

describe('BoxLogo Component', () => {
  test('renders logo image', () => {
    render(<BoxLogo />);
    const logo = screen.getByAltText(/Logo/i);
    expect(logo).toBeInTheDocument();
  });

  test('logo has correct class', () => {
    render(<BoxLogo />);
    const logo = screen.getByAltText(/Logo/i);
    expect(logo).toHaveClass('logo');
  });

  test('logo image source is set', () => {
    render(<BoxLogo />);
    const logo = screen.getByAltText(/Logo/i);
    expect(logo).toHaveAttribute('src');
  });
});
