import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EditProfile from './EditProfile.jsx';
import * as AuthContext from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('EditProfile', () => {
  const mockUpdateProfile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated users to login', () => {
    AuthContext.useAuth.mockReturnValue({
      user: null,
      loading: false,
      isAuthenticated: () => false,
      updateProfile: mockUpdateProfile,
    });

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<EditProfile />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('renders existing user profile data', () => {
    AuthContext.useAuth.mockReturnValue({
      user: { username: 'testuser', email: 'test@example.com' },
      loading: false,
      isAuthenticated: () => true,
      updateProfile: mockUpdateProfile,
    });

    render(
      <MemoryRouter>
        <EditProfile />
      </MemoryRouter>
    );

    expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('hsl(200,72%,50%)')).toBeInTheDocument();
  });

  it('submits profile updates', async () => {
    mockUpdateProfile.mockResolvedValue({ success: true, message: 'Updated' });
    AuthContext.useAuth.mockReturnValue({
      user: { username: 'testuser', email: 'test@example.com' },
      loading: false,
      isAuthenticated: () => true,
      updateProfile: mockUpdateProfile,
    });

    render(
      <MemoryRouter>
        <EditProfile />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        username: 'newuser',
        email: 'new@example.com',
        password: 'newpass123',
      });
    });

    expect(screen.getByText('Profile updated successfully.')).toBeInTheDocument();
  });
});

describe('EditProfile validation and actions', () => {
  const authWith = (overrides = {}) => ({
    user: { username: 'matt', email: 'matt@example.com', boardColor: 'hsl(1,2%,3%)' },
    loading: false,
    isAuthenticated: () => true,
    updateProfile: vi.fn(async () => ({ success: true, message: 'ok' })),
    ...overrides,
  });

  const renderPage = (auth) => {
    AuthContext.useAuth.mockReturnValue(auth);
    return render(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/" element={<div>Home page</div>} />
          <Route path="/profile" element={<EditProfile />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('should show a loading message while the session is being restored', () => {
    renderPage(authWith({ loading: true }));

    expect(screen.getByText('Loading profile...')).toBeInTheDocument();
  });

  it('should require both a username and an email', () => {
    const auth = authWith();
    renderPage(auth);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(screen.getByText('Username and email are required')).toBeInTheDocument();
    expect(auth.updateProfile).not.toHaveBeenCalled();
  });

  it('should reject a malformed email address', () => {
    const auth = authWith();
    renderPage(auth);

    // "a@b" passes the browser's type=email check but fails the dotted-domain rule.
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    expect(auth.updateProfile).not.toHaveBeenCalled();
  });

  it('should reject a new password shorter than six characters', () => {
    const auth = authWith();
    renderPage(auth);

    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(screen.getByText('Password must be at least 6 characters long')).toBeInTheDocument();
    expect(auth.updateProfile).not.toHaveBeenCalled();
  });

  it('should reject mismatched password confirmation', () => {
    const auth = authWith();
    renderPage(auth);

    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'secret1' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'secret2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(auth.updateProfile).not.toHaveBeenCalled();
  });

  it('should show the failure reason when the save is rejected', async () => {
    const auth = authWith({
      updateProfile: vi.fn(async () => ({ success: false, message: 'Email already used' })),
    });
    renderPage(auth);

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Email already used')).toBeInTheDocument();
    expect(screen.queryByText('Profile updated successfully.')).not.toBeInTheDocument();
  });

  it('should show a generic failure when the rejection has no reason', async () => {
    const auth = authWith({ updateProfile: vi.fn(async () => ({ success: false })) });
    renderPage(auth);

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Failed to update profile')).toBeInTheDocument();
  });

  it('should go back to the home page from the Back button', async () => {
    renderPage(authWith());

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });

  it('should fall back to the default colour when the user has none', () => {
    renderPage(authWith({ user: { username: 'matt', email: 'matt@example.com' } }));

    expect(screen.getByText('hsl(200,72%,50%)')).toBeInTheDocument();
  });
});
