import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import Navbar from './Navbar.jsx';
import Register from './Register';

// Mock the API module
vi.mock('../services/api', () => ({
  createUser: vi.fn(),
  loginUser: vi.fn(),
  validateToken: vi.fn(() => true),
  logoutUser: vi.fn(),
  updateUserProfile: vi.fn(),
}));

describe('Register Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderRegister = () => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <Register />
        </AuthProvider>
      </BrowserRouter>
    );
  };

  const validToken = () => {
    const header = btoa(JSON.stringify({ alg: 'HS384' }));
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    return `${header}.${payload}.sig`;
  };

  it('renders registration form with all required fields', () => {
    renderRegister();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('displays error when fields are empty', async () => {
    renderRegister();
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument();
    });
  });

  it('displays error for invalid email format', async () => {
    renderRegister();
    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });

    const form = screen.getByRole('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('displays error when password is too short', async () => {
    renderRegister();
    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'short' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'short' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
    });
  });

  it('displays error when passwords do not match', async () => {
    renderRegister();
    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'different123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('has a login link for existing users', () => {
    renderRegister();
    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
  });

  it('shows loading state while creating account', async () => {
    const { createUser } = await import('../services/api');
    createUser.mockImplementationOnce(
      () => new Promise((resolve) => {
        setTimeout(() => resolve({ success: true, message: 'Account created', username: 'test', email: 'test@test.com', id: '123' }), 100);
      })
    );

    renderRegister();
    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    expect(screen.getByRole('button', { name: /creating account/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith('testuser', 'test@example.com', 'password123');
    });
  });

  it('shows The Board nav link immediately after account creation and auto-login', async () => {
    const { createUser, loginUser } = await import('../services/api');
    createUser.mockResolvedValueOnce({
      success: true,
      message: 'Account created',
      username: 'newuser',
      email: 'new@example.com',
      id: '123',
    });
    loginUser.mockResolvedValueOnce({
      success: true,
      message: 'Login successful',
      username: 'newuser',
      email: 'new@example.com',
      token: validToken(),
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/register']}>
          <Navbar theme="light" toggleTheme={vi.fn()} />
          <Routes>
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<div>Home</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /the board/i })).toBeInTheDocument();
    });
  });
});
