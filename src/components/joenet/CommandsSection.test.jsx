import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommandsSection from './CommandsSection.jsx';
import { mockJoenetRoutes, renderWithJoenet } from './joenetTestUtils.jsx';
import * as AuthContext from '../../contexts/AuthContext';
import * as api from '../../services/api';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  AuthContext.useAuth.mockReturnValue({ token: 'jwt', loading: false });
});

describe('CommandsSection', () => {
  beforeEach(() => {
    mockJoenetRoutes({
      'GET movie': [{ id: 1, title: 'Alien' }, { id: 2, title: 'Heat' }],
      'GET command': [{ id: 5, name: 'RssSync', status: 'completed', queued: '2026-10-22T00:00:00Z' }],
      'POST command': (options) => ({ success: true, status: 201, data: { id: 6, name: options.body.name } }),
    });
  });

  it('should POST a global command by name', async () => {
    renderWithJoenet(<CommandsSection app="radarr" />);

    fireEvent.click(await screen.findByRole('button', { name: 'RSS sync' }));

    expect(await screen.findByText('Queued RSS sync')).toBeInTheDocument();
    expect(api.joenetRequest).toHaveBeenCalledWith('radarr', 'command', 'jwt', 'radarr-key', {
      method: 'POST',
      body: { name: 'RssSync' },
    });
  });

  it('should target the selected movie for item commands', async () => {
    renderWithJoenet(<CommandsSection app="radarr" />);
    await screen.findByRole('option', { name: 'Heat' });

    fireEvent.change(screen.getByLabelText('Target movie'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search movie' }));

    await screen.findByText('Queued Search movie');
    expect(api.joenetRequest).toHaveBeenCalledWith('radarr', 'command', 'jwt', 'radarr-key', {
      method: 'POST',
      body: { name: 'MoviesSearch', movieIds: [2] },
    });
  });

  it('should send a seriesId for Sonarr item commands', async () => {
    mockJoenetRoutes({
      'GET series': [{ id: 7, title: 'Andor' }],
      'GET command': [],
      'POST command': { id: 1 },
    });
    renderWithJoenet(<CommandsSection app="sonarr" />);
    await screen.findByRole('option', { name: 'Andor' });

    fireEvent.click(screen.getByRole('button', { name: 'Search series' }));

    await waitFor(() =>
      expect(api.joenetRequest).toHaveBeenCalledWith('sonarr', 'command', 'jwt', 'sonarr-key', {
        method: 'POST',
        body: { name: 'SeriesSearch', seriesId: 7 },
      })
    );
  });

  it('should list recent commands and surface a failed command', async () => {
    mockJoenetRoutes({
      'GET movie': [],
      'GET command': [{ id: 5, name: 'RssSync', status: 'completed', queued: '2026-10-22T00:00:00Z' }],
      'POST command': () => ({ success: false, status: 400, message: 'Bad command' }),
    });
    renderWithJoenet(<CommandsSection app="radarr" />);

    expect(await screen.findByText(/RssSync - completed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'RSS sync' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Bad command');
  });
});
