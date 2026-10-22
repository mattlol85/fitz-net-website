import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import JoenetKeyGate from './JoenetKeyGate.jsx';
import { renderWithJoenet } from './joenetTestUtils.jsx';
import * as AuthContext from '../../contexts/AuthContext';
import * as api from '../../services/api';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const storedKeys = () => JSON.parse(window.sessionStorage.getItem('joenetKeys') || '{}');

describe('JoenetKeyGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    AuthContext.useAuth.mockReturnValue({ token: 'jwt', loading: false });
  });

  it('should verify against system/status and save the key only after a 200', async () => {
    api.joenetRequest.mockResolvedValue({ success: true, status: 200, data: { version: '5' } });
    renderWithJoenet(<JoenetKeyGate />, { keys: {} });

    fireEvent.change(screen.getByLabelText('Radarr API key'), { target: { value: ' good-key ' } });
    expect(storedKeys()).toEqual({});
    fireEvent.click(screen.getByRole('button', { name: 'Verify Radarr' }));

    expect(await screen.findByText('Radarr verified')).toBeInTheDocument();
    expect(api.joenetRequest).toHaveBeenCalledWith('radarr', 'system/status', 'jwt', 'good-key');
    expect(storedKeys()).toEqual({ radarr: 'good-key' });
  });

  it('should reject a key the service answers 401 for and not save it', async () => {
    api.joenetRequest.mockResolvedValue({ success: false, status: 401, message: 'rejected' });
    renderWithJoenet(<JoenetKeyGate />, { keys: {} });

    fireEvent.change(screen.getByLabelText('Sonarr API key'), { target: { value: 'bad-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify Sonarr' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid API key - not saved.');
    expect(storedKeys()).toEqual({});
    expect(screen.queryByText('Sonarr verified')).not.toBeInTheDocument();
  });

  it('should not save the key when the Joenet host is unreachable', async () => {
    api.joenetRequest.mockResolvedValue({ success: false, status: 502, message: 'The Joenet host is unreachable.' });
    renderWithJoenet(<JoenetKeyGate />, { keys: {} });

    fireEvent.change(screen.getByLabelText('Radarr API key'), { target: { value: 'k' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify Radarr' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The Joenet host is unreachable. Key not saved.');
    expect(storedKeys()).toEqual({});
  });

  it('should keep the Verify button disabled until a key is typed', () => {
    renderWithJoenet(<JoenetKeyGate />, { keys: {} });

    expect(screen.getByRole('button', { name: 'Verify Radarr' })).toBeDisabled();
    expect(api.joenetRequest).not.toHaveBeenCalled();
  });

  it('should forget a single key', () => {
    renderWithJoenet(<JoenetKeyGate />);

    fireEvent.click(screen.getByRole('button', { name: 'Forget Radarr key' }));

    expect(screen.getByLabelText('Radarr API key')).toBeInTheDocument();
    expect(storedKeys()).toEqual({ sonarr: 'sonarr-key' });
  });

  it('should clear every key when Forget keys is pressed', async () => {
    renderWithJoenet(<JoenetKeyGate />);

    fireEvent.click(screen.getByRole('button', { name: 'Forget keys' }));

    await waitFor(() => expect(storedKeys()).toEqual({}));
    expect(screen.getByLabelText('Radarr API key')).toBeInTheDocument();
    expect(screen.getByLabelText('Sonarr API key')).toBeInTheDocument();
  });

  it('should mask the key input', () => {
    renderWithJoenet(<JoenetKeyGate />, { keys: {} });

    expect(screen.getByLabelText('Radarr API key')).toHaveAttribute('type', 'password');
  });
});
