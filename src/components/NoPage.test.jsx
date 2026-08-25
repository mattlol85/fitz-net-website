import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NoPage from './NoPage.jsx';

describe('NoPage Component', () => {
  test('renders 404 message', () => {
    render(<NoPage />, { wrapper: MemoryRouter });
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('404');
    expect(screen.getByText(/doesn't exist/i)).toBeInTheDocument();
  });

  test('renders a link back home', () => {
    render(<NoPage />, { wrapper: MemoryRouter });
    const link = screen.getByRole('link', { name: /back to home/i });
    expect(link).toHaveAttribute('href', '/');
  });
});
