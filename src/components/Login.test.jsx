import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import Login from './Login';

// Mock the API module
vi.mock('../services/api', () => ({
  loginUser: vi.fn(),
  validateToken: vi.fn(() => true),
  logoutUser: vi.fn(),
}));

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderLogin = () => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </BrowserRouter>
    );
  };

  it('renders login form with username and password inputs', () => {
    renderLogin();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('displays error message when fields are empty', async () => {
    renderLogin();
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter both username and password/i)).toBeInTheDocument();
    });
  });

  it('displays error message on login failure', async () => {
    const { loginUser } = await import('../services/api');
    loginUser.mockResolvedValueOnce({
      success: false,
      message: 'Invalid credentials',
    });

    renderLogin();
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('shows loading state while logging in', async () => {
    const { loginUser } = await import('../services/api');
    loginUser.mockImplementationOnce(
      () => new Promise((resolve) => {
        setTimeout(() => resolve({ success: true, message: 'Login successful', username: 'test', email: 'test@test.com', token: 'mock-token' }), 100);
      })
    );

    renderLogin();
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password' } });
    fireEvent.click(loginButton);

    expect(screen.getByRole('button', { name: /logging in/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(loginUser).toHaveBeenCalledWith('testuser', 'password');
    });
  });

  it('has a sign up link', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument();
  });
});

