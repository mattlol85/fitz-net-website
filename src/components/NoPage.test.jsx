import { render, screen } from '@testing-library/react';
import NoPage from './NoPage.jsx';

describe('NoPage Component', () => {
  test('renders 404 message', () => {
    render(<NoPage />);
    const errorMessage = screen.getByText(/404 Page Not Found/i);
    expect(errorMessage).toBeInTheDocument();
  });

  test('renders as h1 element', () => {
    render(<NoPage />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('404 Page Not Found');
  });
});
