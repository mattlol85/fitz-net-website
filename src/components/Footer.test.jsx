import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
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

describe('Footer layout measurement', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.documentElement.style.removeProperty('--footer-height');
  });

  test('should not fail or observe anything where ResizeObserver is unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { unmount } = render(<Footer />);

    expect(() => unmount()).not.toThrow();
  });

  test('should observe the footer and disconnect the observer on unmount', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', vi.fn(function ResizeObserverStub() {
      return { observe, disconnect };
    }));
    const { container, unmount } = render(<Footer />);

    expect(observe).toHaveBeenCalledWith(container.querySelector('footer'));
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  test('should publish the measured height again when the window resizes', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 40 });
    render(<Footer />);
    expect(document.documentElement.style.getPropertyValue('--footer-height')).toBe('40px');

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 55.2 });
    window.dispatchEvent(new Event('resize'));

    expect(document.documentElement.style.getPropertyValue('--footer-height')).toBe('56px');
  });
});
