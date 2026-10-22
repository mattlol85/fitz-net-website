import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ActivitySection from './ActivitySection.jsx';
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

const QUEUE = {
  records: [
    { id: 11, title: 'Dune.2024.2160p', status: 'downloading', size: 2048, sizeleft: 1024, timeleft: '00:10:00' },
    { id: 12, title: 'Heat.1995.1080p', status: 'queued', size: 2048, sizeleft: 2048, timeleft: '' },
  ],
};
const HISTORY = { records: [{ id: 21, sourceTitle: 'Alien.1979.1080p', eventType: 'grabbed', date: '2026-10-20T00:00:00Z' }] };

describe('ActivitySection', () => {
  beforeEach(() => {
    mockJoenetRoutes({
      'GET queue': { records: QUEUE.records.map((r) => ({ ...r })) },
      'GET history': HISTORY,
    });
  });

  it('should list queue and history records', async () => {
    renderWithJoenet(<ActivitySection app="radarr" />);

    expect(await screen.findByText('Dune.2024.2160p')).toBeInTheDocument();
    expect(screen.getByText('Alien.1979.1080p')).toBeInTheDocument();
    expect(api.joenetRequest).toHaveBeenCalledWith('radarr', 'queue', 'jwt', 'radarr-key', { query: { pageSize: '50' } });
  });

  it('should remove a queue item only after confirming', async () => {
    mockJoenetRoutes({
      'GET queue': { records: QUEUE.records.map((r) => ({ ...r })) },
      'GET history': HISTORY,
      'DELETE queue/11': () => ({ success: true, status: 200, data: {} }),
    });
    renderWithJoenet(<ActivitySection app="radarr" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Dune.2024.2160p' }));
    expect(api.joenetRequest).not.toHaveBeenCalledWith('radarr', 'queue/11', 'jwt', 'radarr-key', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Confirm remove' }));

    expect(await screen.findByText('Removed Dune.2024.2160p from the queue')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Dune.2024.2160p' })).not.toBeInTheDocument();
    expect(api.joenetRequest).toHaveBeenCalledWith('radarr', 'queue/11', 'jwt', 'radarr-key', {
      method: 'DELETE',
      query: { removeFromClient: 'true', blocklist: 'false' },
    });
  });

  it('should show an error when removing fails', async () => {
    mockJoenetRoutes({
      'GET queue': { records: QUEUE.records.map((r) => ({ ...r })) },
      'GET history': HISTORY,
      'DELETE queue/12': () => ({ success: false, status: 500, message: 'Client refused' }),
    });
    renderWithJoenet(<ActivitySection app="radarr" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Heat.1995.1080p' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm remove' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Client refused');
    expect(screen.getByText('Heat.1995.1080p')).toBeInTheDocument();
  });

  it('should say so when the queue is empty', async () => {
    mockJoenetRoutes({ 'GET queue': { records: [] }, 'GET history': { records: [] } });
    renderWithJoenet(<ActivitySection app="sonarr" />);

    expect(await screen.findByText('The queue is empty.')).toBeInTheDocument();
    expect(screen.getByText('No history yet.')).toBeInTheDocument();
  });
});
