import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('EnrollmentTokenPanel copy to clipboard', () => {
  const issueToken = async (token = 'node-token-123') => {
    vi.mocked(generateEnrollmentToken).mockResolvedValueOnce({
      token,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    vi.mocked(useAuth).mockReturnValue({ token: 'jwt', isAuthenticated: () => true });
    render(<EnrollmentTokenPanel />);
    fireEvent.click(screen.getByRole('button', { name: /generate enrollment token/i }));
    await screen.findByText(token);
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should copy the token and confirm for a moment', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await issueToken();

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(writeText).toHaveBeenCalledWith('node-token-123');
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });

  it('should go back to Copy after the confirmation timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    await issueToken();

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await screen.findByRole('button', { name: 'Copied!' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('should leave the button alone when the clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    await issueToken();

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('should do nothing when there is no token to copy', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.mocked(generateEnrollmentToken).mockResolvedValueOnce({ token: '', expiresAt: new Date().toISOString() });
    vi.mocked(useAuth).mockReturnValue({ token: 'jwt', isAuthenticated: () => true });
    render(<EnrollmentTokenPanel />);
    fireEvent.click(screen.getByRole('button', { name: /generate enrollment token/i }));
    await screen.findByText(/Expires at/);

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(writeText).not.toHaveBeenCalled();
  });
});
