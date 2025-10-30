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
});
