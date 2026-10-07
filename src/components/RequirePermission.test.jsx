import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RequirePermission from './RequirePermission.jsx';
import * as AuthContext from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const renderGuarded = () =>
  render(
    <MemoryRouter initialEntries={['/secret']}>
      <Routes>
        <Route
          path="/secret"
          element={
            <RequirePermission permission="RADARR">
              <div>Secret Page</div>
            </RequirePermission>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="*" element={<div>Not Found</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('RequirePermission', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects unauthenticated users to login', () => {
    AuthContext.useAuth.mockReturnValue({
      loading: false,
      isAuthenticated: () => false,
      hasPermission: () => false,
    });
    renderGuarded();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('hides the page from users without the permission', () => {
    AuthContext.useAuth.mockReturnValue({
      loading: false,
      isAuthenticated: () => true,
      hasPermission: () => false,
    });
    renderGuarded();
    expect(screen.queryByText('Secret Page')).not.toBeInTheDocument();
  });

  it('renders children for users with the permission', () => {
    const hasPermission = vi.fn(() => true);
    AuthContext.useAuth.mockReturnValue({
      loading: false,
      isAuthenticated: () => true,
      hasPermission,
    });
    renderGuarded();
    expect(screen.getByText('Secret Page')).toBeInTheDocument();
    expect(hasPermission).toHaveBeenCalledWith('RADARR');
  });
});
