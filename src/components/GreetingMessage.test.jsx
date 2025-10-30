import { render, screen, fireEvent } from '@testing-library/react';
import GreetingMessage from './GreetingMessage.jsx';

describe('GreetingMessage Component', () => {
  test('renders welcome message', () => {
    render(<GreetingMessage />);
    const welcomeText = screen.getByText(/Welcome to the Fitz-Net/i);
    expect(welcomeText).toBeInTheDocument();
  });

  test('renders close button', () => {
    render(<GreetingMessage />);
    const closeButton = screen.getByRole('button', { name: /X/i });
    expect(closeButton).toBeInTheDocument();
  });

  test('close button is clickable', () => {
    render(<GreetingMessage />);
    const closeButton = screen.getByRole('button', { name: /X/i });

    fireEvent.click(closeButton);

    // Test passes if no error occurs when clicking
    expect(closeButton).toBeInTheDocument();
  });

  test('initially visible', () => {
    render(<GreetingMessage />);
    const welcomeText = screen.getByText(/Welcome to the Fitz-Net/i);
    expect(welcomeText).toBeInTheDocument();
  });

  test('renders card with welcome message', () => {
    render(<GreetingMessage />);
    const welcomeText = screen.getByText(/Welcome to the Fitz-Net/i);
    const closeButton = screen.getByRole('button', { name: /X/i });
    expect(welcomeText).toBeInTheDocument();
    expect(closeButton).toBeInTheDocument();
  });
});
