import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SiteGate from './SiteGate.jsx';
import * as AuthContext from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const LORI = { id: 'lori', name: 'Lori-Net', logo: '/ln.png', requiredPermission: 'LORINET_ACCESS' };
const FITZ = { id: 'fitznet', name: 'Fitz-Net', logo: '/fn.png', requiredPermission: null };

const auth = (overrides) => ({
  loading: false,
  isAuthenticated: () => false,
  hasPermission: () => false,
  user: null,
  logout: vi.fn(),
  login: vi.fn(),
  ...overrides,
});

const renderGate = (site = LORI, path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SiteGate site={site}>
        <div>Lori Home</div>
      </SiteGate>
    </MemoryRouter>
  );

describe('SiteGate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should render nothing while the session is loading', () => {
    AuthContext.useAuth.mockReturnValue(auth({ loading: true }));
    renderGate();
    expect(screen.queryByText('Lori Home')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should show the login dialog over an inert page when signed out', () => {
    AuthContext.useAuth.mockReturnValue(auth());
    renderGate();

    expect(screen.getByRole('dialog', { name: /welcome to lori-net/i })).toBeInTheDocument();
    const page = screen.getByText('Lori Home').closest('.site-gate__backdrop');
    expect(page).toHaveAttribute('aria-hidden', 'true');
    expect(page).toHaveAttribute('inert');
  });

  it('should let signed-out visitors reach the register page', () => {
    AuthContext.useAuth.mockReturnValue(auth());
    renderGate(LORI, '/register');

    expect(screen.getByText('Lori Home')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should show the no-access card to users without LORINET_ACCESS', async () => {
    const logout = vi.fn();
    const hasPermission = vi.fn(() => false);
    AuthContext.useAuth.mockReturnValue(
      auth({ isAuthenticated: () => true, hasPermission, user: { username: 'matt' }, logout })
    );
    renderGate();

    expect(hasPermission).toHaveBeenCalledWith('LORINET_ACCESS');
    expect(screen.getByText('No access yet')).toBeInTheDocument();
    expect(screen.getByText('matt')).toBeInTheDocument();
    expect(screen.queryByText('Lori Home')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /sign in as someone else/i }));
    expect(logout).toHaveBeenCalled();
  });

  it('should show the site to users with LORINET_ACCESS (or ADMIN, via hasPermission)', () => {
    AuthContext.useAuth.mockReturnValue(auth({ isAuthenticated: () => true, hasPermission: () => true }));
    renderGate();

    expect(screen.getByText('Lori Home')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should not gate a site that needs no permission', () => {
    AuthContext.useAuth.mockReturnValue(auth());
    renderGate(FITZ);
    expect(screen.getByText('Lori Home')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
