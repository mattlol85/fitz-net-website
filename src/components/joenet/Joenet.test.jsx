import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Joenet from './Joenet.jsx';
import JoenetComingSoon from './JoenetComingSoon.jsx';
import RequirePermission from '../RequirePermission.jsx';
import * as AuthContext from '../../contexts/AuthContext';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const renderAt = (route) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route
          path="/joenet"
          element={
            <RequirePermission permission="JOENET_USER">
              <Joenet />
            </RequirePermission>
          }
        >
          <Route index element={<JoenetComingSoon />} />
          <Route path="admin" element={<p>Admin panel body</p>} />
        </Route>
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>
  );

describe('Joenet layout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should show the coming soon panel and sub-tabs to a JOENET_USER', () => {
    AuthContext.useAuth.mockReturnValue({
      loading: false,
      isAuthenticated: () => true,
      hasPermission: (p) => p === 'JOENET_USER',
    });
    renderAt('/joenet');

    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/joenet');
    expect(screen.getByRole('link', { name: 'Admin Panel' })).toHaveAttribute('href', '/joenet/admin');
  });

  it('should render the admin sub-route inside the layout', () => {
    AuthContext.useAuth.mockReturnValue({
      loading: false,
      isAuthenticated: () => true,
      hasPermission: () => true,
    });
    renderAt('/joenet/admin');

    expect(screen.getByText('Admin panel body')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Admin Panel' })).toHaveClass('joenet-tab--active');
  });

  it('should not render for a user without JOENET_USER', () => {
    AuthContext.useAuth.mockReturnValue({
      loading: false,
      isAuthenticated: () => true,
      hasPermission: () => false,
    });
    renderAt('/joenet/admin');

    expect(screen.queryByText('Admin panel body')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin Panel' })).not.toBeInTheDocument();
  });

  it('should send logged-out visitors to the login page', () => {
    AuthContext.useAuth.mockReturnValue({
      loading: false,
      isAuthenticated: () => false,
      hasPermission: () => false,
    });
    renderAt('/joenet');

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
});
