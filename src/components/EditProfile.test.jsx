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
