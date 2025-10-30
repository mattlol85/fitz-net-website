import { render, screen } from '@testing-library/react';
import Homepage from './Homepage.jsx';

describe('Homepage Component', () => {
  test('renders without crashing', () => {
    render(<Homepage />);
  });

  test('renders homepage container', () => {
    render(<Homepage />);
    const title = screen.getByRole('heading');
    expect(title).toHaveClass('homepage-title');
  });

  test('renders homepage title', () => {
    render(<Homepage />);
    const title = screen.getByRole('heading');
    expect(title).toBeInTheDocument();
  });

  test('renders BoxLogo component', () => {
    render(<Homepage />);
    const logo = screen.getByAltText(/Logo/i);
    expect(logo).toBeInTheDocument();
  });
});
