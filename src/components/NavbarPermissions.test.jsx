import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import * as AuthContext from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const renderNavbar = (auth) => {
  AuthContext.useAuth.mockReturnValue({
    user: { username: 'matt' },
    logout: vi.fn(),
    isAuthenticated: () => true,
    ...auth,
  });
  return render(
    <MemoryRouter>
      <Navbar theme="light" toggleTheme={vi.fn()} />
    </MemoryRouter>
  );
};

describe('Navbar permission gating', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the Admin link to ADMIN users', () => {
    renderNavbar({ hasPermission: (p) => p === 'ADMIN' });
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });

  it('shows the Matt-GPT link only to users with AI_USER', () => {
    renderNavbar({ hasPermission: (p) => p === 'AI_USER' });
    expect(screen.getByRole('link', { name: 'Matt-GPT' })).toHaveAttribute('href', '/ai');
  });

  it('hides the Matt-GPT link from users without AI_USER', () => {
    renderNavbar({ hasPermission: () => false });
    expect(screen.queryByRole('link', { name: 'Matt-GPT' })).not.toBeInTheDocument();
  });

  it('should show the Joenet link to users with JOENET_USER', () => {
    renderNavbar({ hasPermission: (p) => p === 'JOENET_USER' });
    expect(screen.getByRole('link', { name: 'Joenet' })).toHaveAttribute('href', '/joenet');
  });

  it('should hide the Joenet link from users without JOENET_USER', () => {
    renderNavbar({ hasPermission: (p) => p === 'AI_USER' });
    expect(screen.queryByRole('link', { name: 'Joenet' })).not.toBeInTheDocument();
  });

  it('should hide the Joenet link from logged-out visitors', () => {
    renderNavbar({ isAuthenticated: () => false, hasPermission: () => true });
    expect(screen.queryByRole('link', { name: 'Joenet' })).not.toBeInTheDocument();
  });

  it('hides the Admin link from users without ADMIN', () => {
    renderNavbar({ hasPermission: () => false });
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });
});

describe('Navbar logout', () => {
  it('should log the user out when the Logout button is pressed', async () => {
    const logout = vi.fn(async () => ({ success: true }));
    renderNavbar({ logout, hasPermission: () => false });

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });
});

describe('Navbar on Lori-Net', () => {
  // site.js reads ?site= in tests and remembers it for the tab.
  beforeEach(() => window.history.pushState({}, '', '/?site=lori'));
  afterEach(() => window.history.pushState({}, '', '/?site=fitznet'));

  it('should show Home and Recipes to a signed-in Lori-Net user and no Fitz-Net links', () => {
    renderNavbar({ hasPermission: () => true });
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Recipes' })).toHaveAttribute('href', '/recipes');
    expect(screen.queryByRole('link', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Welcome, matt' })).toBeInTheDocument();
  });

  it('should hide the Lori-Net links while signed out', () => {
    renderNavbar({ isAuthenticated: () => false, hasPermission: () => false });
    expect(screen.queryByRole('link', { name: 'Recipes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
  });
});
