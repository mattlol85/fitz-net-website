import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EnrollmentTokenPanel from './EnrollmentTokenPanel';
import { useAuth } from '../contexts/AuthContext';
import { generateEnrollmentToken } from '../services/nodeService';

vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: vi.fn(),
}));

vi.mock('../services/nodeService', () => ({
  generateEnrollmentToken: vi.fn(),
}));

describe('EnrollmentTokenPanel Component', () => {
  it('shows a login hint when logged out', () => {
    useAuth.mockReturnValue({ token: null, isAuthenticated: () => false });
    render(<EnrollmentTokenPanel />);

    expect(screen.getByText(/log in/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /generate enrollment token/i })).not.toBeInTheDocument();
  });

  it('generates and displays a token when logged in', async () => {
    useAuth.mockReturnValue({ token: 'fake-jwt', isAuthenticated: () => true });
    generateEnrollmentToken.mockResolvedValueOnce({
      token: 'abc123',
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    });

    render(<EnrollmentTokenPanel />);
    fireEvent.click(screen.getByRole('button', { name: /generate enrollment token/i }));

    await waitFor(() => {
      expect(screen.getByText('abc123')).toBeInTheDocument();
    });
    expect(generateEnrollmentToken).toHaveBeenCalledWith('fake-jwt', undefined);
  });

  it('shows an error message when generation fails', async () => {
    useAuth.mockReturnValue({ token: 'fake-jwt', isAuthenticated: () => true });
    generateEnrollmentToken.mockRejectedValueOnce(new Error('Unauthorized'));

    render(<EnrollmentTokenPanel />);
    fireEvent.click(screen.getByRole('button', { name: /generate enrollment token/i }));

    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });
  });

  it('passes a trimmed label through when provided', async () => {
    useAuth.mockReturnValue({ token: 'fake-jwt', isAuthenticated: () => true });
    generateEnrollmentToken.mockResolvedValueOnce({
      token: 'abc123',
      expiresAt: new Date().toISOString(),
    });

    render(<EnrollmentTokenPanel />);
    fireEvent.change(screen.getByLabelText(/node label/i), { target: { value: '  brother-pc  ' } });
    fireEvent.click(screen.getByRole('button', { name: /generate enrollment token/i }));

    await waitFor(() => {
      expect(generateEnrollmentToken).toHaveBeenCalledWith('fake-jwt', 'brother-pc');
    });
  });
});
