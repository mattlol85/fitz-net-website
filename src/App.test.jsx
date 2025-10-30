import { render, screen } from '@testing-library/react';
import App from './App.jsx';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('App Component', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  test('renders without crashing', () => {
    render(<App />);
  });

  test('renders Navbar component', () => {
    render(<App />);
    const navbar = screen.getByRole('navigation');
    expect(navbar).toBeInTheDocument();
  });

  test('renders Footer component', () => {
    render(<App />);
    const footer = screen.getByText(/fitznet.org by Matthew Fitzgerald/i);
    expect(footer).toBeInTheDocument();
  });

  test('displays greeting message on first visit', () => {
    render(<App />);
    const greetingMessage = screen.getByText(/Welcome to the Fitz-Net/i);
    expect(greetingMessage).toBeInTheDocument();
  });

  test('does not display greeting message on subsequent visits', () => {
    localStorageMock.setItem('greetingShown', 'true');
    render(<App />);
    const greetingMessage = screen.queryByText(/Welcome to the Fitz-Net/i);
    expect(greetingMessage).not.toBeInTheDocument();
  });

  test('renders Homepage at root path', () => {
    render(<App />);
    const logo = screen.getAllByAltText(/Logo/i)[0];
    expect(logo).toBeInTheDocument();
  });

  test('footer displays current year', () => {
    render(<App />);
    const currentYear = new Date().getFullYear();
    const footer = screen.getByText(new RegExp(currentYear.toString()));
    expect(footer).toBeInTheDocument();
  });
});
