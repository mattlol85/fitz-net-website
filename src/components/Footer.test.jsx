import { render, screen } from '@testing-library/react';
import Footer from './Footer.jsx';

describe('Footer Component', () => {
  test('renders footer text', () => {
    render(<Footer />);
    const footerText = screen.getByText(/fitznet.org by Matthew Fitzgerald/i);
    expect(footerText).toBeInTheDocument();
  });

  test('displays copyright symbol', () => {
    render(<Footer />);
    const footerText = screen.getByText(/©/);
    expect(footerText).toBeInTheDocument();
  });

  test('displays current year', () => {
    render(<Footer />);
    const currentYear = new Date().getFullYear();
    const yearText = screen.getByText(new RegExp(currentYear.toString()));
    expect(yearText).toBeInTheDocument();
  });

  test('has footer content', () => {
    render(<Footer />);
    const footer = screen.getByText(/fitznet.org by Matthew Fitzgerald/i);
    expect(footer).toHaveClass('footer');
  });

  test('renders as a landmark in normal flow, not a fixed overlay', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer.footer');

    expect(footer).toBeInTheDocument();
    // A fixed footer would sit on top of page content; it must stay in flow.
    expect(footer.style.position).not.toBe('fixed');
  });

  test('publishes its measured height as --footer-height', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 48,
      width: 800,
      top: 0,
      right: 800,
      bottom: 48,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    render(<Footer />);

    expect(document.documentElement.style.getPropertyValue('--footer-height')).toBe('48px');

    vi.restoreAllMocks();
    document.documentElement.style.removeProperty('--footer-height');
  });
});
